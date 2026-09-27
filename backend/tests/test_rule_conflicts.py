from datetime import date, time
from types import SimpleNamespace

from app.services.slots import appointment_outside_rule, find_rule_conflicts


def sched(weekday, start, end):
    return SimpleNamespace(
        weekday=weekday,
        start_time=start,
        end_time=end,
        location="presencial_bsb",
        also_online=False,
    )


def appt(day, start, end):
    return SimpleNamespace(date=day, start_time=start, end_time=end, type="presencial_bsb")


# ---- find_rule_conflicts ----
# Callers pass only the rules of the candidate's own period.


def test_no_conflict_different_weekday():
    existing = [sched(1, time(8), time(12))]
    assert find_rule_conflicts(2, time(8), time(12), existing) == []


def test_conflict_same_weekday_overlapping_time():
    existing = [sched(0, time(8), time(12))]
    assert find_rule_conflicts(0, time(10), time(14), existing) == existing


def test_no_conflict_adjacent_time_does_not_overlap():
    existing = [sched(0, time(8), time(12))]
    assert find_rule_conflicts(0, time(12), time(14), existing) == []


def test_conflict_ignores_specialty_and_location():
    # find_rule_conflicts takes no specialty/location argument at all: two
    # schedules in different specialties/locations still conflict because
    # only one professional attends the whole clinic at a time.
    existing = [sched(0, time(8), time(12))]
    assert find_rule_conflicts(0, time(9), time(10), existing) == existing


# ---- appointment_outside_rule ----


def test_appointment_inside_rule_is_not_outside():
    r = sched(0, time(8), time(12))
    a = appt(date(2026, 1, 5), time(9), time(10))
    assert appointment_outside_rule(a, r) is False


def test_appointment_outside_shrunk_time_window():
    r = sched(0, time(8), time(10))
    a = appt(date(2026, 6, 15), time(9), time(11))
    assert appointment_outside_rule(a, r) is True


def test_appointment_outside_changed_weekday():
    r = sched(1, time(8), time(12))
    a = appt(date(2026, 6, 15), time(9), time(10))  # 2026-06-15 is a Monday, rule now Tuesday
    assert appointment_outside_rule(a, r) is True
