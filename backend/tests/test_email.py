from datetime import date, time

import httpx

import app.services.email as email_service
from app.services.email import (
    booking_confirmation_html,
    booking_reminder_html,
    format_date_pt,
    format_time_pt,
    marketing_blog_post_html,
    send_booking_confirmation,
    send_booking_reminder,
    send_marketing_blog_post,
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


def test_confirmation_html_includes_optional_links():
    html_out = booking_confirmation_html(
        client_name="Maria",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(9, 0),
        end=time(10, 0),
        modality="online",
        manage_link="https://mulherviva.com.br/?manage=tok123",
        calendar_link="https://calendar.google.com/calendar/render?action=TEMPLATE",
    )
    assert "https://mulherviva.com.br/?manage=tok123" in html_out
    assert "https://calendar.google.com/calendar/render?action=TEMPLATE" in html_out


def test_send_confirmation_attaches_ics(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key="re_test"))
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
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
        modality="online",
        ics="BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n",
    )
    assert ok is True
    assert captured["json"]["attachments"][0]["filename"] == "consulta.ics"


def test_reminder_html_contains_booking_details():
    html_out = booking_reminder_html(
        client_name="Maria Souza",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(14, 0),
        end=time(15, 0),
        modality="online",
        manage_link="https://mulherviva.com.br/?manage=tok123",
    )
    assert "Olá, Maria!" in html_out
    assert "amanhã" in html_out
    assert "quinta-feira, 11 de junho de 2026" in html_out
    assert "https://mulherviva.com.br/?manage=tok123" in html_out


def test_send_reminder_returns_false_without_api_key(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key=""))
    ok = send_booking_reminder(
        to_email="x@y.com",
        client_name="Maria",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(9, 0),
        end=time(10, 0),
        modality="online",
    )
    assert ok is False


def test_send_reminder_posts_to_resend(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key="re_test"))
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    ok = send_booking_reminder(
        to_email="paciente@email.com",
        client_name="Maria",
        specialty_name="Ginecologia",
        day=date(2026, 6, 11),
        start=time(14, 0),
        end=time(15, 0),
        modality="online",
    )
    assert ok is True
    assert "amanhã" in captured["json"]["subject"]


def test_marketing_html_contains_post_details():
    html_out = marketing_blog_post_html(
        title="Menopausa: mitos e verdades",
        excerpt="Descubra o que é fato e o que é mito.",
        post_url="https://mulherviva.com.br/blog/12",
        image_url="https://mulherviva.com.br/uploads/cover.webp",
    )
    assert "Menopausa: mitos e verdades" in html_out
    assert "Descubra o que é fato e o que é mito." in html_out
    assert "https://mulherviva.com.br/blog/12" in html_out
    assert "https://mulherviva.com.br/uploads/cover.webp" in html_out


def test_marketing_html_omits_image_when_absent():
    html_out = marketing_blog_post_html(
        title="Título",
        excerpt="Resumo",
        post_url="https://mulherviva.com.br/blog/12",
    )
    assert "<img" not in html_out


def test_marketing_html_escapes_user_input():
    html_out = marketing_blog_post_html(
        title="<script>alert(1)</script>",
        excerpt="Resumo",
        post_url="https://mulherviva.com.br/blog/12",
    )
    assert "<script>" not in html_out
    assert "&lt;script&gt;" in html_out


def test_send_marketing_blog_post_returns_false_without_api_key(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key=""))
    ok = send_marketing_blog_post(
        to_email="x@y.com",
        title="Título",
        excerpt="Resumo",
        post_url="https://mulherviva.com.br/blog/12",
    )
    assert ok is False


def test_send_marketing_blog_post_posts_to_resend(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key="re_test"))
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    ok = send_marketing_blog_post(
        to_email="paciente@email.com",
        title="Menopausa: mitos e verdades",
        excerpt="Resumo do post.",
        post_url="https://mulherviva.com.br/blog/12",
        subject="Novo post no blog!",
    )
    assert ok is True
    assert captured["json"]["to"] == ["paciente@email.com"]
    assert captured["json"]["subject"] == "Novo post no blog!"
    assert "Menopausa: mitos e verdades" in captured["json"]["html"]


def test_send_marketing_blog_post_defaults_subject_to_title(monkeypatch):
    monkeypatch.setattr(email_service, "get_settings", lambda: _settings(api_key="re_test"))
    captured = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        captured["json"] = json
        return httpx.Response(200, request=httpx.Request("POST", url))

    monkeypatch.setattr(httpx, "post", fake_post)
    send_marketing_blog_post(
        to_email="paciente@email.com",
        title="Menopausa: mitos e verdades",
        excerpt="Resumo do post.",
        post_url="https://mulherviva.com.br/blog/12",
    )
    assert captured["json"]["subject"] == "Menopausa: mitos e verdades"
