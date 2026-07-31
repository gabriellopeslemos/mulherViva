import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    __package__ = "app"

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.exc import SQLAlchemyError

from .config import get_settings
from .database import Base, SessionLocal, engine
from .middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from .models import UNIQUE_SLOT_INDEX
from .routers import admin, auth, public
from .seed import seed
from .services.instagram import sync_instagram

logger = logging.getLogger(__name__)

IG_SYNC_INTERVAL_SECONDS = 24 * 60 * 60

REMINDER_INTERVAL_SECONDS = 60 * 60

# Lightweight additive migrations (no Alembic): column name -> SQL type.
_APPOINTMENT_COLUMNS = {
    "client_email": "VARCHAR(150)",
    "client_phone": "VARCHAR(150)",
    "reason": "VARCHAR(500)",
    "is_first_visit": "BOOLEAN DEFAULT FALSE",
    "token": "VARCHAR(64)",
    "reminder_sent_at": "DATETIME",
}


def configure_logging() -> None:
    """Send application logs to stdout for the container runtime to collect."""
    if logging.getLogger().handlers:
        return
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        stream=sys.stdout,
    )


def _ensure_columns() -> None:
    """Add new nullable columns to existing tables when missing.

    create_all() never alters an existing table, so a database created before
    these columns existed would lack them. This runs the minimal ALTER TABLEs.
    """
    inspector = inspect(engine)
    if "appointments" not in inspector.get_table_names():
        return
    existing = {col["name"] for col in inspector.get_columns("appointments")}
    missing = {k: v for k, v in _APPOINTMENT_COLUMNS.items() if k not in existing}
    if not missing:
        return
    with engine.begin() as conn:
        for name, sql_type in missing.items():
            conn.execute(
                text(f"ALTER TABLE appointments ADD COLUMN {name} {sql_type}")
            )
    logger.info("Added missing appointment columns: %s", ", ".join(missing))


def _ensure_slot_uniqueness() -> None:
    """Create the anti-double-booking index on databases that predate it.

    create_all() only builds indexes for tables it creates, so an existing
    installation needs this explicitly. If historical rows already violate the
    constraint the creation fails; that is logged loudly rather than aborting
    the boot, because refusing to start would take a working clinic offline.
    """
    inspector = inspect(engine)
    if "appointments" not in inspector.get_table_names():
        return
    if any(
        idx["name"] == UNIQUE_SLOT_INDEX.name
        for idx in inspector.get_indexes("appointments")
    ):
        return
    try:
        with engine.begin() as conn:
            UNIQUE_SLOT_INDEX.create(conn)
        logger.info("Created unique slot index %s", UNIQUE_SLOT_INDEX.name)
    except SQLAlchemyError:
        logger.error(
            "Could not create %s — the appointments table already contains two "
            "active bookings sharing a date and start time. Resolve the "
            "duplicates and restart to enable double-booking protection.",
            UNIQUE_SLOT_INDEX.name,
            exc_info=True,
        )


async def _instagram_sync_loop() -> None:
    while True:
        try:
            with SessionLocal() as db:
                result = await asyncio.to_thread(sync_instagram, db)
                logger.info("Instagram auto-sync: %s", result)
        except Exception:
            logger.exception("Instagram auto-sync failed")
        await asyncio.sleep(IG_SYNC_INTERVAL_SECONDS)


def _send_due_reminders() -> int:
    """Send a 24h reminder for tomorrow's confirmed appointments (once each)."""
    from datetime import timedelta

    from sqlalchemy import select

    from .models import Appointment, Specialty
    from .services import notifications
    from .timeutils import local_today, utcnow

    tomorrow = local_today() + timedelta(days=1)
    sent = 0
    with SessionLocal() as db:
        appointments = list(
            db.scalars(
                select(Appointment).where(
                    Appointment.date == tomorrow,
                    Appointment.status == "confirmed",
                    Appointment.reminder_sent_at.is_(None),
                    Appointment.client_email.is_not(None),
                )
            )
        )
        for appt in appointments:
            specialty = db.get(Specialty, appt.specialty_id)
            delivered = notifications.notify_reminder(
                {
                    "client_name": appt.client_name,
                    "client_email": appt.client_email,
                    "date": appt.date,
                    "start_time": appt.start_time,
                    "end_time": appt.end_time,
                    "type": appt.type,
                    "specialty_name": specialty.name if specialty else "",
                    "token": appt.token,
                }
            )
            # Only flag as reminded once the e-mail actually went out, so a
            # transient SMTP failure is retried on the next loop instead of
            # silently dropping the reminder.
            if delivered:
                appt.reminder_sent_at = utcnow()
                sent += 1
        if sent:
            db.commit()
    return sent


async def _reminder_loop() -> None:
    while True:
        try:
            count = await asyncio.to_thread(_send_due_reminders)
            if count:
                logger.info("Sent %d appointment reminder(s)", count)
        except Exception:
            logger.exception("Reminder loop failed")
        await asyncio.sleep(REMINDER_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logger.info(
        "Starting Mulher Viva API (environment=%s, timezone=%s)",
        settings.environment,
        settings.timezone,
    )
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    _ensure_slot_uniqueness()
    with SessionLocal() as db:
        seed(db)
    tasks = []
    if settings.ig_auto_sync:
        tasks.append(asyncio.create_task(_instagram_sync_loop()))
    if settings.notifications_enabled:
        tasks.append(asyncio.create_task(_reminder_loop()))
    else:
        logger.warning(
            "NOTIFICATIONS_ENABLED is false — no confirmation or reminder "
            "e-mails will be sent."
        )
    yield
    for task in tasks:
        task.cancel()


def create_app() -> FastAPI:
    configure_logging()
    settings = get_settings()
    # Raises ConfigurationError (aborting the boot) on an unsafe prod config.
    settings.validate_for_production()

    application = FastAPI(
        title="Mulher Viva API",
        version="1.0.0",
        lifespan=lifespan,
        # The interactive docs enumerate every admin endpoint; keep them off
        # the public internet.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None if settings.is_production else "/redoc",
        openapi_url=None if settings.is_production else "/openapi.json",
    )

    # Starlette inserts each new middleware at the front of the stack, so the
    # LAST one registered here is the outermost. That puts CORS on the outside
    # and the rate limiter on the inside — which is what we want: a 429 still
    # travels back out through the security-header and CORS layers, so the
    # browser can actually read the "slow down" message instead of reporting an
    # opaque CORS failure.
    application.add_middleware(RateLimitMiddleware, settings=settings)
    application.add_middleware(SecurityHeadersMiddleware, settings=settings)
    application.add_middleware(GZipMiddleware, minimum_size=1000)

    if settings.allowed_hosts_list:
        application.add_middleware(
            TrustedHostMiddleware, allowed_hosts=settings.allowed_hosts_list
        )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        max_age=600,
    )

    application.include_router(auth.router)
    application.include_router(public.router)
    application.include_router(admin.router)

    @application.get("/health", tags=["health"])
    def health() -> dict:
        return {"status": "ok"}

    @application.get("/health/ready", tags=["health"])
    def readiness() -> dict:
        """Readiness probe: reports whether the database is reachable."""
        try:
            with SessionLocal() as db:
                db.execute(text("SELECT 1"))
        except SQLAlchemyError:
            logger.exception("Readiness check failed")
            raise HTTPException(status_code=503, detail="database unavailable")
        return {"status": "ready"}

    return application


app = create_app()
