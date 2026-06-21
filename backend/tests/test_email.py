from datetime import date, time

import httpx

import app.services.email as email_service
from app.services.email import (
    booking_confirmation_html,
    format_date_pt,
    format_time_pt,
    send_booking_confirmation,
)


def test_format_date_pt():
    assert format_date_pt(date(2026, 6, 11)) == "quinta-feira, 11 de junho de 2026"


def test_format_date_pt_sunday():
    assert format_date_pt(date(2026, 6, 14)) == "domingo, 14 de junho de 2026"


def test_format_date_pt_march_cedilla():
    assert format_date_pt(date(2026, 3, 2)) == "segunda-feira, 2 de março de 2026"


def test_format_time_pt():
    assert format_time_pt(time(9, 0)) == "09:00"
    assert format_time_pt(time(14, 30)) == "14:30"


def test_html_contains_booking_details():
    html_out = booking_confirmation_html(
        client_name="Maria Souza",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(14, 0),
        end=time(15, 0),
        modality="online",
    )
    assert "Olá, Maria!" in html_out
    assert "quinta-feira, 11 de junho de 2026" in html_out
    assert "14:00 &ndash; 15:00" in html_out
    assert "Ginecologia" in html_out
    assert "Online" in html_out
    assert "Mulher Viva" in html_out


def test_html_presencial_includes_address_when_configured():
    html_out = booking_confirmation_html(
        client_name="Maria",
        specialty_name="Nutrição",
        day=date(2026, 6, 11),
        start=time(9, 0),
        end=time(10, 0),
        modality="presencial",
        clinic_address="Rua das Flores, 123 - Centro",
    )
    assert "Presencial" in html_out
    assert "Rua das Flores, 123 - Centro" in html_out


def test_html_online_omits_address():
    html_out = booking_confirmation_html(
        client_name="Maria",
        specialty_name="Nutrição",
        day=date(2026, 6, 11),
        start=time(9, 0),
        end=time(10, 0),
        modality="online",
        clinic_address="Rua das Flores, 123 - Centro",
    )
    assert "Rua das Flores" not in html_out


def test_html_escapes_user_input():
    html_out = booking_confirmation_html(
        client_name="<script>alert(1)</script>",
        specialty_name="Gineco & Obstetrícia <b>",
        day=date(2026, 6, 11),
        start=time(9, 0),
        end=time(10, 0),
        modality="online",
    )
    assert "<script>" not in html_out
    assert "&lt;script&gt;" in html_out
    assert "Gineco &amp; Obstetrícia" in html_out


def _settings(api_key=""):
    from types import SimpleNamespace

    return SimpleNamespace(
        resend_api_key=api_key,
        email_from="Mulher Viva <onboarding@resend.dev>",
        clinic_address="",
    )


def test_send_returns_false_without_api_key(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key=""))
    ok = send_booking_confirmation(
        to_email="x@y.com",
        client_name="Maria",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(9, 0),
        end=time(10, 0),
        modality="online",
    )
    assert ok is False


def test_send_swallows_http_errors(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key="re_test"))

    def boom(*args, **kwargs):
        raise httpx.ConnectError("offline")

    monkeypatch.setattr(httpx, "post", boom)
    ok = send_booking_confirmation(
        to_email="x@y.com",
        client_name="Maria",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(9, 0),
        end=time(10, 0),
        modality="online",
    )
    assert ok is False


def test_send_posts_to_resend(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key="re_test"))
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["url"] = url
        captured["headers"] = headers
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    ok = send_booking_confirmation(
        to_email="paciente@email.com",
        client_name="Maria",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(14, 0),
        end=time(15, 0),
        modality="presencial",
    )
    assert ok is True
    assert captured["url"] == email_service.RESEND_API_URL
    assert captured["headers"]["Authorization"] == "Bearer re_test"
    assert captured["json"]["to"] == ["paciente@email.com"]
    assert "quinta-feira, 11 de junho de 2026" in captured["json"]["subject"]
    assert "Presencial" in captured["json"]["html"]
