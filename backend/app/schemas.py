from datetime import date as date_type, datetime, time

from pydantic import BaseModel, ConfigDict, Field


# ---- auth ----

class GoogleLoginRequest(BaseModel):
    credential: str = Field(max_length=4096)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    email: str


# ---- specialties ----

class SpecialtyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    slot_duration_min: int
    active: bool


class SpecialtyUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=120)
    slot_duration_min: int | None = Field(default=None, ge=10, le=240)
    active: bool | None = None


# ---- availability ----

class AvailabilityRuleIn(BaseModel):
    specialty_id: int
    weekday: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    active: bool = True


class AvailabilityRuleUpdate(BaseModel):
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    active: bool | None = None


class AvailabilityRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty_id: int
    weekday: int
    start_time: time
    end_time: time
    active: bool


class AvailabilityOverrideIn(BaseModel):
    specialty_id: int | None = None
    date: date_type
    start_time: time | None = None
    end_time: time | None = None
    kind: str = Field(pattern="^(open|block)$")
    reason: str | None = Field(default=None, max_length=300)


class AvailabilityOverrideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty_id: int | None
    date: date_type
    start_time: time | None
    end_time: time | None
    kind: str
    reason: str | None


# ---- slots ----

class SlotOut(BaseModel):
    start: time
    end: time


class SlotsDayOut(BaseModel):
    date: date_type
    slots: list[SlotOut]


class SlotsResponse(BaseModel):
    days: list[SlotsDayOut]


# ---- bookings / appointments ----

EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
STATUS_RE = "^(pending|confirmed|cancelled|completed|no_show)$"


class BookingIn(BaseModel):
    specialty_id: int
    date: date_type
    start: time
    type: str = Field(pattern="^(online|presencial)$")
    client_name: str = Field(min_length=2, max_length=150)
    client_email: str = Field(pattern=EMAIL_RE, max_length=150)
    client_phone: str = Field(min_length=8, max_length=40)
    reason: str | None = Field(default=None, max_length=500)
    is_first_visit: bool = False
    notes: str | None = Field(default=None, max_length=1000)


class AppointmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty_id: int
    date: date_type
    start_time: time
    end_time: time
    client_name: str
    client_contact: str
    client_email: str | None
    client_phone: str | None
    type: str
    status: str
    notes: str | None
    reason: str | None
    is_first_visit: bool
    source: str
    token: str | None
    created_at: datetime


class AppointmentIn(BaseModel):
    specialty_id: int
    date: date_type
    start_time: time
    end_time: time
    client_name: str = Field(min_length=2, max_length=150)
    client_contact: str = Field(default="", max_length=150)
    client_email: str | None = Field(default=None, max_length=150)
    client_phone: str | None = Field(default=None, max_length=40)
    type: str = Field(pattern="^(online|presencial)$")
    status: str = Field(default="confirmed", pattern=STATUS_RE)
    notes: str | None = Field(default=None, max_length=1000)
    reason: str | None = Field(default=None, max_length=500)
    is_first_visit: bool = False
    force: bool = False


class AppointmentUpdate(BaseModel):
    specialty_id: int | None = None
    date: date_type | None = None
    start_time: time | None = None
    end_time: time | None = None
    client_name: str | None = Field(default=None, min_length=2, max_length=150)
    client_contact: str | None = Field(default=None, max_length=150)
    client_email: str | None = Field(default=None, max_length=150)
    client_phone: str | None = Field(default=None, max_length=40)
    type: str | None = Field(default=None, pattern="^(online|presencial)$")
    status: str | None = Field(default=None, pattern=STATUS_RE)
    notes: str | None = Field(default=None, max_length=1000)
    reason: str | None = Field(default=None, max_length=500)
    is_first_visit: bool | None = None
    force: bool = False


# ---- patient self-service (manage by token) ----

class ManageAppointmentOut(BaseModel):
    specialty_name: str
    date: date_type
    start_time: time
    end_time: time
    type: str
    status: str
    client_name: str
    can_modify: bool
    cancellation_window_hours: int


class RescheduleIn(BaseModel):
    date: date_type
    start: time


# ---- waitlist ----

class WaitlistIn(BaseModel):
    specialty_id: int
    client_name: str = Field(min_length=2, max_length=150)
    client_email: str = Field(pattern=EMAIL_RE, max_length=150)
    client_phone: str | None = Field(default=None, max_length=40)
    preferred_date: date_type | None = None
    notes: str | None = Field(default=None, max_length=500)


class WaitlistOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty_id: int
    client_name: str
    client_email: str
    client_phone: str | None
    preferred_date: date_type | None
    notes: str | None
    active: bool
    notified_at: datetime | None
    created_at: datetime


# ---- settings ----

class SettingsOut(BaseModel):
    auto_confirm_bookings: bool
    buffer_minutes: int
    cancellation_window_hours: int
    max_booking_advance_days: int


class SettingsUpdate(BaseModel):
    auto_confirm_bookings: bool | None = None
    buffer_minutes: int | None = Field(default=None, ge=0, le=240)
    cancellation_window_hours: int | None = Field(default=None, ge=0, le=336)
    max_booking_advance_days: int | None = Field(default=None, ge=1, le=365)


# ---- blog ----

class BlogPostIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str
    tag: str | None = Field(default=None, max_length=60)
    image_url: str | None = None
    published_at: datetime | None = None


class BlogPostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    tag: str | None = Field(default=None, max_length=60)
    image_url: str | None = None
    published_at: datetime | None = None


class BlogPostListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    excerpt: str
    tag: str | None
    source: str
    image_url: str | None
    permalink: str | None
    published_at: datetime


class BlogPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    body: str
    tag: str | None
    source: str
    image_url: str | None
    permalink: str | None
    published_at: datetime


class BlogListResponse(BaseModel):
    total: int
    items: list[BlogPostListItem]


# ---- instagram ----

class InstagramSyncResult(BaseModel):
    fetched: int
    created: int
    skipped: int
    token_refreshed: bool
    error: str | None = None
