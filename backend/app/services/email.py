import html
import logging
from datetime import date, time

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

WEEKDAYS_PT = [
    "segunda-feira",
    "terça-feira",
    "quarta-feira",
    "quinta-feira",
    "sexta-feira",
    "sábado",
    "domingo",
]
MONTHS_PT = [
    "janeiro",
    "fevereiro",
    "março",
    "abril",
    "maio",
    "junho",
    "julho",
    "agosto",
    "setembro",
    "outubro",
    "novembro",
    "dezembro",
]

MODALITY_LABELS = {"online": "Online", "presencial": "Presencial"}


def format_date_pt(d: date) -> str:
    return f"{WEEKDAYS_PT[d.weekday()]}, {d.day} de {MONTHS_PT[d.month - 1]} de {d.year}"


def format_time_pt(t: time) -> str:
    return t.strftime("%H:%M")


def _detail_row(label: str, value: str, extra: str = "", last: bool = False) -> str:
    border = "border-bottom: none;" if last else "border-bottom: 1px solid #e8d4d8;"
    return f"""
      <tr>
        <td style="padding: 10px 0; {border} vertical-align: top;">
          <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #b9854c;">{label}</span>
        </td>
        <td align="right" style="padding: 10px 0 10px 16px; {border} vertical-align: top;">
          <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 15px; font-weight: 600; color: #2b1421;">{value}</span>{extra}
        </td>
      </tr>"""


def booking_confirmation_html(
    client_name: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    clinic_address: str = "",
) -> str:
    first_name = html.escape(client_name.strip().split()[0] if client_name.strip() else "")
    specialty_esc = html.escape(specialty_name)
    modality_label = MODALITY_LABELS.get(modality, html.escape(modality))
    date_str = format_date_pt(day)
    time_str = f"{format_time_pt(start)} &ndash; {format_time_pt(end)}"

    address_extra = ""
    if modality == "presencial" and clinic_address.strip():
        address_extra = (
            '<br /><span style="font-family: \'Segoe UI\', Tahoma, sans-serif; '
            'font-size: 13px; color: #5d4250;">'
            f"{html.escape(clinic_address.strip())}</span>"
        )

    details = (
        _detail_row("Data", date_str)
        + _detail_row("Horário", time_str)
        + _detail_row("Especialidade", specialty_esc)
        + _detail_row("Modalidade", modality_label, address_extra, last=True)
    )

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Consulta confirmada</title>
</head>
<body style="margin: 0; padding: 0; background-color: #faf5f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #faf5f2; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Cabecalho / marca -->
          <tr>
            <td style="padding: 0 8px 24px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td width="56" height="56" align="center" valign="middle" bgcolor="#9a4067" style="width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #9a4067, #74284a);">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; color: #ffffff;">MV</span>
                  </td>
                  <td style="padding-left: 14px;">
                    <span style="font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #74284a;">Mulher Viva</span><br />
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; letter-spacing: 1px; color: #5d4250;">Medicina Integrativa da Saúde Feminina</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Card principal -->
          <tr>
            <td bgcolor="#fffdfc" style="background-color: #fffdfc; border: 1px solid #e8d4d8; border-radius: 24px; padding: 40px 36px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b9854c;">Agendamento confirmado</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 14px;">
                    <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; font-weight: 700; line-height: 1.25; color: #2b1421;">Olá, {first_name}!</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <p style="margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 16px; line-height: 1.6; color: #3a2230;">
                      Sua consulta está <strong style="color: #9a4067;">confirmada</strong>. Aqui estão os detalhes:
                    </p>
                  </td>
                </tr>

                <!-- Card de detalhes -->
                <tr>
                  <td style="padding-top: 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7ebf0" style="background-color: #f7ebf0; border-radius: 16px;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            {details}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding-top: 24px;">
                    <p style="margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 14px; line-height: 1.6; color: #5d4250;">
                      Guarde este email — ele é a sua confirmação. Se precisar remarcar
                      ou cancelar, é só responder esta mensagem ou falar conosco.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 28px; border-top: 1px solid #e8d4d8;">
                    <p style="margin: 28px 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #74284a;">
                      Com carinho,<br />Equipe Mulher Viva
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rodape -->
          <tr>
            <td align="center" style="padding: 24px 8px 0;">
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; line-height: 1.6; color: #5d4250;">
                Mulher Viva &middot; Medicina Integrativa da Saúde Feminina<br />
                Você recebeu este email porque agendou uma consulta em nosso site.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_booking_confirmation(
    to_email: str,
    client_name: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
) -> bool:
    settings = get_settings()
    if not settings.resend_api_key:
        logger.info("RESEND_API_KEY ausente; email de confirmacao nao enviado")
        return False

    subject = f"Consulta confirmada — {format_date_pt(day)} às {format_time_pt(start)}"
    body_html = booking_confirmation_html(
        client_name=client_name,
        specialty_name=specialty_name,
        day=day,
        start=start,
        end=end,
        modality=modality,
        clinic_address=settings.clinic_address,
    )
    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={
                "from": settings.email_from,
                "to": [to_email],
                "subject": subject,
                "html": body_html,
            },
            timeout=15,
        )
        resp.raise_for_status()
        return True
    except Exception:
        logger.warning(
            "Falha ao enviar email de confirmacao para %s", to_email, exc_info=True
        )
        return False
