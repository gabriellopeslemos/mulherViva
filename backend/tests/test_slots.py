from datetime import date, datetime, time
from types import SimpleNamespace

from app.services.slots import compute_day_slots

DAY = date(2026, 6, 15)  # a Monday


def rule(start, end, active=True, type="presencial"):
    return SimpleNamespace(start_time=start, end_time=end, active=active, type=type)


def override(kind, start=None, end=None, type="presencial"):
    return SimpleNamespace(kind=kind, start_time=start, end_time=end, type=type)


def appt(start, end, status="confirmed"):
    return SimpleNamespace(start_time=start, end_time=end, status=status)


def test_basic_window_chopped_into_slots():
    slots = compute_day_slots(DAY, [rule(time(8), time(12))], [], [], 60)
    assert slots == [
        (time(8), time(9), "presencial"),
        (time(9), time(10), "presencial"),
        (time(10), time(11), "presencial"),
        (time(11), time(12), "presencial"),
    ]


def test_remainder_discarded():
    slots = compute_day_slots(DAY, [rule(time(8), time(9, 30))], [], [], 60)
    assert slots == [(time(8), time(9), "presencial")]


def test_inactive_rule_ignored():
    slots = compute_day_slots(DAY, [rule(time(8), time(12), active=False)], [], [], 60)
    assert slots == []


def test_overlapping_rules_merged():
    slots = compute_day_slots(
        DAY, [rule(time(8), time(10)), rule(time(9), time(12))], [], [], 60
    )
    assert len(slots) == 4
    assert slots[0] == (time(8), time(9), "presencial")
    assert slots[-1] == (time(11), time(12), "presencial")


def test_online_rule_tagged():
    slots = compute_day_slots(
        DAY, [rule(time(8), time(10), type="online")], [], [], 60
    )
    assert slots == [
        (time(8), time(9), "online"),
        (time(9), time(10), "online"),
    ]


def test_mixed_modalities_same_time_both_offered():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(10)), rule(time(8), time(10), type="online")],
        [],
        [],
        60,
    )
    # 08:00 and 09:00 slots in each modality; sorted by start then type
    assert slots == [
        (time(8), time(9), "online"),
        (time(8), time(9), "presencial"),
        (time(9), time(10), "online"),
        (time(9), time(10), "presencial"),
    ]


def test_appointment_blocks_both_modalities():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(10)), rule(time(8), time(10), type="online")],
        [],
        [appt(time(9), time(10))],
        60,
    )
    # the 09:00 slot is gone in both modalities; only 08:00 remains for each
    assert slots == [
        (time(8), time(9), "online"),
        (time(8), time(9), "presencial"),
    ]


def test_open_override_adds_window():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(10))],
        [override("open", time(14), time(16))],
        [],
        60,
    )
    assert (time(14), time(15), "presencial") in slots
    assert (time(15), time(16), "presencial") in slots
    assert len(slots) == 4


def test_open_override_online_modality():
    slots = compute_day_slots(
        DAY,
        [],
        [override("open", time(14), time(16), type="online")],
        [],
        60,
    )
    assert slots == [
        (time(14), time(15), "online"),
        (time(15), time(16), "online"),
    ]


def test_block_override_subtracts():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [override("block", time(9), time(11), type=None)],
        [],
        60,
    )
    assert slots == [
        (time(8), time(9), "presencial"),
        (time(11), time(12), "presencial"),
    ]


def test_block_subtracts_from_all_modalities():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12)), rule(time(8), time(12), type="online")],
        [override("block", time(9), time(11), type=None)],
        [],
        60,
    )
    starts = {(s, t) for s, _, t in slots}
    assert (time(9), "presencial") not in starts
    assert (time(9), "online") not in starts
    assert (time(8), "presencial") in starts
    assert (time(8), "online") in starts


def test_whole_day_block_empties_day():
    slots = compute_day_slots(
        DAY, [rule(time(8), time(12))], [override("block", type=None)], [], 60
    )
    assert slots == []


def test_block_partial_slot_removed():
    # block 09:30-10:00 cuts window into 08:00-09:30 / 10:00-12:00;
    # 60-min chopping realigns: 08:00-09:00 then 10:00, 11:00
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [override("block", time(9, 30), time(10), type=None)],
        [],
        60,
    )
    assert slots == [
        (time(8), time(9), "presencial"),
        (time(10), time(11), "presencial"),
        (time(11), time(12), "presencial"),
    ]


def test_appointment_blocks_slot():
    slots = compute_day_slots(
        DAY,
        [rule(time(8), time(12))],
        [],
        [appt(time(9), time(10))],
        60,
    )
    assert (time(9), time(10), "presencial") not in slots
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
    assert slots == [
        (time(8), time(9), "presencial"),
        (time(11), time(12), "presencial"),
    ]


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
    assert slots == [
        (time(10), time(11), "presencial"),
        (time(11), time(12), "presencial"),
    ]


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
    assert slots[0] == (time(8), time(8, 30), "presencial")
