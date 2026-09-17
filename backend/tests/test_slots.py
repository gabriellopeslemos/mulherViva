from datetime import date, datetime, time
from types import SimpleNamespace

from app.services.slots import compute_day_slots

DAY = date(2026, 6, 15)  # a Monday


def rule(start, end, active=True, location="presencial_bsb", start_date=None, end_date=None):
    return SimpleNamespace(
        start_time=start,
        end_time=end,
        active=active,
        location=location,
        start_date=start_date,
        end_date=end_date,
    )


def override(kind, start=None, end=None, location=None):
    return SimpleNamespace(kind=kind, start_time=start, end_time=end, location=location)


def appt(start, end, status="confirmed"):
    return SimpleNamespace(start_time=start, end_time=end, status=status)


def test_basic_window_chopped_into_slots():
    slots = compute_day_slots(DAY, [rule(time(8), time(12))], [], [], 60)
    assert slots == [
        (time(8), time(9), "presencial_bsb"),
        (time(9), time(10), "presencial_bsb"),
        (time(10), time(11), "presencial_bsb"),
        (time(11), time(12), "presencial_bsb"),
    ]


def test_remainder_discarded():
    slots = compute_day_slots(DAY, [rule(time(8), time(9, 30))], [], [], 60)
    assert slots == [(time(8), time(9), "presencial_bsb")]


def test_inactive_rule_ignored():
    slots = compute_day_slots(DAY, [rule(time(8), time(12), active=False)], [], [], 60)
    assert slots == []


def test_overlapping_rules_merged():
    slots = compute_day_slots(
        DAY, [rule(time(8), time(10)), rule(time(9), time(12))], [], [], 60
    )
    assert len(slots) == 4
    assert slots[0] == (time(8), time(9), "presencial_bsb")
    assert slots[-1] == (time(11), time(12), "presencial_bsb")


def test_open_override_adds_window():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(10))],
        [override("open", time(14), time(16), location="presencial_bsb")],
        [],
        60,
    )
    assert (time(14), time(15), "presencial_bsb") in slots
    assert (time(15), time(16), "presencial_bsb") in slots
    assert len(slots) == 4


def test_block_override_subtracts():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [override("block", time(9), time(11))],
        [],
        60,
    )
    assert slots == [(time(8), time(9), "presencial_bsb"), (time(11), time(12), "presencial_bsb")]


def test_whole_day_block_empties_day():
    slots = compute_day_slots(
        DAY, [rule(time(8), time(12))], [override("block")], [], 60
    )
    assert slots == []


def test_block_partial_slot_removed():
    # block 09:30-10:00 cuts window into 08:00-09:30 / 10:00-12:00;
    # 60-min chopping realigns: 08:00-09:00 then 10:00, 11:00
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [override("block", time(9, 30), time(10))],
        [],
        60,
    )
    assert slots == [
        (time(8), time(9), "presencial_bsb"),
        (time(10), time(11), "presencial_bsb"),
        (time(11), time(12), "presencial_bsb"),
    ]


def test_appointment_blocks_slot():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [appt(time(9), time(10))],
        60,
    )
    assert not any(s == time(9) and e == time(10) for s, e, _ in slots)
    assert len(slots) == 3


def test_cancelled_appointment_does_not_block():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [appt(time(9), time(10), status="cancelled")],
        60,
    )
    assert len(slots) == 4


def test_partial_overlap_appointment_blocks():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [appt(time(9, 30), time(10, 30))],
        60,
    )
    assert slots == [(time(8), time(9), "presencial_bsb"), (time(11), time(12), "presencial_bsb")]


def test_past_day_returns_empty():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [],
        60,
        now=datetime(2026, 6, 16, 9, 0),
        min_lead_hours=2,
    )
    assert slots == []


def test_lead_time_cuts_today_slots():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [],
        60,
        now=datetime(2026, 6, 15, 7, 30),
        min_lead_hours=2,
    )
    assert slots == [(time(10), time(11), "presencial_bsb"), (time(11), time(12), "presencial_bsb")]


def test_lead_time_crossing_midnight_empties_today():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [],
        60,
        now=datetime(2026, 6, 15, 23, 0),
        min_lead_hours=2,
    )
    assert slots == []


def test_30_min_slots():
    slots = compute_day_slots(DAY, [rule(time(8), time(10))], [], [], 30)
    assert len(slots) == 4
    assert slots[0] == (time(8), time(8, 30), "presencial_bsb")


def test_buffer_blocks_adjacent_slots():
    # a 09:00-10:00 appointment with a 30-min buffer also blocks the
    # 08:00-09:00 (ends within buffer) and 10:00-11:00 (starts within buffer) slots
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [appt(time(9), time(10))],
        60,
        buffer_min=30,
    )
    assert slots == [(time(11), time(12), "presencial_bsb")]


def test_zero_buffer_keeps_adjacent_slots():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [appt(time(9), time(10))],
        60,
        buffer_min=0,
    )
    assert (time(8), time(9), "presencial_bsb") in slots
    assert (time(10), time(11), "presencial_bsb") in slots


# ---- location ----


def test_slots_carry_rule_location():
    slots = compute_day_slots(DAY, [rule(time(8), time(9), location="online")], [], [], 60)
    assert slots == [(time(8), time(9), "online")]


def test_different_locations_are_not_merged():
    # same weekday, overlapping-adjacent windows, but different locations:
    # each keeps its own slot instead of collapsing into one window.
    slots = compute_day_slots(
        DAY,
        [
            rule(time(8), time(10), location="online"),
            rule(time(9), time(12), location="presencial_rj"),
        ],
        [],
        [],
        60,
    )
    assert (time(8), time(9), "online") in slots
    assert (time(9), time(10), "online") in slots
    assert (time(9), time(10), "presencial_rj") in slots
    assert (time(10), time(11), "presencial_rj") in slots
    assert (time(11), time(12), "presencial_rj") in slots
    assert len(slots) == 5


def test_open_override_location_independent_of_rule():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(9), location="presencial_bsb")],
        [override("open", time(14), time(15), location="online")],
        [],
        60,
    )
    assert (time(8), time(9), "presencial_bsb") in slots
    assert (time(14), time(15), "online") in slots
    assert len(slots) == 2


# ---- vigência (start_date / end_date) ----


def test_rule_before_start_date_produces_no_slots():
    slots = compute_day_slots(
        DAY, [rule(time(8), time(9), start_date=date(2026, 7, 1))], [], [], 60
    )
    assert slots == []


def test_rule_after_end_date_produces_no_slots():
    slots = compute_day_slots(
        DAY, [rule(time(8), time(9), end_date=date(2026, 6, 1))], [], [], 60
    )
    assert slots == []


def test_rule_within_vigencia_produces_slots():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(9), start_date=date(2026, 6, 1), end_date=date(2026, 6, 30))],
        [],
        [],
        60,
    )
    assert slots == [(time(8), time(9), "presencial_bsb")]


def test_rule_on_boundary_dates_is_active():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(9), start_date=DAY, end_date=DAY)],
        [],
        [],
        60,
    )
    assert slots == [(time(8), time(9), "presencial_bsb")]
