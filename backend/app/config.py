import logging
from functools import lru_cache
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

INSECURE_SECRET_KEYS = {"", "change-me", "dev-secret-change-me", "secret", "changeme"}

DEFAULT_TIMEZONE = "America/Sao_Paulo"


class ConfigurationError(RuntimeError):
    """Raised when the process is started with an unsafe production config."""


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # "development" | "production". Production enables the startup safety checks.
    environment: str = "development"
    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 720
    google_client_id: str = ""
    allowed_admin_emails: str = ""
    database_url: str = "sqlite:///./mulherviva.db"
    cors_origins: str = "http://localhost:5173"
    # Host header allowlist. Empty = accept any host (fine behind a trusted proxy).
    allowed_hosts: str = ""
    # IANA name used for every "what time is it here" decision (slots, cancellation
    # window, reminders), so behaviour never depends on the container clock's zone.
    timezone: str = DEFAULT_TIMEZONE
    ig_access_token: str = ""
    ig_auto_sync: bool = False
    min_booking_lead_hours: int = 2
    # ---- booking policy defaults (overridable via admin settings) ----
    buffer_minutes: int = 0
    cancellation_window_hours: int = 12
    max_booking_advance_days: int = 60

    # ---- rate limiting (per client IP) ----
    rate_limit_enabled: bool = True
    # Generic ceiling for every /api request.
    rate_limit_per_minute: int = 120
    # Tighter ceiling for endpoints that create records or guess secrets.
    sensitive_rate_limit_per_minute: int = 10
    # Trust X-Forwarded-For for the client IP. Only enable behind a proxy you
    # control, otherwise clients can spoof the header and evade rate limits.
    trust_proxy_headers: bool = False

    # ---- e-mail / notifications ----
    notifications_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    email_from: str = "Mulher Viva <no-reply@mulherviva.com.br>"
    public_base_url: str = "http://localhost:5173"
    clinic_name: str = "Mulher Viva — Dra. Luciana Lopes"
    clinic_address: str = "Centro Médico Lúcio Costa"
    # Inbox that receives contact-form messages. Falls back to the first admin.
    contact_email: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in ("production", "prod")

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_hosts_list(self) -> list[str]:
        return [h.strip() for h in self.allowed_hosts.split(",") if h.strip()]

    @property
    def allowed_admin_emails_list(self) -> list[str]:
        return [
            e.strip().lower()
            for e in self.allowed_admin_emails.split(",")
            if e.strip()
        ]

    @property
    def tzinfo(self) -> ZoneInfo:
        try:
            return ZoneInfo(self.timezone)
        except (ZoneInfoNotFoundError, ValueError):
            logger.warning(
                "Unknown TIMEZONE %r; falling back to %s",
                self.timezone,
                DEFAULT_TIMEZONE,
            )
            return ZoneInfo(DEFAULT_TIMEZONE)

    @property
    def contact_inbox(self) -> str:
        if self.contact_email.strip():
            return self.contact_email.strip()
        admins = self.allowed_admin_emails_list
        return admins[0] if admins else ""

    def validate_for_production(self) -> None:
        """Refuse to boot with a config that would be unsafe on the internet.

        Every one of these has a permissive default so local development stays
        frictionless — which is exactly why they must be checked before the app
        is exposed publicly.
        """
        if not self.is_production:
            return

        problems: list[str] = []

        if self.secret_key.strip().lower() in INSECURE_SECRET_KEYS:
            problems.append(
                "SECRET_KEY ainda e o valor padrao. Gere um novo com: "
                "openssl rand -hex 32"
            )
        elif len(self.secret_key) < 32:
            problems.append("SECRET_KEY deve ter no minimo 32 caracteres.")

        if not self.google_client_id.strip():
            problems.append(
                "GOOGLE_CLIENT_ID nao configurado — o login do painel nao funciona."
            )

        if not self.allowed_admin_emails_list:
            problems.append(
                "ALLOWED_ADMIN_EMAILS vazio — ninguem conseguiria acessar o painel."
            )

        if not self.cors_origins_list:
            problems.append("CORS_ORIGINS vazio — o site nao conseguiria chamar a API.")
        if "*" in self.cors_origins_list:
            problems.append(
                "CORS_ORIGINS nao pode ser '*' em producao. Liste os dominios do site."
            )
        for origin in self.cors_origins_list:
            if origin.startswith("http://") and "localhost" not in origin:
                problems.append(f"CORS_ORIGINS contem uma origem sem HTTPS: {origin}")

        if not self.public_base_url.startswith("https://"):
            problems.append(
                "PUBLIC_BASE_URL deve usar https:// em producao "
                "(usado nos links enviados por e-mail)."
            )

        if self.notifications_enabled and not self.smtp_host.strip():
            problems.append(
                "NOTIFICATIONS_ENABLED=true mas SMTP_HOST esta vazio — "
                "nenhum e-mail seria entregue."
            )

        if problems:
            raise ConfigurationError(
                "Configuracao de producao invalida:\n"
                + "\n".join(f"  - {p}" for p in problems)
            )


@lru_cache
def get_settings() -> Settings:
    return Settings()
