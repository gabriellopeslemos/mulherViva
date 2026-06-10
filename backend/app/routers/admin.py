from datetime import date as date_type

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..auth import get_current_admin
from ..database import get_db
from ..models import (
    Appointment,
    AvailabilityOverride,
    AvailabilityRule,
    BlogPost,
    Specialty,
)
from ..schemas import (
    AppointmentIn,
    AppointmentOut,
    AppointmentUpdate,
    AvailabilityOverrideIn,
    AvailabilityOverrideOut,
    AvailabilityRuleIn,
    AvailabilityRuleOut,
    AvailabilityRuleUpdate,
    BlogPostIn,
    BlogPostOut,
    BlogPostUpdate,
    InstagramSyncResult,
    SpecialtyOut,
    SpecialtyUpdate,
)
from ..services.instagram import sync_instagram
from ..services.slots import has_overlap

router = APIRouter(
    prefix="/api/admin",
    tags=["admin"],
    dependencies=[Depends(get_current_admin)],
)


def _get_or_404(db: Session, model, obj_id: int, name: str):
    obj = db.get(model, obj_id)
    if obj is None:
        raise HTTPException(status_code=404, detail=f"{name} nao encontrado(a)")
    return obj


# ---- appointments ----

@router.get("/appointments", response_model=list[AppointmentOut])
def list_appointments(
    date_from: date_type | None = None,
    date_to: date_type | None = None,
    status_filter: str | None = Query(None, alias="status"),
    specialty_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(Appointment).order_by(Appointment.date, Appointment.start_time)
    if date_from:
        query = query.where(Appointment.date >= date_from)
    if date_to:
        query = query.where(Appointment.date <= date_to)
    if status_filter:
        query = query.where(Appointment.status == status_filter)
    if specialty_id:
        query = query.where(Appointment.specialty_id == specialty_id)
    return list(db.scalars(query))


@router.post(
    "/appointments", response_model=AppointmentOut, status_code=status.HTTP_201_CREATED
)
def create_appointment(body: AppointmentIn, db: Session = Depends(get_db)):
    _get_or_404(db, Specialty, body.specialty_id, "Especialidade")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="Horario final deve ser apos o inicial")
    if not body.force and has_overlap(db, body.date, body.start_time, body.end_time):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflito com outra consulta neste horario",
        )
    appointment = Appointment(
        specialty_id=body.specialty_id,
        date=body.date,
        start_time=body.start_time,
        end_time=body.end_time,
        client_name=body.client_name,
        client_contact=body.client_contact,
        type=body.type,
        status=body.status,
        notes=body.notes,
        source="admin",
    )
    db.add(appointment)
    db.commit()
    db.refresh(appointment)
    return appointment


@router.patch("/appointments/{appointment_id}", response_model=AppointmentOut)
def update_appointment(
    appointment_id: int, body: AppointmentUpdate, db: Session = Depends(get_db)
):
    appointment = _get_or_404(db, Appointment, appointment_id, "Consulta")
    data = body.model_dump(exclude_unset=True, exclude={"force"})
    if "specialty_id" in data:
        _get_or_404(db, Specialty, data["specialty_id"], "Especialidade")
    for field, value in data.items():
        setattr(appointment, field, value)
    if appointment.end_time <= appointment.start_time:
        raise HTTPException(status_code=422, detail="Horario final deve ser apos o inicial")
    time_changed = {"date", "start_time", "end_time", "status"} & data.keys()
    if (
        time_changed
        and appointment.status != "cancelled"
        and not body.force
        and has_overlap(
            db,
            appointment.date,
            appointment.start_time,
            appointment.end_time,
            exclude_id=appointment.id,
        )
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflito com outra consulta neste horario",
        )
    db.commit()
    db.refresh(appointment)
    return appointment


@router.delete("/appointments/{appointment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_appointment(appointment_id: int, db: Session = Depends(get_db)):
    appointment = _get_or_404(db, Appointment, appointment_id, "Consulta")
    db.delete(appointment)
    db.commit()


# ---- availability rules ----

@router.get("/availability/rules", response_model=list[AvailabilityRuleOut])
def list_rules(specialty_id: int | None = None, db: Session = Depends(get_db)):
    query = select(AvailabilityRule).order_by(
        AvailabilityRule.specialty_id, AvailabilityRule.weekday, AvailabilityRule.start_time
    )
    if specialty_id:
        query = query.where(AvailabilityRule.specialty_id == specialty_id)
    return list(db.scalars(query))


@router.post(
    "/availability/rules",
    response_model=AvailabilityRuleOut,
    status_code=status.HTTP_201_CREATED,
)
def create_rule(body: AvailabilityRuleIn, db: Session = Depends(get_db)):
    _get_or_404(db, Specialty, body.specialty_id, "Especialidade")
    if body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="Horario final deve ser apos o inicial")
    rule = AvailabilityRule(**body.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/availability/rules/{rule_id}", response_model=AvailabilityRuleOut)
def update_rule(rule_id: int, body: AvailabilityRuleUpdate, db: Session = Depends(get_db)):
    rule = _get_or_404(db, AvailabilityRule, rule_id, "Regra")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(rule, field, value)
    if rule.end_time <= rule.start_time:
        raise HTTPException(status_code=422, detail="Horario final deve ser apos o inicial")
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/availability/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = _get_or_404(db, AvailabilityRule, rule_id, "Regra")
    db.delete(rule)
    db.commit()


# ---- availability overrides ----

@router.get("/availability/overrides", response_model=list[AvailabilityOverrideOut])
def list_overrides(
    date_from: date_type | None = None,
    date_to: date_type | None = None,
    db: Session = Depends(get_db),
):
    query = select(AvailabilityOverride).order_by(AvailabilityOverride.date)
    if date_from:
        query = query.where(AvailabilityOverride.date >= date_from)
    if date_to:
        query = query.where(AvailabilityOverride.date <= date_to)
    return list(db.scalars(query))


@router.post(
    "/availability/overrides",
    response_model=AvailabilityOverrideOut,
    status_code=status.HTTP_201_CREATED,
)
def create_override(body: AvailabilityOverrideIn, db: Session = Depends(get_db)):
    if body.specialty_id is not None:
        _get_or_404(db, Specialty, body.specialty_id, "Especialidade")
    if (body.start_time is None) != (body.end_time is None):
        raise HTTPException(
            status_code=422,
            detail="Informe inicio e fim, ou nenhum dos dois (dia inteiro)",
        )
    if body.start_time and body.end_time and body.end_time <= body.start_time:
        raise HTTPException(status_code=422, detail="Horario final deve ser apos o inicial")
    if body.kind == "open" and body.start_time is None:
        raise HTTPException(
            status_code=422, detail="Abertura extra exige horario de inicio e fim"
        )
    override = AvailabilityOverride(**body.model_dump())
    db.add(override)
    db.commit()
    db.refresh(override)
    return override


@router.delete(
    "/availability/overrides/{override_id}", status_code=status.HTTP_204_NO_CONTENT
)
def delete_override(override_id: int, db: Session = Depends(get_db)):
    override = _get_or_404(db, AvailabilityOverride, override_id, "Excecao")
    db.delete(override)
    db.commit()


# ---- specialties ----

@router.get("/specialties", response_model=list[SpecialtyOut])
def list_all_specialties(db: Session = Depends(get_db)):
    return list(db.scalars(select(Specialty).order_by(Specialty.id)))


@router.patch("/specialties/{specialty_id}", response_model=SpecialtyOut)
def update_specialty(
    specialty_id: int, body: SpecialtyUpdate, db: Session = Depends(get_db)
):
    specialty = _get_or_404(db, Specialty, specialty_id, "Especialidade")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(specialty, field, value)
    db.commit()
    db.refresh(specialty)
    return specialty


# ---- blog ----

@router.post("/blog", response_model=BlogPostOut, status_code=status.HTTP_201_CREATED)
def create_post(body: BlogPostIn, db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    post = BlogPost(source="manual", **data)
    db.add(post)
    db.commit()
    db.refresh(post)
    return post


@router.patch("/blog/{post_id}", response_model=BlogPostOut)
def update_post(post_id: int, body: BlogPostUpdate, db: Session = Depends(get_db)):
    post = _get_or_404(db, BlogPost, post_id, "Post")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    db.commit()
    db.refresh(post)
    return post


@router.delete("/blog/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db)):
    post = _get_or_404(db, BlogPost, post_id, "Post")
    db.delete(post)
    db.commit()


# ---- instagram ----

@router.post("/instagram/sync", response_model=InstagramSyncResult)
def trigger_instagram_sync(db: Session = Depends(get_db)):
    return InstagramSyncResult(**sync_instagram(db))
