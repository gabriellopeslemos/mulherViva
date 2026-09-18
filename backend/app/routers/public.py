import re
import secrets
from datetime import date as date_type
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Appointment, BlogPost, Specialty, WaitlistEntry
from ..schemas import (
    AppointmentOut,
    BlogListResponse,
    BlogPostListItem,
    BlogPostOut,
    BookingIn,
    ManageAppointmentOut,
    RecoverBookingIn,
    RecoverBookingOut,
    RescheduleIn,
    SlotOut,
    SlotsDayOut,
    SlotsResponse,
    SpecialtyOut,
    WaitlistIn,
    WaitlistOut,
)
from ..services import google_calendar, notifications, waitlist
from ..services.settings import get_bool_setting, get_int_setting
from ..services.slots import get_available_slots, has_overlap

router = APIRouter(prefix="/api", tags=["public"])

MAX_PENDING_PER_CONTACT_PER_DAY = 3

# "Quero reagendar": how many link re-sends one e-mail address may trigger per
# hour. In-process only (resets on restart), which is enough to stop a form
# being used to flood someone's inbox.
MAX_RECOVER_PER_EMAIL_PER_HOUR = 3
_recover_attempts: dict[str, list[datetime]] = {}
RECOVER_MESSAGE = (
    "Se houver uma consulta futura com esse e-mail, enviamos o link para "
    "reagendar ou cancelar. Confira também a caixa de spam."
)


def _recover_rate_limited(email: str, now: datetime) -> bool:
    cutoff = now - timedelta(hours=1)
    attempts = [t for t in _recover_attempts.get(email, []) if t > cutoff]
    limited = len(attempts) >= MAX_RECOVER_PER_EMAIL_PER_HOUR
    if not limited:
        attempts.append(now)
    _recover_attempts[email] = attempts
    return limited


def _appt_snapshot(appointment: Appointment, specialty_name: str) -> dict:
    return {
        "client_name": appointment.client_name,
        "client_email": appointment.client_email,
        "client_phone": appointment.client_phone,
        "date": appointment.date,
        "start_time": appointment.start_time,
        "end_time": appointment.end_time,
        "type": appointment.type,
        "specialty_name": specialty_name,
        "token": appointment.token,
        "is_first_visit": appointment.is_first_visit,
        "reason": appointment.reason,
        "notes": appointment.notes,
    }


def _cancellation_window_hours(db: Session) -> int:
    return get_int_setting(
        db,
        "cancellation_window_hours",
        get_settings().cancellation_window_hours,
    )


def _can_modify(appointment: Appointment, window_hours: int) -> bool:
    if appointment.status in ("cancelled", "completed", "no_show"):
        return False
    start_dt = datetime.combine(appointment.date, appointment.start_time)
    return datetime.now() <= start_dt - timedelta(hours=window_hours)


@router.get("/specialties", response_model=list[SpecialtyOut])
def list_specialties(db: Session = Depends(get_db)):
    return list(
        db.scalars(select(Specialty).where(Specialty.active == True))  # noqa: E712
    )


@router.get("/slots", response_model=SlotsResponse)
def available_slots(
    specialty_id: int,
    date_from: date_type = Query(...),
    date_to: date_type = Query(...),
    db: Session = Depends(get_db),
):
    if date_to < date_from:
        raise HTTPException(status_code=422, detail="date_to anterior a date_from")
    specialty = db.get(Specialty, specialty_id)
    if specialty is None or not specialty.active:
        raise HTTPException(status_code=404, detail="Especialidade nao encontrada")
    slots_by_day = get_available_slots(db, specialty, date_from, date_to)
    return SlotsResponse(
        days=[
            SlotsDayOut(
                date=day,
                slots=[SlotOut(start=s, end=e, location=loc) for s, e, loc in slots],
            )
            for day, slots in slots_by_day.items()
        ]
    )


@router.post(
    "/bookings", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED
)
def create_booking(body: BookingIn, db: Session = Depends(get_db)):
    specialty = db.get(Specialty, body.specialty_id)
    if specialty is None or not specialty.active:
        raise HTTPException(status_code=404, detail="Especialidade nao encontrada")

    pending_today = db.scalar(
        select(func.count(Appointment.id)).where(
            Appointment.client_contact == body.client_phone,
            Appointment.status == "pending",
            func.date(Appointment.created_at) == datetime.utcnow().date(),
        )
    )
    if pending_today >= MAX_PENDING_PER_CONTACT_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail="Limite de agendamentos pendentes atingido para este contato",
        )

    day_slots = get_available_slots(db, specialty, body.date, body.date).get(
        body.date, []
    )
    slot = next(
        ((s, e) for s, e, loc in day_slots if s == body.start and loc == body.type),
        None,
    )
    if slot is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Horario indisponivel",
        )
    start, end = slot

    if has_overlap(db, body.date, start, end):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Horario indisponivel"
        )

    auto_confirm = get_bool_setting(db, "auto_confirm_bookings", False)
    appointment = Appointment(
        specialty_id=specialty.id,
        date=body.date,
        start_time=start,
        end_time=end,
        client_name=body.client_name,
        client_contact=body.client_phone,
        client_email=body.client_email,
        client_phone=body.client_phone,
        type=body.type,
        status="confirmed" if auto_confirm else "pending",
        notes=body.notes,
        reason=body.reason,
        is_first_visit=body.is_first_visit,
        token=secrets.token_urlsafe(24),
        source="public",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    google_calendar.schedule_sync(appointment.id)

    snapshot = _appt_snapshot(appointment, specialty.name)
    if auto_confirm:
        notifications.notify_booking_confirmed(snapshot)
    else:
        notifications.notify_booking_received(snapshot)
    notifications.notify_internal_new_booking(snapshot)

    return appointment


def _load_by_token(db: Session, token: str) -> Appointment:
    appointment = db.scalar(select(Appointment).where(Appointment.token == token))
    if appointment is None:
        raise HTTPException(status_code=404, detail="Agendamento nao encontrado")
    return appointment


@router.get("/bookings/manage/{token}", response_model=ManageAppointmentOut)
def get_managed_booking(token: str, db: Session = Depends(get_db)):
    appointment = _load_by_token(db, token)
    specialty = db.get(Specialty, appointment.specialty_id)
    window = _cancellation_window_hours(db)
    return ManageAppointmentOut(
        specialty_name=specialty.name if specialty else "",
        date=appointment.date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        type=appointment.type,
        status=appointment.status,
        client_name=appointment.client_name,
        can_modify=_can_modify(appointment, window),
        cancellation_window_hours=window,
    )


@router.post("/bookings/manage/{token}/cancel", response_model=ManageAppointmentOut)
def cancel_managed_booking(token: str, db: Session = Depends(get_db)):
    appointment = _load_by_token(db, token)
    window = _cancellation_window_hours(db)
    if appointment.status == "cancelled":
        raise HTTPException(status_code=409, detail="Consulta ja cancelada")
    if not _can_modify(appointment, window):
        raise HTTPException(
            status_code=422,
            detail=f"Cancelamento permitido ate {window}h antes da consulta. "
            "Entre em contato conosco.",
        )
    appointment.status = "cancelled"
    db.commit()
    db.refresh(appointment)
    google_calendar.schedule_sync(appointment.id)

    specialty = db.get(Specialty, appointment.specialty_id)
    notifications.notify_booking_cancelled(
        _appt_snapshot(appointment, specialty.name if specialty else "")
    )
    waitlist.notify_next(db, appointment.specialty_id, appointment.date)

    return ManageAppointmentOut(
        specialty_name=specialty.name if specialty else "",
        date=appointment.date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        type=appointment.type,
        status=appointment.status,
        client_name=appointment.client_name,
        can_modify=False,
        cancellation_window_hours=window,
    )


@router.get("/bookings/manage/{token}/slots", response_model=SlotsResponse)
def managed_booking_slots(
    token: str,
    date_from: date_type = Query(...),
    date_to: date_type = Query(...),
    db: Session = Depends(get_db),
):
    appointment = _load_by_token(db, token)
    if date_to < date_from:
        raise HTTPException(status_code=422, detail="date_to anterior a date_from")
    specialty = db.get(Specialty, appointment.specialty_id)
    if specialty is None or not specialty.active:
        raise HTTPException(status_code=404, detail="Especialidade nao encontrada")
    slots_by_day = get_available_slots(
        db, specialty, date_from, date_to, exclude_appointment_id=appointment.id
    )
    return SlotsResponse(
        days=[
            SlotsDayOut(
                date=day,
                slots=[SlotOut(start=s, end=e, location=loc) for s, e, loc in slots],
            )
            for day, slots in slots_by_day.items()
        ]
    )


@router.post("/bookings/manage/{token}/reschedule", response_model=ManageAppointmentOut)
def reschedule_managed_booking(
    token: str, body: RescheduleIn, db: Session = Depends(get_db)
):
    appointment = _load_by_token(db, token)
    window = _cancellation_window_hours(db)
    if not _can_modify(appointment, window):
        raise HTTPException(
            status_code=422,
            detail=f"Reagendamento permitido ate {window}h antes da consulta. "
            "Entre em contato conosco.",
        )
    specialty = db.get(Specialty, appointment.specialty_id)
    if specialty is None or not specialty.active:
        raise HTTPException(status_code=404, detail="Especialidade nao encontrada")

    day_slots = get_available_slots(
        db, specialty, body.date, body.date, exclude_appointment_id=appointment.id
    ).get(body.date, [])
    slot = next(
        ((s, e) for s, e, loc in day_slots if s == body.start and loc == appointment.type),
        None,
    )
    if slot is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Horario indisponivel")
    start, end = slot
    if has_overlap(db, body.date, start, end, exclude_id=appointment.id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Horario indisponivel")

    freed_date = appointment.date
    appointment.date = body.date
    appointment.start_time = start
    appointment.end_time = end
    db.commit()
    db.refresh(appointment)
    google_calendar.schedule_sync(appointment.id)

    snapshot = _appt_snapshot(appointment, specialty.name)
    if appointment.status == "confirmed":
        notifications.notify_booking_confirmed(snapshot)
    # the previously held slot may interest the waitlist
    waitlist.notify_next(db, appointment.specialty_id, freed_date)

    return ManageAppointmentOut(
        specialty_name=specialty.name,
        date=appointment.date,
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        type=appointment.type,
        status=appointment.status,
        client_name=appointment.client_name,
        can_modify=_can_modify(appointment, window),
        cancellation_window_hours=window,
    )


@router.post("/bookings/recover", response_model=RecoverBookingOut)
def recover_booking_links(body: RecoverBookingIn, db: Session = Depends(get_db)):
    """Re-sends the manage link(s) for every upcoming appointment of an e-mail.

    Always answers the same message, whether or not the e-mail is known, so the
    form can't be used to check who is a patient.
    """
    email = body.email.strip().lower()
    if _recover_rate_limited(email, datetime.now()):
        return RecoverBookingOut(message=RECOVER_MESSAGE)

    today = datetime.now().date()
    appointments = db.scalars(
        select(Appointment)
        .where(
            func.lower(Appointment.client_email) == email,
            Appointment.date >= today,
            Appointment.status.in_(("pending", "confirmed")),
            Appointment.token.is_not(None),
        )
        .order_by(Appointment.date, Appointment.start_time)
    ).all()

    if appointments:
        snapshots = []
        for appointment in appointments:
            specialty = db.get(Specialty, appointment.specialty_id)
            snapshots.append(
                _appt_snapshot(appointment, specialty.name if specialty else "")
            )
        notifications.notify_booking_links(
            appointments[0].client_email, appointments[0].client_name, snapshots
        )

    return RecoverBookingOut(message=RECOVER_MESSAGE)


@router.post("/waitlist", response_model=WaitlistOut, status_code=status.HTTP_201_CREATED)
def join_waitlist(body: WaitlistIn, response: Response, db: Session = Depends(get_db)):
    specialty = db.get(Specialty, body.specialty_id)
    if specialty is None or not specialty.active:
        raise HTTPException(status_code=404, detail="Especialidade nao encontrada")
    existing = db.scalar(
        select(WaitlistEntry).where(
            WaitlistEntry.specialty_id == body.specialty_id,
            WaitlistEntry.client_email == body.client_email,
            WaitlistEntry.active == True,  # noqa: E712
        )
    )
    if existing is not None:
        # Already on the list — report 200 instead of a misleading 201 Created.
        response.status_code = status.HTTP_200_OK
        return existing
    entry = WaitlistEntry(**body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def _excerpt(body: str, limit: int = 180) -> str:
    text = re.sub(r"!\[[^\]]*\]\([^)]*\)", "", body)
    text = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text)
    text = re.sub(r"[*_`>#]", "", text)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 3] + "..."


@router.get("/blog", response_model=BlogListResponse)
def list_blog(
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    published = BlogPost.status == "published"
    total = db.scalar(select(func.count(BlogPost.id)).where(published))
    posts = db.scalars(
        select(BlogPost)
        .where(published)
        .order_by(BlogPost.pinned.desc(), BlogPost.published_at.desc())
        .limit(limit)
        .offset(offset)
    )
    items = [
        BlogPostListItem(
            id=p.id,
            title=p.title,
            excerpt=_excerpt(p.body),
            tag=p.tag,
            source=p.source,
            image_url=p.image_url,
            permalink=p.permalink,
            status=p.status,
            pinned=p.pinned,
            published_at=p.published_at,
        )
        for p in posts
    ]
    return BlogListResponse(total=total, items=items)


@router.get("/blog/{post_id}", response_model=BlogPostOut)
def get_blog_post(post_id: int, db: Session = Depends(get_db)):
    post = db.get(BlogPost, post_id)
    if post is None or post.status != "published":
        raise HTTPException(status_code=404, detail="Post nao encontrado")
    return post
