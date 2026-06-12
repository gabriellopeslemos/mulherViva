from datetime import date, datetime, time, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(100), unique=True)
    password_hash: Mapped[str] = mapped_column(String(200))


class Specialty(Base):
    __tablename__ = "specialties"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True)
    slot_duration_min: Mapped[int] = mapped_column(Integer, default=60)
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    rules: Mapped[list["AvailabilityRule"]] = relationship(back_populates="specialty")


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"

    id: Mapped[int] = mapped_column(primary_key=True)
    specialty_id: Mapped[int] = mapped_column(ForeignKey("specialties.id"))
    weekday: Mapped[int] = mapped_column(Integer)  # 0=Mon .. 6=Sun
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    type: Mapped[str] = mapped_column(String(15), default="presencial")  # 'online' | 'presencial'
    active: Mapped[bool] = mapped_column(Boolean, default=True)

    specialty: Mapped[Specialty] = relationship(back_populates="rules")


class AvailabilityOverride(Base):
    __tablename__ = "availability_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    specialty_id: Mapped[int | None] = mapped_column(
        ForeignKey("specialties.id"), nullable=True
    )  # NULL = all specialties
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    kind: Mapped[str] = mapped_column(String(10))  # 'open' | 'block'
    # modality of an extra-open window ('online' | 'presencial'); NULL for blocks
    type: Mapped[str | None] = mapped_column(String(15), nullable=True)
    reason: Mapped[str | None] = mapped_column(String(300), nullable=True)


class Appointment(Base):
    __tablename__ = "appointments"
    __table_args__ = (Index("ix_appointments_date_start", "date", "start_time"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    specialty_id: Mapped[int] = mapped_column(ForeignKey("specialties.id"))
    date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    client_name: Mapped[str] = mapped_column(String(150))
    client_contact: Mapped[str] = mapped_column(String(150))  # phone (primary)
    client_email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    type: Mapped[str] = mapped_column(String(15))  # 'online' | 'presencial'
    status: Mapped[str] = mapped_column(String(15), default="pending")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="public")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    specialty: Mapped[Specialty] = relationship()


class BlogPost(Base):
    __tablename__ = "blog_posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    tag: Mapped[str | None] = mapped_column(String(60), nullable=True)
    source: Mapped[str] = mapped_column(String(10), default="manual")
    instagram_media_id: Mapped[str | None] = mapped_column(
        String(64), unique=True, nullable=True
    )
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    permalink: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
