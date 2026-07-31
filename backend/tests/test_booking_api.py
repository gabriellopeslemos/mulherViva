"""End-to-end tests for the public booking, waitlist and contact flows."""

from datetime import time, timedelta

import pytest
from sqlalchemy import select

from app.models import Appointment, AvailabilityRule, Specialty, WaitlistEntry
from app.timeutils import local_today


@pytest.fixture
def specialty(db_session):
    item = db_session.scalar(select(Specialty))
    if item is None:
        item = Specialty(
            name="Ginecologia Integrativa",
            slug="ginecologia-integrativa",
            slot_duration_min=60,
            active=True,
        )
        db_session.add(item)
        db_session.commit()
    return item


@pytest.fixture
def bookable_day(db_session, specialty):
    """Open 08:00-12:00 every weekday, and return a date far enough ahead that
    the minimum-lead-time rule can never make the slots disappear."""
    target = local_today() + timedelta(days=7)
    for weekday in range(7):
        db_session.add(
            AvailabilityRule(
                specialty_id=specialty.id,
                weekday=weekday,
                start_time=time(8),
                end_time=time(12),
                active=True,
            )
        )
    db_session.commit()
    return target


def _booking_payload(specialty, day, start="08:00:00", **overrides):
    payload = {
        "specialty_id": specialty.id,
        "date": day.isoformat(),
        "start": start,
        "type": "presencial",
        "client_name": "Maria Silva",
        "client_email": "maria@example.com",
        "client_phone": "61999990000",
    }
    payload.update(overrides)
    return payload


def test_slots_are_listed_for_an_open_day(client, specialty, bookable_day):
    response = client.get(
        "/api/slots",
        params={
            "specialty_id": specialty.id,
            "date_from": bookable_day.isoformat(),
            "date_to": bookable_day.isoformat(),
        },
    )
    assert response.status_code == 200
    slots = response.json()["days"][0]["slots"]
    assert [s["start"] for s in slots] == [
        "08:00:00",
        "09:00:00",
        "10:00:00",
        "11:00:00",
    ]


def test_booking_creates_a_pending_appointment(client, specialty, bookable_day):
    response = client.post(
        "/api/bookings", json=_booking_payload(specialty, bookable_day)
    )
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["token"]


def test_the_same_slot_cannot_be_booked_twice(client, specialty, bookable_day):
    first = client.post("/api/bookings", json=_booking_payload(specialty, bookable_day))
    assert first.status_code == 201

    second = client.post(
        "/api/bookings",
        json=_booking_payload(
            specialty, bookable_day, client_email="outra@example.com"
        ),
    )
    assert second.status_code == 409


def test_database_rejects_a_duplicate_slot_that_slips_past_the_app_check(
    db_session, specialty, bookable_day
):
    """The availability check and the commit are not atomic, so two concurrent
    requests can both decide a slot is free. The unique index is what actually
    prevents the double booking."""
    from sqlalchemy.exc import IntegrityError

    def make(email):
        return Appointment(
            specialty_id=specialty.id,
            date=bookable_day,
            start_time=time(8),
            end_time=time(9),
            client_name="Maria",
            client_contact=email,
            type="presencial",
            status="pending",
        )

    db_session.add(make("a@example.com"))
    db_session.commit()

    db_session.add(make("b@example.com"))
    with pytest.raises(IntegrityError):
        db_session.commit()
    db_session.rollback()


def test_a_cancelled_appointment_frees_its_slot(db_session, specialty, bookable_day):
    booked = Appointment(
        specialty_id=specialty.id,
        date=bookable_day,
        start_time=time(8),
        end_time=time(9),
        client_name="Maria",
        client_contact="a@example.com",
        type="presencial",
        status="cancelled",
    )
    db_session.add(booked)
    db_session.commit()

    # The uniqueness rule only covers active appointments, so the slot is
    # bookable again after a cancellation.
    db_session.add(
        Appointment(
            specialty_id=specialty.id,
            date=bookable_day,
            start_time=time(8),
            end_time=time(9),
            client_name="Joana",
            client_contact="b@example.com",
            type="presencial",
            status="pending",
        )
    )
    db_session.commit()


def test_booking_an_unavailable_slot_is_rejected(client, specialty, bookable_day):
    response = client.post(
        "/api/bookings",
        json=_booking_payload(specialty, bookable_day, start="22:00:00"),
    )
    assert response.status_code == 409


def test_booking_rejects_a_malformed_email(client, specialty, bookable_day):
    response = client.post(
        "/api/bookings",
        json=_booking_payload(specialty, bookable_day, client_email="not-an-email"),
    )
    assert response.status_code == 422


def test_manage_token_flow_allows_cancelling(client, specialty, bookable_day):
    created = client.post(
        "/api/bookings", json=_booking_payload(specialty, bookable_day)
    ).json()
    token = created["token"]

    detail = client.get(f"/api/bookings/manage/{token}")
    assert detail.status_code == 200
    assert detail.json()["can_modify"] is True

    cancelled = client.post(f"/api/bookings/manage/{token}/cancel")
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    # Cancelling twice is not an error the caller can use to probe state.
    assert client.post(f"/api/bookings/manage/{token}/cancel").status_code == 409


def test_unknown_manage_token_returns_404(client):
    assert client.get("/api/bookings/manage/nope-not-a-real-token").status_code == 404


def test_manage_endpoint_never_exposes_the_patient_email(
    client, specialty, bookable_day
):
    created = client.post(
        "/api/bookings", json=_booking_payload(specialty, bookable_day)
    ).json()
    body = client.get(f"/api/bookings/manage/{created['token']}").json()
    assert "client_email" not in body
    assert "maria@example.com" not in str(body)


def test_waitlist_does_not_leak_an_existing_entry(client, specialty, db_session):
    payload = {
        "specialty_id": specialty.id,
        "client_name": "Ana Souza",
        "client_email": "ana@example.com",
        "client_phone": "61988887777",
        "notes": "Prefiro manha",
    }
    first = client.post("/api/waitlist", json=payload)
    assert first.status_code == 201

    # A second request with the same e-mail must return exactly the same
    # acknowledgement — otherwise anyone could probe the list for a given
    # address and read back the name, phone and notes stored with it.
    probe = client.post(
        "/api/waitlist",
        json={**payload, "client_name": "Impostor", "notes": "x"},
    )
    assert probe.json() == first.json()
    assert "Ana Souza" not in probe.text
    assert "61988887777" not in probe.text

    # And the duplicate must not have created a second row.
    entries = db_session.scalars(
        select(WaitlistEntry).where(WaitlistEntry.client_email == "ana@example.com")
    ).all()
    assert len(entries) == 1
    assert entries[0].client_name == "Ana Souza"


def test_contact_message_is_stored(client, db_session):
    from app.models import ContactMessage

    response = client.post(
        "/api/contact",
        json={
            "name": "Carla Dias",
            "email": "carla@example.com",
            "phone": "61977776666",
            "message": "Gostaria de saber sobre a primeira consulta.",
        },
    )
    assert response.status_code == 201
    assert response.json()["ok"] is True

    stored = db_session.scalars(select(ContactMessage)).all()
    assert len(stored) == 1
    assert stored[0].name == "Carla Dias"
    assert stored[0].handled is False


def test_contact_message_requires_a_real_message(client):
    response = client.post(
        "/api/contact",
        json={"name": "Ana", "email": "ana@example.com", "message": "oi"},
    )
    assert response.status_code == 422


def test_contact_flood_from_one_address_is_capped(client):
    payload = {
        "name": "Spammer",
        "email": "spam@example.com",
        "message": "mensagem repetida de teste",
    }
    for _ in range(5):
        assert client.post("/api/contact", json=payload).status_code == 201
    assert client.post("/api/contact", json=payload).status_code == 429


def test_admin_can_read_and_resolve_contact_messages(client, admin_headers):
    client.post(
        "/api/contact",
        json={
            "name": "Beatriz",
            "email": "bia@example.com",
            "message": "Tenho uma duvida sobre horarios.",
        },
    )
    listing = client.get("/api/admin/contact-messages", headers=admin_headers)
    assert listing.status_code == 200
    message = listing.json()[0]
    assert message["handled"] is False

    updated = client.patch(
        f"/api/admin/contact-messages/{message['id']}",
        headers=admin_headers,
        json={"handled": True},
    )
    assert updated.status_code == 200
    assert updated.json()["handled"] is True

    assert (
        client.get(
            "/api/admin/contact-messages?unhandled_only=true", headers=admin_headers
        ).json()
        == []
    )
