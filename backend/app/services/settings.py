"""Small key/value helpers over the AppSetting table."""

from sqlalchemy.orm import Session

from ..models import AppSetting

_TRUE = {"1", "true", "yes", "on"}


def get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.get(AppSetting, key)
    return row.value if row is not None else default


def get_bool_setting(db: Session, key: str, default: bool = False) -> bool:
    value = get_setting(db, key)
    if value is None:
        return default
    return value.strip().lower() in _TRUE


def get_int_setting(db: Session, key: str, default: int = 0) -> int:
    value = get_setting(db, key)
    if value is None:
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def set_setting(db: Session, key: str, value: str) -> None:
    row = db.get(AppSetting, key)
    if row is None:
        db.add(AppSetting(key=key, value=value))
    else:
        row.value = value
    db.commit()
