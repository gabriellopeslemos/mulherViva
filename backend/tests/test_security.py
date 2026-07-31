"""Regression tests for the production-hardening behaviour."""

import pytest

from app.config import ConfigurationError, Settings


def _prod_settings(**overrides) -> Settings:
    base = {
        "environment": "production",
        "secret_key": "a" * 64,
        "google_client_id": "client-id.apps.googleusercontent.com",
        "allowed_admin_emails": "admin@example.com",
        "cors_origins": "https://mulherviva.com.br",
        "public_base_url": "https://mulherviva.com.br",
        "notifications_enabled": False,
    }
    base.update(overrides)
    return Settings(**base)


def test_valid_production_config_passes():
    _prod_settings().validate_for_production()


def test_development_config_is_never_blocked():
    # Every default is permissive; that is only acceptable outside production.
    Settings(environment="development").validate_for_production()


@pytest.mark.parametrize(
    "overrides, expected",
    [
        ({"secret_key": "dev-secret-change-me"}, "SECRET_KEY"),
        ({"secret_key": "short"}, "SECRET_KEY"),
        ({"google_client_id": ""}, "GOOGLE_CLIENT_ID"),
        ({"allowed_admin_emails": ""}, "ALLOWED_ADMIN_EMAILS"),
        ({"cors_origins": "*"}, "CORS_ORIGINS"),
        ({"cors_origins": "http://mulherviva.com.br"}, "HTTPS"),
        ({"public_base_url": "http://mulherviva.com.br"}, "PUBLIC_BASE_URL"),
        (
            {"notifications_enabled": True, "smtp_host": ""},
            "SMTP_HOST",
        ),
    ],
)
def test_unsafe_production_config_refuses_to_boot(overrides, expected):
    with pytest.raises(ConfigurationError) as exc:
        _prod_settings(**overrides).validate_for_production()
    assert expected in str(exc.value)


def test_contact_inbox_falls_back_to_first_admin():
    settings = Settings(allowed_admin_emails="a@example.com,b@example.com")
    assert settings.contact_inbox == "a@example.com"
    assert Settings(contact_email="x@example.com").contact_inbox == "x@example.com"


def test_unknown_timezone_falls_back_instead_of_crashing():
    assert Settings(timezone="Not/AZone").tzinfo.key == "America/Sao_Paulo"


def test_security_headers_present_on_api_responses(client):
    response = client.get("/api/specialties")
    assert response.status_code == 200
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["Cache-Control"] == "no-store"
    assert "frame-ancestors 'none'" in response.headers["Content-Security-Policy"]


def test_admin_routes_require_authentication(client):
    for path in (
        "/api/admin/appointments",
        "/api/admin/waitlist",
        "/api/admin/settings",
        "/api/admin/contact-messages",
    ):
        assert client.get(path).status_code == 401, path


def test_admin_token_for_unlisted_email_is_rejected(client):
    from app.auth import create_access_token

    # A structurally valid token is not enough: the address must still be on
    # the allowlist at request time, so removing an admin revokes access.
    token = create_access_token("stranger@example.com")
    response = client.get(
        "/api/admin/appointments", headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 401


def test_admin_routes_accept_valid_token(client, admin_headers):
    assert client.get("/api/admin/appointments", headers=admin_headers).status_code == 200


def test_blog_image_url_rejects_javascript_scheme(client, admin_headers):
    response = client.post(
        "/api/admin/blog",
        headers=admin_headers,
        json={
            "title": "XSS",
            "body": "corpo",
            "image_url": "javascript:alert(document.cookie)",
        },
    )
    assert response.status_code == 422


def test_blog_body_length_is_bounded(client, admin_headers):
    response = client.post(
        "/api/admin/blog",
        headers=admin_headers,
        json={"title": "Grande", "body": "x" * 50_000},
    )
    assert response.status_code == 422


def test_mail_headers_strip_newlines():
    """A newline in a header value would let a sender append their own headers
    (e.g. Bcc) to the outgoing message."""
    from app.services.notifications import _header_safe

    injected = _header_safe("Ana\r\nBcc: attacker@evil.com")
    assert "\r" not in injected and "\n" not in injected
    assert injected == "Ana  Bcc: attacker@evil.com"
    assert "\n" not in _header_safe("linha1\nlinha2")
