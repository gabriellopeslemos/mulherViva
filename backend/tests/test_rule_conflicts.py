from datetime import date, time
from types import SimpleNamespace

from app.services.slots import appointment_outside_rule, find_rule_conflicts


def sched(weekday, start, end, start_date=None, end_date=None):
    return SimpleNamespace(
        weekday=weekday,
        start_time=start,
        end_time=end,
        start_date=start_date,
        end_date=end_date,
    )


def appt(day, start, end):
    return SimpleNamespace(date=day, start_time=start, end_time=end)


# ---- find_rule_conflicts ----


def test_no_conflict_different_weekday():
    existing = [sched(1, time(8), time(12))]
    assert find_rule_conflicts(2, time(8), time(12), None, None, existing) == []


def test_conflict_same_weekday_overlapping_time_open_ended():
    existing = [sched(0, time(8), time(12))]
    conflicts = find_rule_conflicts(0, time(10), time(14), None, None, existing)
    assert conflicts == existing


def test_no_conflict_adjacent_time_does_not_overlap():
    existing = [sched(0, time(8), time(12))]
    assert find_rule_conflicts(0, time(12), time(14), None, None, existing) == []


def test_no_conflict_when_date_ranges_dont_cross():
    existing = [
        sched(0, time(8), time(12), start_date=date(2026, 1, 1), end_date=date(2026, 1, 31))
    ]
    conflicts = find_rule_conflicts(0, time(8), time(12), date(2026, 2, 1), None, existing)
    assert conflicts == []


def test_conflict_when_date_ranges_cross():
    existing = [
        sched(0, time(8), time(12), start_date=date(2026, 1, 1), end_date=date(2026, 2, 15))
    ]
    conflicts = find_rule_conflicts(0, time(8), time(12), date(2026, 2, 1), None, existing)
    assert conflicts == existing


def test_conflict_ignores_specialty_and_location():
    # find_rule_conflicts takes no specialty/location argument at all: two
    # schedules in different specialties/locations still conflict because
    # only one professional attends the whole clinic at a time.
    existing = [sched(0, time(8), time(12))]
    assert find_rule_conflicts(0, time(9), time(10), None, None, existing) == existing


def test_no_conflict_open_ended_candidate_ends_before_existing_starts():
    existing = [sched(0, time(8), time(12), start_date=date(2026, 3, 1))]
    conflicts = find_rule_conflicts(0, time(8), time(12), None, date(2026, 2, 28), existing)
    assert conflicts == []


# ---- appointment_outside_rule ----


def test_appointment_inside_rule_is_not_outside():
    r = sched(0, time(8), time(12), start_date=date(2026, 1, 1))
    a = appt(date(2026, 1, 5), time(9), time(10))
    assert appointment_outside_rule(a, r) is False


def test_appointment_outside_shrunk_time_window():
    r = sched(0, time(8), time(10))
    a = appt(date(2026, 6, 15), time(9), time(11))
    assert appointment_outside_rule(a, r) is True


def test_appointment_outside_shrunk_date_range():
    r = sched(0, time(8), time(12), end_date=date(2026, 6, 1))
    a = appt(date(2026, 6, 15), time(9), time(10))
    assert appointment_outside_rule(a, r) is True


def test_appointment_outside_changed_weekday():
    r = sched(1, time(8), time(12))
    a = appt(date(2026, 6, 15), time(9), time(10))  # 2026-06-15 is a Monday, rule now Tuesday
    assert appointment_outside_rule(a, r) is True
