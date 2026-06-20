from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    secret_key: str = "dev-secret-change-me"
    access_token_expire_minutes: int = 720
    admin_username: str = "admin"
    admin_password: str = "admin"
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
    email_from: str = "Mulher Viva <no-reply@mulherviva.com.br>"
    public_base_url: str = "http://localhost:5173"
    clinic_name: str = "Mulher Viva — Dra. Luciana Lopes"
    clinic_address: str = "Centro Médico Lúcio Costa"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
