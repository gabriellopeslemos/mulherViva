from datetime import date, time
from types import SimpleNamespace

from app.services.slots import (
    find_orphaned_appointments,
    prefill_source,
    rules_for_day,
    winning_period,
)

MON = date(2026, 10, 12)  # a Monday
THU = date(2026, 10, 15)


def period(pid, start=None, end=None):
    return SimpleNamespace(id=pid, start_date=start, end_date=end)


def rule(rid, period_id, weekday, start=time(8), end=time(12), active=True):
    return SimpleNamespace(
        id=rid,
        period_id=period_id,
        weekday=weekday,
        start_time=start,
        end_time=end,
        location="presencial_bsb",
        also_online=False,
        active=active,
    )


def appt(day, start=time(9), end=time(10)):
    return SimpleNamespace(date=day, start_time=start, end_time=end, type="presencial_bsb")


# ---- winning_period ----


def test_no_period_covers_day():
    assert winning_period([period(1, start=date(2026, 11, 1))], MON) is None


def test_boundary_dates_are_inclusive():
    p = period(1, start=MON, end=MON)
    assert winning_period([p], MON) is p


def test_shorter_period_wins_over_open_ended():
    base = period(1, start=date(2026, 10, 1))
    week = period(2, start=date(2026, 10, 10), end=date(2026, 10, 17))
    assert winning_period([base, week], MON) is week


def test_shorter_period_wins_even_if_it_starts_earlier():
    long = period(1, start=date(2026, 10, 10), end=date(2026, 12, 31))
    short = period(2, start=date(2026, 10, 1), end=date(2026, 10, 20))
    assert winning_period([long, short], MON) is short


def test_open_ended_tie_goes_to_later_start():
    always = period(1)
    since_oct = period(2, start=date(2026, 10, 1))
    assert winning_period([always, since_oct], MON) is since_oct


def test_equal_ranges_tie_goes_to_newer_period():
    a = period(1, start=date(2026, 10, 1), end=date(2026, 10, 31))
    b = period(2, start=date(2026, 10, 1), end=date(2026, 10, 31))
    assert winning_period([a, b], MON) is b


# ---- rules_for_day ----


def test_rules_outside_the_range_are_ignored():
    # A Thursday rule in a range that ends on a Wednesday simply never fires.
    p = period(1, start=date(2026, 10, 12), end=date(2026, 10, 14))
    thu_rule = rule(1, 1, weekday=3)
    assert rules_for_day(THU, [p], [thu_rule]) == []


def test_weekday_without_rule_in_winning_period_is_closed():
    base = period(1, start=date(2026, 10, 1))
    week = period(2, start=date(2026, 10, 12), end=date(2026, 10, 18))
    rules = [rule(1, 1, weekday=0), rule(2, 1, weekday=3), rule(3, 2, weekday=0)]
    # Monday: the week's own rule; Thursday: the week has none, base doesn't leak in.
    assert rules_for_day(MON, [base, week], rules) == [rules[2]]
    assert rules_for_day(THU, [base, week], rules) == []


def test_broader_period_applies_again_after_the_short_one():
    base = period(1, start=date(2026, 10, 1))
    week = period(2, start=date(2026, 10, 12), end=date(2026, 10, 18))
    rules = [rule(1, 1, weekday=0), rule(2, 2, weekday=0, start=time(14), end=time(18))]
    assert rules_for_day(date(2026, 10, 19), [base, week], rules) == [rules[0]]


def test_inactive_rule_is_skipped():
    p = period(1)
    assert rules_for_day(MON, [p], [rule(1, 1, weekday=0, active=False)]) == []


# ---- prefill_source ----


def test_prefill_none_when_nothing_overlaps():
    p = period(1, start=date(2026, 1, 1), end=date(2026, 1, 31))
    assert prefill_source(date(2026, 3, 1), date(2026, 3, 31), [p]) is None


def test_prefill_from_period_containing_the_new_range():
    base = period(1, start=date(2026, 10, 1))
    assert prefill_source(date(2026, 10, 15), date(2026, 10, 22), [base]) is base


def test_prefill_from_the_winner_on_the_start_day():
    base = period(1, start=date(2026, 10, 1))
    week = period(2, start=date(2026, 10, 12), end=date(2026, 10, 18))
    assert prefill_source(date(2026, 10, 14), date(2026, 10, 30), [base, week]) is week


def test_prefill_when_new_range_starts_before_everything():
    later = period(1, start=date(2026, 11, 1))
    assert prefill_source(date(2026, 10, 1), None, [later]) is later


# ---- find_orphaned_appointments ----


def test_shrinking_the_period_orphans_appointments_past_the_new_end():
    before_p = period(1, start=date(2026, 10, 1))
    after_p = period(1, start=date(2026, 10, 1), end=date(2026, 10, 13))
    rules = [rule(1, 1, weekday=3)]
    a = appt(THU)
    assert find_orphaned_appointments([a], ([before_p], rules), ([after_p], rules)) == [a]


def test_new_shorter_period_without_the_rule_orphans_appointments():
    base = period(1, start=date(2026, 10, 1))
    week = period(2, start=date(2026, 10, 12), end=date(2026, 10, 18))
    rules = [rule(1, 1, weekday=3)]
    a = appt(THU)
    assert find_orphaned_appointments([a], ([base], rules), ([base, week], rules)) == [a]


def test_appointment_uncovered_before_is_not_reported():
    p = period(1)
    a = appt(THU)
    assert find_orphaned_appointments([a], ([p], []), ([p], [])) == []
