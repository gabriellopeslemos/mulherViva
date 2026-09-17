from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 720
    google_client_id: str = ""
    google_client_secret: str = ""
    google_oauth_redirect_uri: str = "http://localhost:8000/api/auth/google-calendar/callback"
    timezone: str = "America/Sao_Paulo"
    allowed_admin_emails: str = ""
    # Dev only: enables /api/auth/dev-login, which issues an admin token
    # without Google. Must stay false in production.
    dev_auth_bypass: bool = False
    database_url: str = "sqlite:///./mulherviva.db"
    cors_origins: str = "http://localhost:5173"
    ig_access_token: str = ""
    ig_auto_sync: bool = False
    min_booking_lead_hours: int = 2
    # ---- booking policy defaults (overridable via admin settings) ----
    buffer_minutes: int = 0
    cancellation_window_hours: int = 12
    max_booking_advance_days: int = 60

    # ---- e-mail / notifications ----
    notifications_enabled: bool = False
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_tls: bool = True
    # Confirmation and 24h-reminder e-mails are sent via Resend.
    resend_api_key: str = ""
    email_from: str = "Mulher Viva <no-reply@mulherviva.com.br>"
    public_base_url: str = "http://localhost:5173"
    clinic_name: str = "Mulher Viva — Dra. Luciana Lopes"
    clinic_address: str = "Centro Médico Lúcio Costa"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_admin_emails_list(self) -> list[str]:
        return [
            e.strip().lower()
            for e in self.allowed_admin_emails.split(",")
            if e.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
