from datetime import datetime, timedelta, timezone

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session

from ..auth import get_current_admin
from ..config import get_settings
from ..database import get_db
from ..schemas import GoogleCalendarConnectOut, GoogleCalendarStatusOut
from ..services import google_calendar
from ..services.settings import set_setting

router = APIRouter(prefix="/api", tags=["google-calendar"])

STATE_PURPOSE = "gcal_oauth"
STATE_TTL_MINUTES = 10


def _build_state(admin_email: str) -> str:
    settings = get_settings()
    payload = {
        "purpose": STATE_PURPOSE,
        "sub": admin_email,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=STATE_TTL_MINUTES),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def _verify_state(state: str) -> str:
    settings = get_settings()
    try:
        payload = jwt.decode(state, settings.secret_key, algorithms=["HS256"])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=400, detail="Estado invalido ou expirado")
    if payload.get("purpose") != STATE_PURPOSE or not payload.get("sub"):
        raise HTTPException(status_code=400, detail="Estado invalido ou expirado")
    return payload["sub"]


@router.get("/admin/google-calendar/status", response_model=GoogleCalendarStatusOut)
def google_calendar_status(
    db: Session = Depends(get_db), _admin: str = Depends(get_current_admin)
):
    status_ = google_calendar.connection_status(db)
    return GoogleCalendarStatusOut(
        connected=status_["connected"],
        email=status_["email"],
        configured=bool(get_settings().google_client_secret),
    )


@router.post("/admin/google-calendar/connect", response_model=GoogleCalendarConnectOut)
def google_calendar_connect(admin: str = Depends(get_current_admin)):
    if not get_settings().google_client_secret:
        raise HTTPException(
            status_code=400, detail="GOOGLE_CLIENT_SECRET nao configurado"
        )
    state = _build_state(admin)
    return GoogleCalendarConnectOut(auth_url=google_calendar.build_auth_url(state))


@router.delete(
    "/admin/google-calendar/connection", status_code=status.HTTP_204_NO_CONTENT
)
def google_calendar_disconnect(
    db: Session = Depends(get_db), _admin: str = Depends(get_current_admin)
):
    google_calendar.revoke_connection(db)


@router.get("/auth/google-calendar/callback", response_class=HTMLResponse)
def google_calendar_callback(
    state: str = Query(...),
    code: str | None = Query(None),
    error: str | None = Query(None),
    db: Session = Depends(get_db),
):
    _verify_state(state)

    if error:
        return HTMLResponse(
            "<p>Autorizacao do Google Agenda cancelada. Pode fechar esta aba.</p>"
        )
    if not code:
        return HTMLResponse(
            "<p>Google nao retornou um codigo de autorizacao. Tente novamente.</p>",
            status_code=400,
        )

    try:
        result = google_calendar.exchange_code(code)
    except Exception:
        return HTMLResponse(
            "<p>Nao foi possivel conectar ao Google Agenda. Tente novamente.</p>",
            status_code=502,
        )

    set_setting(db, google_calendar.SETTING_REFRESH_TOKEN, result["refresh_token"])
    set_setting(db, google_calendar.SETTING_ACCOUNT_EMAIL, result["email"])
    set_setting(db, google_calendar.SETTING_CALENDAR_ID, "primary")
    google_calendar.backfill_future()

    return HTMLResponse(
        f"<p>Google Agenda conectada ({result['email']}). Pode fechar esta aba.</p>"
    )
