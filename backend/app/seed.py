from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_settings
from .models import AppSetting, Specialty

SPECIALTIES = [
    ("Ginecologia Integrativa", "ginecologia-integrativa"),
    ("Obstetrícia Humanizada", "obstetricia-humanizada"),
    ("Homeopatia Clínica", "homeopatia-clinica"),
]


def seed(db: Session) -> None:
    settings = get_settings()

    for name, slug in SPECIALTIES:
        if db.scalar(select(Specialty).where(Specialty.slug == slug)) is None:
            db.add(Specialty(name=name, slug=slug, slot_duration_min=60, active=True))

    if settings.ig_access_token and db.get(AppSetting, "ig_access_token") is None:
        db.add(AppSetting(key="ig_access_token", value=settings.ig_access_token))

    db.commit()
