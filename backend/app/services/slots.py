from datetime import date, datetime, time, timedelta

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import (
    Appointment,
    AvailabilityOverride,
    AvailabilityRule,
    SchedulePeriod,
    Specialty,
)
from .settings import get_int_setting

Interval = tuple[time, time]

MAX_RANGE_DAYS = 31
DAY_END = time(23, 59, 59)


def _merge(intervals: list[Interval]) -> list[Interval]:
    if not intervals:
        return []
    intervals = sorted(intervals)
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end:
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _subtract(windows: list[Interval], blocks: list[Interval]) -> list[Interval]:
    for b_start, b_end in blocks:
        result: list[Interval] = []
        for w_start, w_end in windows:
            if b_end <= w_start or b_start >= w_end:
                result.append((w_start, w_end))
                continue
            if w_start < b_start:
                result.append((w_start, b_start))
            if b_end < w_end:
                result.append((b_end, w_end))
        windows = result
    return windows


def _add_minutes(t: time, minutes: int) -> time | None:
    dt = datetime.combine(date.min, t) + timedelta(minutes=minutes)
    if dt.date() != date.min:
        return None
    return dt.time()


def _chop(windows: list[Interval], duration_min: int) -> list[Interval]:
    slots: list[Interval] = []
    for start, end in windows:
        cursor = start
        while True:
            slot_end = _add_minutes(cursor, duration_min)
            if slot_end is None or slot_end > end:
                break
            slots.append((cursor, slot_end))
            cursor = slot_end
    return slots


def _override_interval(o: AvailabilityOverride) -> Interval:
    return (o.start_time or time(0, 0), o.end_time or DAY_END)


def _pad(t: time, minutes: int, *, earlier: bool) -> time:
    """Shift a time by `minutes`, clamped to the day so it never wraps."""
    if minutes <= 0:
        return t
    base = datetime.combine(date.min, t)
    shifted = base - timedelta(minutes=minutes) if earlier else base + timedelta(minutes=minutes)
    if shifted.date() != date.min:
        return time(0, 0) if earlier else DAY_END
    return shifted.time()


def period_active_on(p: SchedulePeriod, day: date) -> bool:
    """True when `day` falls inside the period's vigência (open sides unbounded)."""
    if p.start_date is not None and day < p.start_date:
        return False
    if p.end_date is not None and day > p.end_date:
        return False
    return True


def _specificity(p: SchedulePeriod) -> tuple:
    """Sort key where smaller = more specific: shortest range first (open-ended
    ranges are infinitely long), then the later start, then the newer period."""
    if p.start_date is None or p.end_date is None:
        span = float("inf")
    else:
        span = (p.end_date - p.start_date).days
    start = p.start_date.toordinal() if p.start_date is not None else 0
    return (span, -start, -p.id)


def winning_period(periods: list[SchedulePeriod], day: date) -> SchedulePeriod | None:
    """The period whose rules govern `day`: the most specific one covering it."""
    covering = [p for p in periods if period_active_on(p, day)]
    return min(covering, key=_specificity) if covering else None


def rules_for_day(
    day: date, periods: list[SchedulePeriod], rules: list[AvailabilityRule]
) -> list[AvailabilityRule]:
    """Active rules that apply on `day`. Only the winning period counts, so a
    weekday it has no rule for is closed even if a broader period covers it."""
    p = winning_period(periods, day)
    if p is None:
        return []
    return [
        r
        for r in rules
        if r.period_id == p.id and r.weekday == day.weekday() and r.active
    ]


def _ranges_overlap(
    a_start: date | None, a_end: date | None, b_start: date | None, b_end: date | None
) -> bool:
    if a_end is not None and b_start is not None and a_end < b_start:
        return False
    if b_end is not None and a_start is not None and b_end < a_start:
        return False
    return True


def prefill_source(
    start_date: date, end_date: date | None, periods: list[SchedulePeriod]
) -> SchedulePeriod | None:
    """Period whose rules a new vigência starts with: the one that governs the
    first day the new range overlaps anything. None when it overlaps nothing."""
    overlapping = [
        p for p in periods if _ranges_overlap(start_date, end_date, p.start_date, p.end_date)
    ]
    if not overlapping:
        return None
    first_day = max(
        start_date, min(p.start_date or start_date for p in overlapping)
    )
    return winning_period(overlapping, first_day)


def rule_locations(r: AvailabilityRule) -> list[str]:
    """Modalities a rule takes bookings for: its location, plus "online" when a
    presencial window is flagged `also_online`. At most one presencial city."""
    if r.also_online and r.location != "online":
        return [r.location, "online"]
    return [r.location]


def compute_day_slots(
    day: date,
    weekday_rules: list[AvailabilityRule],
    overrides: list[AvailabilityOverride],
    appointments: list[Appointment],
    slot_duration_min: int,
    now: datetime | None = None,
    min_lead_hours: int = 0,
    buffer_min: int = 0,
) -> list[tuple[time, time, str]]:
    """Pure interval math for one day. `weekday_rules` must already be resolved
    for this date (`rules_for_day`); `overrides` and `appointments` filtered to
    it (and to the specialty where applicable).

    Windows are grouped by location before merging/chopping: two rules for the
    same weekday but different locations never collapse into one window, so
    each resulting slot keeps a single, unambiguous location. A rule that also
    takes online bookings yields the same times once per modality; booking
    either one makes both busy, since appointments block regardless of location.
    """
    windows_by_location: dict[str, list[Interval]] = {}
    for r in weekday_rules:
        if r.active:
            for loc in rule_locations(r):
                windows_by_location.setdefault(loc, []).append((r.start_time, r.end_time))
    for o in overrides:
        if o.kind == "open":
            windows_by_location.setdefault(o.location, []).append(_override_interval(o))

    blocks = [_override_interval(o) for o in overrides if o.kind == "block"]

    # Existing appointments make a slot unavailable; an optional buffer extends
    # the busy interval on both sides so consultations aren't back-to-back.
    busy = [
        (_pad(a.start_time, buffer_min, earlier=True), _pad(a.end_time, buffer_min, earlier=False))
        for a in appointments
        if a.status != "cancelled"
    ]

    cutoff_time: time | None = None
    if now is not None:
        cutoff = now + timedelta(hours=min_lead_hours)
        if day < cutoff.date():
            return []
        if day == cutoff.date():
            cutoff_time = cutoff.time()

    slots: list[tuple[time, time, str]] = []
    for location, windows in windows_by_location.items():
        windows = _subtract(_merge(windows), blocks)
        location_slots = _chop(windows, slot_duration_min)
        location_slots = [
            (s, e)
            for s, e in location_slots
            if not any(s < b_end and b_start < e for b_start, b_end in busy)
        ]
        if cutoff_time is not None:
            location_slots = [(s, e) for s, e in location_slots if s >= cutoff_time]
        slots.extend((s, e, location) for s, e in location_slots)

    slots.sort()
    return slots


def get_available_slots(
    db: Session,
    specialty: Specialty,
    date_from: date,
    date_to: date,
    buffer_min: int | None = None,
    max_advance_days: int | None = None,
    exclude_appointment_id: int | None = None,
) -> dict[date, list[tuple[time, time, str]]]:
    settings = get_settings()
    if buffer_min is None:
        buffer_min = get_int_setting(db, "buffer_minutes", settings.buffer_minutes)
    date_to = min(date_to, date_from + timedelta(days=MAX_RANGE_DAYS - 1))
    if max_advance_days is None:
        max_advance_days = get_int_setting(
            db, "max_booking_advance_days", settings.max_booking_advance_days
        )
    if max_advance_days > 0:
        date_to = min(date_to, date.today() + timedelta(days=max_advance_days))

    rules = list(
        db.scalars(
            select(AvailabilityRule).where(
                or_(
                    AvailabilityRule.specialty_id.is_(None),
                    AvailabilityRule.specialty_id == specialty.id,
                ),
                AvailabilityRule.active == True,  # noqa: E712
            )
        )
    )
    periods = list(db.scalars(select(SchedulePeriod)))
    overrides = list(
        db.scalars(
            select(AvailabilityOverride).where(
                AvailabilityOverride.date >= date_from,
                AvailabilityOverride.date <= date_to,
            )
        )
    )
    appt_query = select(Appointment).where(
        Appointment.date >= date_from,
        Appointment.date <= date_to,
        Appointment.status != "cancelled",
    )
    if exclude_appointment_id is not None:
        appt_query = appt_query.where(Appointment.id != exclude_appointment_id)
    appointments = list(db.scalars(appt_query))

    now = datetime.now()
    result: dict[date, list[tuple[time, time, str]]] = {}
    day = date_from
    while day <= date_to:
        day_rules = rules_for_day(day, periods, rules)
        day_overrides = [
            o
            for o in overrides
            if o.date == day
            and (o.specialty_id is None or o.specialty_id == specialty.id)
        ]
        day_appointments = [a for a in appointments if a.date == day]
        result[day] = compute_day_slots(
            day,
            day_rules,
            day_overrides,
            day_appointments,
            specialty.slot_duration_min,
            now=now,
            min_lead_hours=settings.min_booking_lead_hours,
            buffer_min=buffer_min,
        )
        day += timedelta(days=1)
    return result


def find_rule_conflicts(
    weekday: int,
    start_time: time,
    end_time: time,
    existing_rules: list[AvailabilityRule],
) -> list[AvailabilityRule]:
    """Pure overlap check for a candidate programação against the active rules
    of the *same period*: same weekday + overlapping time. Overlapping periods
    never conflict — precedence picks one per day. Specialty and location are
    not part of the key, since a single professional attends one place at a time.
    """
    return [
        r
        for r in existing_rules
        if r.weekday == weekday and start_time < r.end_time and r.start_time < end_time
    ]


def appointment_outside_rule(appt: Appointment, rule: AvailabilityRule) -> bool:
    """True when `appt` doesn't fit `rule`'s weekday/time window or its
    modalities. Vigência is the period's concern (`rules_for_day`)."""
    if appt.date.weekday() != rule.weekday:
        return True
    if appt.type not in rule_locations(rule):
        return True
    if appt.start_time < rule.start_time or appt.end_time > rule.end_time:
        return True
    return False


def appointment_covered(
    appt: Appointment, periods: list[SchedulePeriod], rules: list[AvailabilityRule]
) -> bool:
    """True when the effective schedule on `appt.date` has a rule it fits in."""
    return any(
        not appointment_outside_rule(appt, r) for r in rules_for_day(appt.date, periods, rules)
    )


def find_orphaned_appointments(
    appointments: list[Appointment],
    before: tuple[list[SchedulePeriod], list[AvailabilityRule]],
    after: tuple[list[SchedulePeriod], list[AvailabilityRule]],
) -> list[Appointment]:
    """Appointments the schedule covered `before` a change but not `after`."""
    return [
        a
        for a in appointments
        if appointment_covered(a, *before) and not appointment_covered(a, *after)
    ]


def has_overlap(
    db: Session,
    day: date,
    start: time,
    end: time,
    exclude_id: int | None = None,
) -> bool:
    query = select(Appointment.id).where(
        Appointment.date == day,
        Appointment.status != "cancelled",
        Appointment.start_time < end,
        Appointment.end_time > start,
    )
    if exclude_id is not None:
        query = query.where(Appointment.id != exclude_id)
    return db.scalar(query.limit(1)) is not None
