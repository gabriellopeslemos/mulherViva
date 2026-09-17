"""Best-effort e-mail notifications for appointments.

Sending runs in a daemon thread and swallows all errors so a failing SMTP
server can never break or block a booking request. Callers pass a plain dict
snapshot of the appointment (never an ORM object) to stay session-safe.
"""

import logging
import smtplib
import threading
from datetime import date, datetime, time, timezone
from email.message import EmailMessage
from urllib.parse import urlencode

from ..config import get_settings
from . import email as email_service

logger = logging.getLogger(__name__)

WEEKDAYS_PT = [
    "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira",
    "sexta-feira", "sábado", "domingo",
]
MONTHS_PT = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
]


def _format_date_pt(d: date) -> str:
    return f"{WEEKDAYS_PT[d.weekday()]}, {d.day} de {MONTHS_PT[d.month - 1]} de {d.year}"


def _format_time(t: time) -> str:
    return t.strftime("%H:%M")


def manage_url(token: str | None) -> str | None:
    if not token:
        return None
    base = get_settings().public_base_url.rstrip("/")
    return f"{base}/?manage={token}"


def _ics_escape(value: str) -> str:
    """Escape a TEXT value per RFC 5545 (backslash, semicolon, comma, newline)."""
    return (
        value.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\n", "\\n")
    )


def google_calendar_link(appt: dict) -> str:
    """calendar.google.com quick-add link: no OAuth, opens a pre-filled event."""
    settings = get_settings()
    start = datetime.combine(appt["date"], appt["start_time"])
    end = datetime.combine(appt["date"], appt["end_time"])
    location = (
        "Online (videoconferência)"
        if appt["type"] == "online"
        else settings.clinic_address
    )
    params = {
        "action": "TEMPLATE",
        "text": f"Consulta — {appt['specialty_name']}",
        "dates": f"{start.strftime('%Y%m%dT%H%M%S')}/{end.strftime('%Y%m%dT%H%M%S')}",
        "ctz": settings.timezone,
        "details": settings.clinic_name,
        "location": location,
    }
    return "https://calendar.google.com/calendar/render?" + urlencode(params)


def build_ics(appt: dict) -> str:
    """Minimal single-event iCalendar (floating local time)."""
    settings = get_settings()
    start = datetime.combine(appt["date"], appt["start_time"])
    end = datetime.combine(appt["date"], appt["end_time"])
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    uid = f"{appt.get('token') or appt['date'].isoformat()}@mulherviva"
    location = "Online (videoconferência)" if appt["type"] == "online" else settings.clinic_address
    summary = _ics_escape(f"Consulta — {appt['specialty_name']}")
    description = _ics_escape(settings.clinic_name)
    location = _ics_escape(location)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Mulher Viva//Agendamento//PT",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{uid}",
        f"DTSTAMP:{stamp}",
        f"DTSTART:{start.strftime('%Y%m%dT%H%M%S')}",
        f"DTEND:{end.strftime('%Y%m%dT%H%M%S')}",
        f"SUMMARY:{summary}",
        f"DESCRIPTION:{description}",
        f"LOCATION:{location}",
        "END:VEVENT",
        "END:VCALENDAR",
    ]
    return "\r\n".join(lines) + "\r\n"


def _send(
    to: str,
    subject: str,
    body: str,
    ics: str | None = None,
) -> bool:
    settings = get_settings()
    if not settings.notifications_enabled:
        logger.info("Notifications disabled; skipping e-mail to %s", to)
        return False
    if not settings.smtp_host or not to:
        return False

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = to
    msg.set_content(body)
    if ics:
        msg.add_attachment(
            ics.encode("utf-8"),
            maintype="text",
            subtype="calendar",
            filename="consulta.ics",
        )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            if settings.smtp_use_tls:
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.send_message(msg)
        logger.info("Sent e-mail '%s' to %s", subject, to)
        return True
    except Exception:
        logger.exception("Failed to send e-mail to %s", to)
        return False


def _send_async(to: str, subject: str, body: str, ics: str | None = None) -> None:
    threading.Thread(target=_send, args=(to, subject, body, ics), daemon=True).start()


def _appt_lines(appt: dict) -> list[str]:
    modality = "Online (videoconferência)" if appt["type"] == "online" else "Presencial"
    return [
        f"Especialidade: {appt['specialty_name']}",
        f"Data: {_format_date_pt(appt['date'])}",
        f"Horário: {_format_time(appt['start_time'])} – {_format_time(appt['end_time'])}",
        f"Modalidade: {modality}",
    ]


def notify_booking_received(appt: dict) -> None:
    """Solicitação registrada, aguardando confirmação da equipe."""
    settings = get_settings()
    body = "\n".join([
        f"Olá, {appt['client_name']}!",
        "",
        "Recebemos sua solicitação de agendamento. Nossa equipe entrará em "
        "contato em breve para confirmar a consulta.",
        "",
        *_appt_lines(appt),
        "",
        "Se precisar alterar algo, basta responder este e-mail.",
        "",
        settings.clinic_name,
    ])
    _send_async(appt.get("client_email"), "Recebemos sua solicitação de consulta", body)


def _manage_lines(appt: dict) -> list[str]:
    url = manage_url(appt.get("token"))
    if not url:
        return []
    return ["", f"Para cancelar ou reagendar, acesse: {url}"]


def _send_confirmation_via_resend(appt: dict) -> None:
    email_service.send_booking_confirmation(
        to_email=appt.get("client_email"),
        client_name=appt["client_name"],
        specialty_name=appt["specialty_name"],
        day=appt["date"],
        start=appt["start_time"],
        end=appt["end_time"],
        modality=appt["type"],
        manage_link=manage_url(appt.get("token")) or "",
        calendar_link=google_calendar_link(appt),
        ics=build_ics(appt),
    )


def notify_booking_confirmed(appt: dict) -> None:
    """Sends the booking-confirmed e-mail via Resend (see app/services/email.py)."""
    if not appt.get("client_email"):
        return
    threading.Thread(target=_send_confirmation_via_resend, args=(appt,), daemon=True).start()


def notify_booking_cancelled(appt: dict) -> None:
    settings = get_settings()
    body = "\n".join([
        f"Olá, {appt['client_name']}.",
        "",
        "Sua consulta foi cancelada:",
        "",
        *_appt_lines(appt),
        "",
        "Para remarcar, entre em contato conosco ou faça um novo agendamento "
        "pelo site.",
        "",
        settings.clinic_name,
    ])
    _send_async(appt.get("client_email"), "Sua consulta foi cancelada", body)


def _send_reschedule_via_resend(appt: dict) -> None:
    email_service.send_booking_rescheduled(
        to_email=appt.get("client_email"),
        client_name=appt["client_name"],
        specialty_name=appt["specialty_name"],
        day=appt["date"],
        start=appt["start_time"],
        end=appt["end_time"],
        modality=appt["type"],
        manage_link=manage_url(appt.get("token")) or "",
        calendar_link=google_calendar_link(appt),
        ics=build_ics(appt),
    )


def notify_booking_rescheduled(appt: dict) -> None:
    """Sends the booking-rescheduled e-mail via Resend (see app/services/email.py)."""
    if not appt.get("client_email"):
        return
    threading.Thread(target=_send_reschedule_via_resend, args=(appt,), daemon=True).start()


def notify_status_change(appt: dict, status: str) -> None:
    if status == "confirmed":
        notify_booking_confirmed(appt)
    elif status == "cancelled":
        notify_booking_cancelled(appt)


def notify_reminder(appt: dict) -> bool:
    """Send the 24h reminder via Resend synchronously and report whether it was sent.

    Unlike the other notifiers, this returns the result so the reminder loop
    only marks an appointment as reminded when the e-mail actually went out
    (the loop already runs in a worker thread, so blocking here is fine).
    """
    if not appt.get("client_email"):
        return False
    return email_service.send_booking_reminder(
        to_email=appt["client_email"],
        client_name=appt["client_name"],
        specialty_name=appt["specialty_name"],
        day=appt["date"],
        start=appt["start_time"],
        end=appt["end_time"],
        modality=appt["type"],
        manage_link=manage_url(appt.get("token")) or "",
    )


def notify_waitlist_slot(entry: dict) -> None:
    """A slot opened up for someone on the waitlist."""
    settings = get_settings()
    base = settings.public_base_url.rstrip("/")
    body = "\n".join([
        f"Olá, {entry['client_name']}!",
        "",
        f"Abriu um horário para {entry['specialty_name']}. "
        "Como você estava na lista de espera, avisamos primeiro.",
        "",
        f"Garanta seu horário pelo site: {base}/#agendamento",
        "",
        settings.clinic_name,
    ])
    _send_async(entry.get("client_email"), "Abriu um horário para sua consulta", body)
