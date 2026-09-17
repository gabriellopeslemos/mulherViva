"""Best-effort sync of appointments to a single connected Google Calendar.

Mirrors notifications.py: sync runs in daemon threads and swallows every
error so a Google outage or a revoked grant can never break or block a
booking request. Threads open their own SessionLocal (never reuse the
caller's session) and are handed only the appointment id, so they stay
session-safe.
"""

import logging
import threading
import time
from datetime import date, datetime
from urllib.parse import urlencode

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import SessionLocal
from ..models import Appointment, Specialty
from .notifications import manage_url
from .settings import delete_setting, get_setting, set_setting

logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
CALENDAR_API = "https://www.googleapis.com/calendar/v3"
SCOPES = "https://www.googleapis.com/auth/calendar.events openid email"

SETTING_REFRESH_TOKEN = "gcal_refresh_token"
SETTING_ACCOUNT_EMAIL = "gcal_account_email"
SETTING_CALENDAR_ID = "gcal_calendar_id"

_STATUS_PREFIX = {"pending": "[Pendente] ", "no_show": "[Faltou] "}

# Cached access token, shared across sync threads. Refreshed on demand.
_token_cache: dict = {}
_token_lock = threading.Lock()


def build_auth_url(state: str) -> str:
    settings = get_settings()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_oauth_redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{GOOGLE_AUTH_URL}?{urlencode(params)}"


def exchange_code(code: str) -> dict:
    """Exchange an OAuth code for a refresh token + the connected e-mail.

    Raises on any failure; callers turn that into an error page.
    """
    settings = get_settings()
    resp = httpx.post(
        GOOGLE_TOKEN_URL,
        data={
            "code": code,
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "redirect_uri": settings.google_oauth_redirect_uri,
            "grant_type": "authorization_code",
        },
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    refresh_token = data.get("refresh_token")
    if not refresh_token:
        raise RuntimeError(
            "Google nao retornou refresh_token. Revogue o acesso do app em "
            "myaccount.google.com/permissions e tente conectar novamente."
        )
    claims = google_id_token.verify_oauth2_token(
        data["id_token"], google_requests.Request(), settings.google_client_id
    )
    email = claims.get("email")
    if not email:
        raise RuntimeError("Nao foi possivel obter o e-mail da conta Google")
    return {"refresh_token": refresh_token, "email": email.strip().lower()}


def _get_access_token(db: Session) -> str | None:
    refresh_token = get_setting(db, SETTING_REFRESH_TOKEN)
    if not refresh_token:
        return None
    with _token_lock:
        cached = _token_cache.get("token")
        expires_at = _token_cache.get("expires_at", 0.0)
        if cached and time.time() < expires_at - 60:
            return cached
        settings = get_settings()
        resp = httpx.post(
            GOOGLE_TOKEN_URL,
            data={
                "refresh_token": refresh_token,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "grant_type": "refresh_token",
            },
            timeout=10,
        )
        if resp.status_code == 400 and "invalid_grant" in resp.text:
            logger.warning("Google Calendar refresh token revoked; disconnecting")
            delete_setting(db, SETTING_REFRESH_TOKEN)
            delete_setting(db, SETTING_ACCOUNT_EMAIL)
            delete_setting(db, SETTING_CALENDAR_ID)
            _token_cache.clear()
            return None
        resp.raise_for_status()
        data = resp.json()
        token = data["access_token"]
        _token_cache["token"] = token
        _token_cache["expires_at"] = time.time() + data.get("expires_in", 3600)
        return token


def connection_status(db: Session) -> dict:
    return {
        "connected": bool(get_setting(db, SETTING_REFRESH_TOKEN)),
        "email": get_setting(db, SETTING_ACCOUNT_EMAIL),
    }


def revoke_connection(db: Session) -> None:
    """Best-effort revoke with Google, then always clear local state."""
    refresh_token = get_setting(db, SETTING_REFRESH_TOKEN)
    if refresh_token:
        try:
            httpx.post(GOOGLE_REVOKE_URL, params={"token": refresh_token}, timeout=10)
        except Exception:
            logger.exception("Failed to revoke Google Calendar token")
    delete_setting(db, SETTING_REFRESH_TOKEN)
    delete_setting(db, SETTING_ACCOUNT_EMAIL)
    delete_setting(db, SETTING_CALENDAR_ID)
    with _token_lock:
        _token_cache.clear()


def _event_body(appt: Appointment, specialty_name: str) -> dict:
    settings = get_settings()
    prefix = _STATUS_PREFIX.get(appt.status, "")
    location = "Online" if appt.type == "online" else settings.clinic_address
    description_lines = [f"Contato: {appt.client_contact}"]
    if appt.reason:
        description_lines.append(f"Motivo: {appt.reason}")
    description_lines.append(f"Origem: {appt.source}")
    link = manage_url(appt.token)
    if link:
        description_lines.append(f"Gerenciar: {link}")
    start = datetime.combine(appt.date, appt.start_time)
    end = datetime.combine(appt.date, appt.end_time)
    return {
        "summary": f"{prefix}{appt.client_name} — {specialty_name}",
        "location": location,
        "description": "\n".join(description_lines),
        "start": {"dateTime": start.isoformat(), "timeZone": settings.timezone},
        "end": {"dateTime": end.isoformat(), "timeZone": settings.timezone},
    }


def _delete_event_by_id(calendar_id: str, event_id: str, headers: dict) -> None:
    resp = httpx.delete(
        f"{CALENDAR_API}/calendars/{calendar_id}/events/{event_id}",
        headers=headers,
        timeout=10,
    )
    if resp.status_code not in (200, 204, 404, 410):
        resp.raise_for_status()


def _sync_appointment(appointment_id: int) -> None:
    try:
        with SessionLocal() as db:
            if not connection_status(db)["connected"]:
                return
            appointment = db.get(Appointment, appointment_id)
            if appointment is None:
                return
            token = _get_access_token(db)
            if token is None:
                return
            calendar_id = get_setting(db, SETTING_CALENDAR_ID, "primary")
            headers = {"Authorization": f"Bearer {token}"}

            if appointment.status == "cancelled":
                if appointment.google_event_id:
                    _delete_event_by_id(calendar_id, appointment.google_event_id, headers)
                    appointment.google_event_id = None
                    db.commit()
                return

            specialty = db.get(Specialty, appointment.specialty_id)
            body = _event_body(appointment, specialty.name if specialty else "")

            if appointment.google_event_id:
                resp = httpx.patch(
                    f"{CALENDAR_API}/calendars/{calendar_id}/events/{appointment.google_event_id}",
                    json=body,
                    headers=headers,
                    timeout=10,
                )
                if resp.status_code == 404:
                    appointment.google_event_id = None
                else:
                    resp.raise_for_status()
                    db.commit()
                    return

            resp = httpx.post(
                f"{CALENDAR_API}/calendars/{calendar_id}/events",
                json=body,
                headers=headers,
                timeout=10,
            )
            resp.raise_for_status()
            appointment.google_event_id = resp.json()["id"]
            db.commit()
    except Exception:
        logger.exception("Google Calendar sync failed for appointment %s", appointment_id)


def _delete_event_target(event_id: str) -> None:
    try:
        with SessionLocal() as db:
            if not connection_status(db)["connected"]:
                return
            token = _get_access_token(db)
            if token is None:
                return
            calendar_id = get_setting(db, SETTING_CALENDAR_ID, "primary")
            _delete_event_by_id(
                calendar_id, event_id, {"Authorization": f"Bearer {token}"}
            )
    except Exception:
        logger.exception("Google Calendar event delete failed for event %s", event_id)


def schedule_sync(appointment_id: int) -> None:
    threading.Thread(target=_sync_appointment, args=(appointment_id,), daemon=True).start()


def schedule_event_delete(event_id: str | None) -> None:
    if not event_id:
        return
    threading.Thread(target=_delete_event_target, args=(event_id,), daemon=True).start()


def _backfill_target() -> None:
    try:
        with SessionLocal() as db:
            if not connection_status(db)["connected"]:
                return
            appointment_ids = list(
                db.scalars(
                    select(Appointment.id).where(
                        Appointment.date >= date.today(),
                        Appointment.status != "cancelled",
                        Appointment.google_event_id.is_(None),
                    )
                )
            )
        for appointment_id in appointment_ids:
            _sync_appointment(appointment_id)
    except Exception:
        logger.exception("Google Calendar backfill failed")


def backfill_future() -> None:
    threading.Thread(target=_backfill_target, daemon=True).start()
