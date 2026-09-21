import asyncio
import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path

if __package__ in (None, ""):
    sys.path.append(str(Path(__file__).resolve().parent.parent))
    __package__ = "app"

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response

from .config import get_settings
from .database import SessionLocal
from .routers import admin, auth, google_calendar, public
from .routers.admin import UPLOADS_DIR
from .seed import seed
from .services.instagram import sync_instagram

logger = logging.getLogger(__name__)

IG_SYNC_INTERVAL_SECONDS = 24 * 60 * 60

REMINDER_INTERVAL_SECONDS = 60 * 60

ALEMBIC_INI_PATH = Path(__file__).resolve().parent.parent / "alembic.ini"


def _run_migrations() -> None:
    """Apply any pending Alembic migrations. See backend/alembic/versions/."""
    command.upgrade(Config(str(ALEMBIC_INI_PATH)), "head")


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
    _run_migrations()
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
