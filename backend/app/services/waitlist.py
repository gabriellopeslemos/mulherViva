"""Notify the next person on the waitlist when a slot frees up."""

from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import Specialty, WaitlistEntry, utcnow
from . import notifications


def notify_next(db: Session, specialty_id: int, on_date: date_type | None = None) -> bool:
    """Notify the oldest active waitlist entry for a specialty.

    Entries with no preferred date always match; entries with a preferred date
    only match when it equals the freed slot's date. Returns True if someone
    was notified.
    """
    entries = list(
        db.scalars(
            select(WaitlistEntry)
            .where(
                WaitlistEntry.specialty_id == specialty_id,
                WaitlistEntry.active == True,  # noqa: E712
            )
            .order_by(WaitlistEntry.created_at)
        )
    )
    entry = next(
        (
            e
            for e in entries
            if e.preferred_date is None or on_date is None or e.preferred_date == on_date
        ),
        None,
    )
    if entry is None:
        return False

    specialty = db.get(Specialty, specialty_id)
    entry.active = False
    entry.notified_at = utcnow()
    db.commit()

    notifications.notify_waitlist_slot(
        {
            "client_name": entry.client_name,
            "client_email": entry.client_email,
            "specialty_name": specialty.name if specialty else "",
        }
    )
    return True
