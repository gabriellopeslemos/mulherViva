from datetime import date as date_type, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ---- auth ----

class LoginRequest(BaseModel):
    username: str = Field(max_length=100)
    password: str = Field(max_length=200)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class MeResponse(BaseModel):
    username: str


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
    type: str = Field(pattern="^(online|presencial)$")
    active: bool = True


class AvailabilityRuleUpdate(BaseModel):
    weekday: int | None = Field(default=None, ge=0, le=6)
    start_time: time | None = None
    end_time: time | None = None
    type: str | None = Field(default=None, pattern="^(online|presencial)$")
    active: bool | None = None


class AvailabilityRuleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty_id: int
    weekday: int
    start_time: time
    end_time: time
    type: str
    active: bool


class AvailabilityOverrideIn(BaseModel):
    specialty_id: int | None = None
    date: date_type
    start_time: time | None = None
    end_time: time | None = None
    kind: str = Field(pattern="^(open|block)$")
    type: str | None = Field(default=None, pattern="^(online|presencial)$")
    reason: str | None = Field(default=None, max_length=300)


class AvailabilityOverrideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    specialty_id: int | None
    date: date_type
    start_time: time | None
    end_time: time | None
    kind: str
    type: str | None
    reason: str | None


# ---- slots ----

class SlotOut(BaseModel):
    start: time
    end: time
    type: str


class SlotsDayOut(BaseModel):
    date: date_type
    slots: list[SlotOut]


class SlotsResponse(BaseModel):
    days: list[SlotsDayOut]


# ---- bookings / appointments ----

class BookingIn(BaseModel):
    specialty_id: int
    date: date_type
    start: time
    type: str = Field(pattern="^(online|presencial)$")
    client_name: str = Field(min_length=2, max_length=150)
    client_contact: str = Field(min_length=5, max_length=150)
    client_email: EmailStr = Field(max_length=150)
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
    type: str
    status: str
    notes: str | None
    source: str
    created_at: datetime


class AppointmentIn(BaseModel):
    specialty_id: int
    date: date_type
    start_time: time
    end_time: time
    client_name: str = Field(min_length=2, max_length=150)
    client_contact: str = Field(default="", max_length=150)
    client_email: str | None = Field(default=None, max_length=150)
    type: str = Field(pattern="^(online|presencial)$")
    status: str = Field(default="confirmed", pattern="^(pending|confirmed|cancelled)$")
    notes: str | None = Field(default=None, max_length=1000)
    force: bool = False


class AppointmentUpdate(BaseModel):
    specialty_id: int | None = None
    date: date_type | None = None
    start_time: time | None = None
    end_time: time | None = None
    client_name: str | None = Field(default=None, min_length=2, max_length=150)
    client_contact: str | None = Field(default=None, max_length=150)
    client_email: str | None = Field(default=None, max_length=150)
    type: str | None = Field(default=None, pattern="^(online|presencial)$")
    status: str | None = Field(default=None, pattern="^(pending|confirmed|cancelled)$")
    notes: str | None = Field(default=None, max_length=1000)
    force: bool = False


# ---- blog ----

class BlogPostIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body: str
    tag: str | None = Field(default=None, max_length=60)
    image_url: str | None = None
    pinned: bool = False
    published_at: datetime | None = None


class BlogPostUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    tag: str | None = Field(default=None, max_length=60)
    image_url: str | None = None
    pinned: bool | None = None
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
    pinned: bool
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
    pinned: bool
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
