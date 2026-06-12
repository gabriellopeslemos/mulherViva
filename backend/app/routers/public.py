from datetime import date as date_type
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import Appointment, BlogPost, Specialty
from ..schemas import (
    AppointmentOut,
    BlogListResponse,
    BlogPostListItem,
    BlogPostOut,
    BookingIn,
    SlotOut,
    SlotsDayOut,
    SlotsResponse,
    SpecialtyOut,
)
from ..services.slots import get_available_slots, has_overlap

router = APIRouter(prefix="/api", tags=["public"])

MAX_PENDING_PER_CONTACT_PER_DAY = 3


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
                slots=[SlotOut(start=s, end=e, type=t) for s, e, t in slots],
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
            Appointment.client_contact == body.client_contact,
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
        ((s, e) for s, e, t in day_slots if s == body.start and t == body.type),
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

    appointment = Appointment(
        specialty_id=specialty.id,
        date=body.date,
        start_time=start,
        end_time=end,
        client_name=body.client_name,
        client_contact=body.client_contact,
        client_email=body.client_email,
        type=body.type,
        status="pending",
        notes=body.notes,
        source="public",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


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
