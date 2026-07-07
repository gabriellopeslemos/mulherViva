from datetime import date, datetime, time, timedelta, timezone
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import httpx
import jwt
import pytest
from fastapi import HTTPException

import app.routers.google_calendar as gcal_router
import app.services.google_calendar as gcal
import app.services.notifications as notifications
from app.models import Appointment, Specialty


def _settings(**overrides):
    base = dict(
        google_client_id="client-id.apps.googleusercontent.com",
        google_client_secret="shh",
        google_oauth_redirect_uri="http://localhost:8000/api/auth/google-calendar/callback",
        timezone="America/Sao_Paulo",
        clinic_name="Mulher Viva",
        clinic_address="Centro Médico",
        public_base_url="http://localhost:5173",
        secret_key="test-secret-key-at-least-32-bytes-long",
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _appt(**overrides):
    base = dict(
        specialty_id=1,
        status="confirmed",
        client_name="Maria Souza",
        client_contact="11999999999",
        reason=None,
        source="public",
        token="tok123",
        date=date(2026, 6, 11),
        start_time=time(14, 0),
        end_time=time(15, 0),
        type="online",
        google_event_id=None,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


class _FakeSession:
    """Stands in for SessionLocal(); db.get() resolves by model identity."""

    def __init__(self, appointment=None, specialty=None):
        self._appointment = appointment
        self._specialty = specialty
        self.commits = 0

    def get(self, model, _obj_id):
        if model is Appointment:
            return self._appointment
        if model is Specialty:
            return self._specialty
        return None

    def commit(self):
        self.commits += 1

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def _fake_response(status_code, json_body=None):
    return httpx.Response(
        status_code,
        json=json_body,
        request=httpx.Request("POST", "https://www.googleapis.com/x"),
    )


# ---- google_calendar_link (patient e-mail link) ----


def test_google_calendar_link_online(monkeypatch):
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    appt = {
        "date": date(2026, 6, 11),
        "start_time": time(14, 0),
        "end_time": time(15, 0),
        "type": "online",
        "specialty_name": "Ginecologia",
    }
    link = notifications.google_calendar_link(appt)
    parsed = urlparse(link)
    params = parse_qs(parsed.query)
    assert link.startswith("https://calendar.google.com/calendar/render?")
    assert params["action"] == ["TEMPLATE"]
    assert params["dates"] == ["20260611T140000/20260611T150000"]
    assert params["ctz"] == ["America/Sao_Paulo"]
    assert params["location"] == ["Online (videoconferência)"]


def test_google_calendar_link_presencial(monkeypatch):
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    appt = {
        "date": date(2026, 6, 11),
        "start_time": time(9, 0),
        "end_time": time(10, 0),
        "type": "presencial",
        "specialty_name": "Nutrição",
    }
    link = notifications.google_calendar_link(appt)
    params = parse_qs(urlparse(link).query)
    assert params["location"] == ["Centro Médico"]


# ---- _event_body ----


def test_event_body_pending_prefix(monkeypatch):
    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    body = gcal._event_body(_appt(status="pending"), "Ginecologia")
    assert body["summary"] == "[Pendente] Maria Souza — Ginecologia"


def test_event_body_confirmed_no_prefix(monkeypatch):
    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    body = gcal._event_body(_appt(status="confirmed"), "Ginecologia")
    assert body["summary"] == "Maria Souza — Ginecologia"


def test_event_body_no_show_prefix(monkeypatch):
    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    body = gcal._event_body(_appt(status="no_show"), "Ginecologia")
    assert body["summary"] == "[Faltou] Maria Souza — Ginecologia"


def test_event_body_has_timezone_and_no_attendees(monkeypatch):
    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    body = gcal._event_body(_appt(), "Ginecologia")
    assert body["start"]["timeZone"] == "America/Sao_Paulo"
    assert body["end"]["timeZone"] == "America/Sao_Paulo"
    assert "attendees" not in body


# ---- build_auth_url ----


def test_build_auth_url(monkeypatch):
    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    url = gcal.build_auth_url("some-state")
    params = parse_qs(urlparse(url).query)
    assert params["access_type"] == ["offline"]
    assert params["prompt"] == ["consent"]
    assert params["response_type"] == ["code"]
    assert params["state"] == ["some-state"]
    assert "calendar.events" in params["scope"][0]


# ---- disconnected: no HTTP at all ----


def test_sync_noop_when_disconnected(monkeypatch):
    monkeypatch.setattr(gcal, "SessionLocal", lambda: _FakeSession())
    monkeypatch.setattr(gcal, "connection_status", lambda db: {"connected": False, "email": None})

    def boom(*args, **kwargs):
        raise AssertionError("HTTP should not be called when disconnected")

    monkeypatch.setattr(httpx, "get", boom)
    monkeypatch.setattr(httpx, "post", boom)
    monkeypatch.setattr(httpx, "patch", boom)
    monkeypatch.setattr(httpx, "delete", boom)

    gcal._sync_appointment(999)  # must not raise


# ---- _sync_appointment: create / patch / delete branches ----


def test_sync_creates_event_when_none_exists(monkeypatch):
    appointment = _appt(google_event_id=None)
    specialty = SimpleNamespace(name="Ginecologia")
    session = _FakeSession(appointment=appointment, specialty=specialty)

    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    monkeypatch.setattr(gcal, "SessionLocal", lambda: session)
    monkeypatch.setattr(gcal, "connection_status", lambda db: {"connected": True, "email": "a@b.com"})
    monkeypatch.setattr(gcal, "_get_access_token", lambda db: "tok")

    captured = {}

    def fake_post(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        captured["json"] = json
        return _fake_response(200, {"id": "evt-new"})

    monkeypatch.setattr(httpx, "post", fake_post)

    gcal._sync_appointment(1)

    assert appointment.google_event_id == "evt-new"
    assert session.commits == 1
    assert "/events" in captured["url"]


def test_sync_patches_existing_event(monkeypatch):
    appointment = _appt(google_event_id="evt-existing")
    specialty = SimpleNamespace(name="Ginecologia")
    session = _FakeSession(appointment=appointment, specialty=specialty)

    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    monkeypatch.setattr(notifications, "get_settings", lambda: _settings())
    monkeypatch.setattr(gcal, "SessionLocal", lambda: session)
    monkeypatch.setattr(gcal, "connection_status", lambda db: {"connected": True, "email": "a@b.com"})
    monkeypatch.setattr(gcal, "_get_access_token", lambda db: "tok")

    captured = {}

    def fake_patch(url, json=None, headers=None, timeout=None):
        captured["url"] = url
        return _fake_response(200, {"id": "evt-existing"})

    def boom_post(*args, **kwargs):
        raise AssertionError("should not create a new event when one exists")

    monkeypatch.setattr(httpx, "patch", fake_patch)
    monkeypatch.setattr(httpx, "post", boom_post)

    gcal._sync_appointment(1)

    assert appointment.google_event_id == "evt-existing"
    assert session.commits == 1
    assert "evt-existing" in captured["url"]


def test_sync_deletes_event_on_cancellation(monkeypatch):
    appointment = _appt(status="cancelled", google_event_id="evt-to-delete")
    specialty = SimpleNamespace(name="Ginecologia")
    session = _FakeSession(appointment=appointment, specialty=specialty)

    monkeypatch.setattr(gcal, "get_settings", lambda: _settings())
    monkeypatch.setattr(gcal, "SessionLocal", lambda: session)
    monkeypatch.setattr(gcal, "connection_status", lambda db: {"connected": True, "email": "a@b.com"})
    monkeypatch.setattr(gcal, "_get_access_token", lambda db: "tok")

    captured = {}

    def fake_delete(url, headers=None, timeout=None):
        captured["url"] = url
        return _fake_response(204)

    def boom(*args, **kwargs):
        raise AssertionError("should not create/patch when cancelled")

    monkeypatch.setattr(httpx, "delete", fake_delete)
    monkeypatch.setattr(httpx, "post", boom)
    monkeypatch.setattr(httpx, "patch", boom)

    gcal._sync_appointment(1)

    assert appointment.google_event_id is None
    assert session.commits == 1
    assert "evt-to-delete" in captured["url"]


# ---- OAuth state JWT ----


def test_state_round_trip(monkeypatch):
    monkeypatch.setattr(gcal_router, "get_settings", lambda: _settings())
    state = gcal_router._build_state("admin@example.com")
    assert gcal_router._verify_state(state) == "admin@example.com"


def test_state_rejects_tampered(monkeypatch):
    monkeypatch.setattr(gcal_router, "get_settings", lambda: _settings())
    state = gcal_router._build_state("admin@example.com")
    mid = len(state) // 2
    tampered = state[:mid] + ("A" if state[mid] != "A" else "B") + state[mid + 1 :]
    with pytest.raises(HTTPException):
        gcal_router._verify_state(tampered)


def test_state_rejects_expired(monkeypatch):
    monkeypatch.setattr(gcal_router, "get_settings", lambda: _settings())
    settings = _settings()
    expired_payload = {
        "purpose": gcal_router.STATE_PURPOSE,
        "sub": "admin@example.com",
        "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
    }
    expired = jwt.encode(expired_payload, settings.secret_key, algorithm="HS256")
    with pytest.raises(HTTPException):
        gcal_router._verify_state(expired)
