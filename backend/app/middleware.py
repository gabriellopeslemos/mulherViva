"""Transport-level protections: security headers and per-IP rate limiting."""

import time
from collections import deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import Settings

# Endpoints that either create records or let a caller guess a secret. These get
# the tighter bucket so a script cannot flood the clinic's inbox or brute-force
# a self-service token.
SENSITIVE_PREFIXES = (
    "/api/auth/google",
    "/api/bookings",
    "/api/waitlist",
    "/api/contact",
)

WINDOW_SECONDS = 60

# Stop tracking an IP after this long without a request, so the table cannot
# grow without bound.
IDLE_EVICTION_SECONDS = 300


def client_ip(request: Request, trust_proxy: bool) -> str:
    """Best-effort client address.

    X-Forwarded-For is attacker-controlled unless a proxy you own rewrites it,
    so it is only consulted when the operator opts in via TRUST_PROXY_HEADERS.
    """
    if trust_proxy:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Left-most entry is the original client.
            return forwarded.split(",")[0].strip()
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
    return request.client.host if request.client else "unknown"


def _is_sensitive(path: str) -> bool:
    return any(path.startswith(prefix) for prefix in SENSITIVE_PREFIXES)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Fixed-window-per-IP limiter kept in process memory.

    Sized for a single-clinic deployment running one or a few workers. It is
    deliberately not a distributed limiter: the goal is to blunt scripted abuse
    (token guessing, booking spam), not to meter a public API. Behind several
    replicas each worker enforces its own share of the limit.
    """

    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self._settings = settings
        self._hits: dict[tuple[str, bool], deque[float]] = {}
        self._last_sweep = time.monotonic()

    def _sweep(self, now: float) -> None:
        if now - self._last_sweep < IDLE_EVICTION_SECONDS:
            return
        self._last_sweep = now
        stale = [
            key
            for key, stamps in self._hits.items()
            if not stamps or now - stamps[-1] > IDLE_EVICTION_SECONDS
        ]
        for key in stale:
            del self._hits[key]

    def _over_limit(self, key: tuple[str, bool], limit: int, now: float) -> bool:
        stamps = self._hits.setdefault(key, deque())
        cutoff = now - WINDOW_SECONDS
        while stamps and stamps[0] < cutoff:
            stamps.popleft()
        if len(stamps) >= limit:
            return True
        stamps.append(now)
        return False

    async def dispatch(self, request: Request, call_next):
        settings = self._settings
        path = request.url.path

        # Only meter the API. Health checks and docs stay free so a load
        # balancer probing every few seconds can never lock itself out.
        if not settings.rate_limit_enabled or not path.startswith("/api"):
            return await call_next(request)

        # Preflight requests carry no credentials and must always succeed,
        # otherwise a throttled browser sees an opaque CORS failure.
        if request.method == "OPTIONS":
            return await call_next(request)

        now = time.monotonic()
        self._sweep(now)

        sensitive = _is_sensitive(path)
        limit = (
            settings.sensitive_rate_limit_per_minute
            if sensitive
            else settings.rate_limit_per_minute
        )
        ip = client_ip(request, settings.trust_proxy_headers)

        if self._over_limit((ip, sensitive), limit, now):
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Muitas solicitacoes. Aguarde um minuto e tente novamente."
                },
                headers={"Retry-After": str(WINDOW_SECONDS)},
            )

        return await call_next(request)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Baseline response hardening for the API.

    The API only ever returns JSON, so the CSP can be maximally restrictive —
    the site's own CSP is configured separately at the web server.
    """

    def __init__(self, app, settings: Settings):
        super().__init__(app)
        self._hsts = settings.is_production

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        headers.setdefault(
            "Permissions-Policy", "geolocation=(), microphone=(), camera=()"
        )
        # Scoped to the API so the bundled Swagger UI (dev only) still loads its
        # own scripts and styles.
        if request.url.path.startswith("/api"):
            headers.setdefault(
                "Content-Security-Policy",
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
            )
            # Patient data must never be cached by an intermediary.
            headers.setdefault("Cache-Control", "no-store")
        if self._hsts:
            headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response
