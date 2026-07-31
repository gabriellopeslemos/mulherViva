"""Clock helpers.

Appointments are stored as a naive local date + time (the clinic's wall clock).
Deciding "is this slot still bookable" therefore needs the current time *in the
clinic's timezone*, not in whatever zone the server happens to run in — a
container running UTC would otherwise offer slots that already passed, or hide
slots that are still available, by the size of the UTC offset.
"""

from datetime import date, datetime, timezone

from .config import get_settings


def local_now() -> datetime:
    """Current wall-clock time in the clinic's timezone, as a naive datetime.

    Naive on purpose: it is compared against the naive date/time columns.
    """
    return datetime.now(get_settings().tzinfo).replace(tzinfo=None)


def local_today() -> date:
    """Today's date in the clinic's timezone."""
    return local_now().date()


def utcnow() -> datetime:
    """Current UTC time as a naive datetime, for storage in DateTime columns.

    SQLAlchemy's plain DateTime is timezone-naive on every backend, so storing
    an aware value silently drops the offset on some drivers. Normalising to
    naive UTC here keeps stored timestamps comparable everywhere.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
