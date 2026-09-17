import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    __package__ = "app"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from sqlalchemy import inspect, text

from .config import get_settings
from .database import Base, SessionLocal, engine
from .routers import admin, auth, google_calendar, public
from .routers.admin import UPLOADS_DIR
from .seed import seed
from .services.instagram import sync_instagram

logger = logging.getLogger(__name__)

IG_SYNC_INTERVAL_SECONDS = 24 * 60 * 60

REMINDER_INTERVAL_SECONDS = 60 * 60

# Lightweight additive migrations (no Alembic): table -> {column name -> SQL type}.
_TABLE_COLUMNS = {
    "appointments": {
        "client_email": "VARCHAR(150)",
        "client_phone": "VARCHAR(150)",
        "reason": "VARCHAR(500)",
        "is_first_visit": "BOOLEAN DEFAULT FALSE",
        "token": "VARCHAR(64)",
        "reminder_sent_at": "DATETIME",
        "google_event_id": "VARCHAR(128)",
    },
    "blog_posts": {
        "status": "VARCHAR(10) NOT NULL DEFAULT 'published'",
        "pinned": "BOOLEAN NOT NULL DEFAULT 0",
    },
    "availability_rules": {
        "location": "VARCHAR(20) NOT NULL DEFAULT 'presencial_bsb'",
        "start_date": "DATE",
        "end_date": "DATE",
    },
    "availability_overrides": {
        "location": "VARCHAR(20)",
    },
}


def _ensure_columns() -> None:
    """Add new nullable columns to existing tables when missing.

    create_all() never alters an existing table, so a database created before
    these columns existed would lack them. This runs the minimal ALTER TABLEs.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as conn:
        for table, columns in _TABLE_COLUMNS.items():
            if table not in existing_tables:
                continue
            existing = {col["name"] for col in inspector.get_columns(table)}
            missing = {k: v for k, v in columns.items() if k not in existing}
            for name, sql_type in missing.items():
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {sql_type}"))
            if missing:
                logger.info(
                    "Added missing %s columns: %s", table, ", ".join(missing)
                )


def _migrate_appointment_locations() -> None:
    """Backfill the old 2-way 'presencial' appointment type to 'presencial_bsb'.

    Idempotent: after the first run no row matches 'presencial' anymore.
    """
    with engine.begin() as conn:
        conn.execute(
            text("UPDATE appointments SET type = 'presencial_bsb' WHERE type = 'presencial'")
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
    from datetime import date, timedelta

    from sqlalchemy import select

    from .models import Appointment, Specialty, utcnow
    from .services import notifications

    tomorrow = date.today() + timedelta(days=1)
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
    Base.metadata.create_all(bind=engine)
    _ensure_columns()
    _migrate_appointment_locations()
    with SessionLocal() as db:
        seed(db)
    if get_settings().dev_auth_bypass:
        logger.warning(
            "DEV_AUTH_BYPASS ativo: /api/auth/dev-login emite token de admin "
            "sem Google. NUNCA habilite em producao."
        )
    tasks = []
    if get_settings().ig_auto_sync:
        tasks.append(asyncio.create_task(_instagram_sync_loop()))
    if get_settings().notifications_enabled:
        tasks.append(asyncio.create_task(_reminder_loop()))
    yield
    for task in tasks:
        task.cancel()


class ImmutableStaticFiles(StaticFiles):
    """Uploaded files get a random UUID name per upload, so a given URL's
    content never changes — safe to cache for a year without revalidation."""

    def file_response(self, *args, **kwargs) -> Response:
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response


app = FastAPI(title="Mulher Viva API", version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(public.router)
app.include_router(admin.router)
app.include_router(google_calendar.router)

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", ImmutableStaticFiles(directory=UPLOADS_DIR), name="uploads")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
