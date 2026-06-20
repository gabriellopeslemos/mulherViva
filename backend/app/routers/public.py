import secrets
from datetime import date as date_type
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    RescheduleIn,
    SlotOut,
    SlotsDayOut,
    SlotsResponse,
    SpecialtyOut,
    WaitlistIn,
    WaitlistOut,
)
from ..services import notifications, waitlist
from ..services.settings import get_bool_setting, get_int_setting
from ..services.slots import get_available_slots, has_overlap

router = APIRouter(prefix="/api", tags=["public"])

MAX_PENDING_PER_CONTACT_PER_DAY = 3


def _appt_snapshot(appointment: Appointment, specialty_name: str) -> dict:
    return {
        "client_name": appointment.client_name,
        "client_email": appointment.client_email,
        "date": appointment.date,
        "start_time": appointment.start_time,
        "end_time": appointment.end_time,
        "type": appointment.type,
        "specialty_name": specialty_name,
        "token": appointment.token,
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
            SlotsDayOut(date=day, slots=[SlotOut(start=s, end=e) for s, e in slots])
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
    slot = next(((s, e) for s, e in day_slots if s == body.start), None)
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

    snapshot = _appt_snapshot(appointment, specialty.name)
    if auto_confirm:
        notifications.notify_booking_confirmed(snapshot)
    else:
        notifications.notify_booking_received(snapshot)

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
    slots_by_day = get_available_slots(db, specialty, date_from, date_to)
    return SlotsResponse(
        days=[
            SlotsDayOut(date=day, slots=[SlotOut(start=s, end=e) for s, e in slots])
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

    day_slots = get_available_slots(db, specialty, body.date, body.date).get(body.date, [])
    slot = next(((s, e) for s, e in day_slots if s == body.start), None)
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


@router.post("/waitlist", response_model=WaitlistOut, status_code=status.HTTP_201_CREATED)
def join_waitlist(body: WaitlistIn, db: Session = Depends(get_db)):
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
        return existing
    entry = WaitlistEntry(**body.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def _excerpt(body: str, limit: int = 180) -> str:
    text = " ".join(body.split())
    return text if len(text) <= limit else text[: limit - 3] + "..."


@router.get("/blog", response_model=BlogListResponse)
def list_blog(
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    total = db.scalar(select(func.count(BlogPost.id)))
    posts = db.scalars(
        select(BlogPost)
        .order_by(BlogPost.published_at.desc())
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
            published_at=p.published_at,
        )
        for p in posts
    ]
    return BlogListResponse(total=total, items=items)


@router.get("/blog/{post_id}", response_model=BlogPostOut)
def get_blog_post(post_id: int, db: Session = Depends(get_db)):
    post = db.get(BlogPost, post_id)
    if post is None:
        raise HTTPException(status_code=404, detail="Post nao encontrado")
    return post
