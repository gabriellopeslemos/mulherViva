import base64
import html
import logging
from datetime import date, time
from pathlib import Path
from urllib.parse import quote, urlsplit

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"

# Imagens enviadas como anexo inline (cid:) para aparecerem em qualquer
# ambiente, sem depender de onde o site está hospedado.
EMAIL_ASSETS_DIR = Path(__file__).resolve().parents[1] / "email_assets"
LOGO_CID = "logo-mark"
MAP_CID = "clinic-map"
_INLINE_ASSETS = {LOGO_CID: "logo-mark.png", MAP_CID: "email-map.jpg"}

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

MODALITY_LABELS = {
    "online": "Online",
    "presencial": "Presencial",
    "presencial_bsb": "Presencial — Brasília",
    "presencial_rj": "Presencial — Rio de Janeiro",
}


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


def _cta_button(label: str, url: str) -> str:
    return f"""
                <tr>
                  <td style="padding-top: 14px;">
                    <a href="{html.escape(url)}" style="display: inline-block; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 14px; font-weight: 700; color: #74284a; text-decoration: underline;">{html.escape(label)} &rarr;</a>
                  </td>
                </tr>"""


# Confirmation email palette — hex equivalents of the site tokens in
# src/index.css (email clients support neither CSS variables nor color-mix()).
_C_PLUM = "#5e2f52"  # --palette-1
_C_PLUM_DEEP = "#502846"  # --palette-1 mixed toward black (hero band gradient)
_C_ACCENT = "#7a3e6a"  # --palette-2 / --accent
_C_ROSE = "#9a4067"  # --palette-3 / --gold
_C_PINK = "#e498b4"  # --palette-4
_C_BLUSH = "#f3cbd3"  # --palette-5
_C_BG = "#fdf6f7"  # --bg
_C_SURFACE = "#fffdfd"  # --surface
_C_SURFACE_SOFT = "#fbeff2"  # --surface-soft
_C_LINE = "#f6dbe5"  # --line
_C_TEXT_STRONG = "#3d1f35"  # --text-strong
_C_TEXT_SOFT = "#764e6c"  # --text-soft
_C_TEXT_MUTED = "#8b6982"  # --text-muted
_SERIF = "Lora, 'Palatino Linotype', Palatino, Georgia, serif"
_SANS = "Mulish, 'Segoe UI', Helvetica, Arial, sans-serif"


def _ticket_label(label: str) -> str:
    return (
        f'<p style="margin: 0; font-family: {_SANS}; font-size: 13px; line-height: 1.4; '
        f'color: {_C_TEXT_MUTED};">{label}</p>'
    )


def _ticket_divider() -> str:
    return f"""
                <tr>
                  <td class="tk-px" style="padding: 0 32px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top: 1px solid {_C_LINE}; font-size: 0; line-height: 0;">&nbsp;</td></tr></table>
                  </td>
                </tr>"""


def _ticket_button(label: str, url: str, primary: bool) -> str:
    """Bulletproof full-width button: padded link inside a colored cell (works in Outlook)."""
    bg = _C_PLUM if primary else _C_SURFACE
    fg = "#ffffff" if primary else _C_ACCENT
    border = _C_PLUM if primary else _C_PINK
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td align="center" bgcolor="{bg}" style="background-color: {bg}; border: 1px solid {border}; border-radius: 14px;">
                                <a href="{html.escape(url)}" target="_blank" style="display: block; padding: 15px 12px; font-family: {_SANS}; font-size: 14px; font-weight: 700; line-height: 1; text-align: center; color: {fg}; text-decoration: none; border-radius: 14px;">{html.escape(label)}</a>
                              </td>
                            </tr>
                          </table>"""


def _ticket_perforation() -> str:
    """Dashed tear line between the ticket's tinted header and its body, with
    half-circle notches on both edges (like the booking ticket on the site)."""
    notch = (
        f"width: 12px; height: 24px; background-color: {_C_BG}; "
        f"border: 1px solid {_C_LINE}; font-size: 0; line-height: 0;"
    )
    return f"""
                <tr>
                  <td>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="12" bgcolor="{_C_BG}" style="{notch} border-left: none; border-radius: 0 12px 12px 0;">&nbsp;</td>
                        <td>
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr><td height="12" bgcolor="{_C_SURFACE_SOFT}" style="height: 12px; background-color: {_C_SURFACE_SOFT}; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                            <tr><td height="12" bgcolor="{_C_SURFACE}" style="height: 12px; background-color: {_C_SURFACE}; border-top: 2px dashed {_C_PINK}; font-size: 0; line-height: 0;">&nbsp;</td></tr>
                          </table>
                        </td>
                        <td width="12" bgcolor="{_C_BG}" style="{notch} border-right: none; border-radius: 12px 0 0 12px;">&nbsp;</td>
                      </tr>
                    </table>
                  </td>
                </tr>"""


def _ticket_map(clinic_address: str, map_image_url: str) -> str:
    """Static map (clickable, opens Google Maps) + address, closing the ticket."""
    address = clinic_address.strip()
    maps_url = html.escape("https://www.google.com/maps/search/?api=1&query=" + quote(address))
    place, _, rest = address.partition(",")
    if map_image_url:
        map_img = f"""
                <tr>
                  <td style="padding-top: 4px; font-size: 0; line-height: 0;">
                    <a href="{maps_url}" target="_blank" style="display: block; text-decoration: none;"><img src="{html.escape(map_image_url)}" width="600" alt="Mapa: {html.escape(address)}" style="display: block; width: 100%; max-width: 600px; height: auto; border: 0; border-top: 1px solid {_C_LINE}; border-bottom: 1px solid {_C_LINE};" /></a>
                  </td>
                </tr>"""
    else:
        map_img = _ticket_divider()
    rest_html = ""
    if rest.strip():
        rest_html = (
            f'<p style="margin: 4px 0 0; font-family: {_SANS}; font-size: 14px; line-height: 1.6; '
            f'color: {_C_TEXT_SOFT};">{html.escape(rest.strip())}</p>'
        )
    return f"""{map_img}
                <tr>
                  <td class="tk-px" align="center" style="padding: 20px 32px 26px; text-align: center;">
                    <a href="{maps_url}" target="_blank" style="font-family: {_SERIF}; font-size: 18px; font-weight: 600; line-height: 1.35; color: {_C_TEXT_STRONG}; text-decoration: none;">{html.escape(place.strip())}</a>
                    {rest_html}
                  </td>
                </tr>"""


PAYMENT_PIX_KEY = "61578176000110"
PAYMENT_PHONE_LABEL = "21 98865-2027"
PAYMENT_PROOF_MESSAGE = "Olá! Segue o comprovante de pagamento da minha consulta."


def _payment_row(icon: str, label: str, value_html: str, last: bool = False) -> str:
    border = "" if last else f" border-bottom: 1px solid {_C_LINE};"
    return f"""<tr>
                          <td width="40" valign="middle" style="width: 40px; padding: 14px 0;{border}">
                            <table role="presentation" width="32" cellpadding="0" cellspacing="0" border="0"><tr>
                              <td align="center" valign="middle" width="32" height="32" bgcolor="{_C_SURFACE}" style="width: 32px; height: 32px; border-radius: 10px; background-color: {_C_SURFACE}; border: 1px solid {_C_LINE}; font-family: {_SANS}; font-size: 11px; font-weight: 800; line-height: 32px; letter-spacing: 0.4px; color: {_C_ACCENT};">{icon}</td>
                            </tr></table>
                          </td>
                          <td valign="middle" style="padding: 14px 0 14px 12px;{border}">
                            <p style="margin: 0; font-family: {_SANS}; font-size: 11px; font-weight: 800; line-height: 1.4; letter-spacing: 1.2px; text-transform: uppercase; color: {_C_TEXT_MUTED};">{label}</p>
                            <p style="margin: 2px 0 0; font-family: {_SERIF}; font-size: 19px; font-weight: 600; line-height: 1.3; color: {_C_TEXT_STRONG};">{value_html}</p>
                          </td>
                        </tr>"""


def _ticket_payment(whatsapp_number: str = "") -> str:
    """Payment instructions: Pix key + where to send the proof, in a soft inset card."""
    phone_html = PAYMENT_PHONE_LABEL
    wa_digits = "".join(ch for ch in whatsapp_number if ch.isdigit())
    if wa_digits:
        wa_url = f"https://wa.me/{wa_digits}?text={quote(PAYMENT_PROOF_MESSAGE)}"
        phone_html = (
            f'<a href="{html.escape(wa_url)}" target="_blank" style="color: {_C_TEXT_STRONG}; '
            f'text-decoration: none;">{PAYMENT_PHONE_LABEL}</a>'
        )
    return f"""
                <!-- Pagamento -->
                <tr>
                  <td class="tk-px" style="padding: 0 32px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{_C_SURFACE_SOFT}" style="background-color: {_C_SURFACE_SOFT}; border: 1px solid {_C_LINE}; border-radius: 18px;">
                      <tr>
                        <td style="padding: 18px 20px 4px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                              <td valign="middle">
                                <p style="margin: 0; font-family: {_SERIF}; font-size: 18px; font-weight: 600; line-height: 1.3; color: {_C_TEXT_STRONG};">Pagamento</p>
                              </td>
                              <td align="right" valign="middle" style="text-align: right; white-space: nowrap;">
                                <span style="display: inline-block; padding: 5px 10px; border-radius: 999px; background-color: {_C_BLUSH}; font-family: {_SANS}; font-size: 11px; font-weight: 800; line-height: 1.2; letter-spacing: 0.4px; color: {_C_PLUM};">Na véspera da consulta</span>
                              </td>
                            </tr>
                          </table>
                          <p style="margin: 8px 0 0; font-family: {_SANS}; font-size: 14px; line-height: 1.55; color: {_C_TEXT_SOFT};">Faça o Pix e envie o comprovante para a Equipe Mulher Viva.</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 20px 6px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        {_payment_row("PIX", "Chave Pix &middot; CNPJ", f'<span style="letter-spacing: 0.6px;">{PAYMENT_PIX_KEY}</span>')}
                        {_payment_row("&#9742;", "Comprovante via WhatsApp", phone_html, last=True)}
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>"""


WHATSAPP_MESSAGE = "Olá! Tenho uma consulta agendada e gostaria de falar com a equipe."


def _footer_link(label: str, url: str) -> str:
    return (
        f'<a href="{html.escape(url)}" target="_blank" style="display: inline-block; margin: 0 18px 6px 0; '
        f"font-family: {_SANS}; font-size: 12px; font-weight: 700; color: {_C_TEXT_STRONG}; "
        f'text-decoration: none; white-space: nowrap;">{label}</a>'
    )


def _email_footer(logo_url: str = "", site_url: str = "", whatsapp_number: str = "") -> str:
    logo_html = ""
    if logo_url:
        logo_html = f"""<td valign="middle" style="padding-right: 10px;">
                          <img src="{html.escape(logo_url)}" width="28" height="28" alt="" style="display: block; width: 28px; height: 28px; border: 0; border-radius: 50%;" />
                        </td>
                        """

    links = ""
    if site_url:
        site_label = urlsplit(site_url).netloc or site_url
        links += _footer_link(html.escape(site_label), site_url)
    wa_digits = "".join(ch for ch in whatsapp_number if ch.isdigit())
    if wa_digits:
        links += _footer_link(
            "WhatsApp", f"https://wa.me/{wa_digits}?text={quote(WHATSAPP_MESSAGE)}"
        )
    links_html = ""
    if links:
        links_html = f"""
                    <p style="margin: 14px 0 0; line-height: 1;">{links}</p>"""

    return f"""          <!-- Rodape -->
          <tr>
            <td style="padding-top: 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{_C_SURFACE_SOFT}" style="background-color: {_C_SURFACE_SOFT}; border-radius: 20px;">
                <tr>
                  <td class="px-foot" style="padding: 28px 32px 26px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        {logo_html}<td valign="middle">
                          <span style="font-family: {_SERIF}; font-size: 18px; font-weight: 700; line-height: 1; color: {_C_PLUM};">Mulher Viva</span>
                        </td>
                      </tr>
                    </table>
                    <p style="margin: 14px 0 0; font-family: {_SANS}; font-size: 12px; line-height: 1.65; color: {_C_TEXT_MUTED};">
                      Mensagem automática sobre o seu agendamento. Por favor, não responda este e-mail.
                    </p>{links_html}
                  </td>
                </tr>
              </table>
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
    manage_link: str = "",
    calendar_link: str = "",
    logo_url: str = "",
    site_url: str = "",
    whatsapp_number: str = "",
    map_image_url: str = "",
    price: str = "",
) -> str:
    first_name = html.escape(client_name.strip().split()[0] if client_name.strip() else "")
    specialty_esc = html.escape(specialty_name)
    is_online = modality == "online"
    modality_label = MODALITY_LABELS.get(modality, html.escape(modality))
    if is_online:
        modality_label = f"{modality_label} &middot; videoconferência"
    date_str = format_date_pt(day)
    weekday = WEEKDAYS_PT[day.weekday()]
    day_line = f"{weekday.capitalize()}, {day.day} de {MONTHS_PT[day.month - 1]}"
    weekday_short = weekday[:3].upper()
    month_short = MONTHS_PT[day.month - 1][:3].upper()
    preheader = f"{date_str.capitalize()}, às {format_time_pt(start)} &middot; {specialty_esc}"
    title_name = (
        f', <em style="font-style: italic; color: {_C_ACCENT};">{first_name}</em>' if first_name else ""
    )

    buttons = []
    if calendar_link:
        buttons.append(_ticket_button("Adicionar à agenda", calendar_link, primary=True))
    if manage_link:
        buttons.append(_ticket_button("Gerenciar consulta", manage_link, primary=not calendar_link))
    buttons_section = ""
    if buttons:
        if len(buttons) == 2:
            cells = f"""<td class="tk-btn" width="50%" valign="top" style="width: 50%; padding-right: 6px;">
                          {buttons[0]}
                        </td>
                        <td class="tk-btn" width="50%" valign="top" style="width: 50%; padding-left: 6px;">
                          {buttons[1]}
                        </td>"""
        else:
            cells = f"""<td valign="top">
                          {buttons[0]}
                        </td>"""
        buttons_section = f"""{_ticket_divider()}
                <tr>
                  <td class="tk-px" style="padding: 22px 32px 24px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        {cells}
                      </tr>
                    </table>
                  </td>
                </tr>"""

    # Desktop: coluna à direita. Mobile: a coluna some e o valor desce para
    # baixo da modalidade (sem espaço para três colunas).
    price_cell = ""
    price_inline = ""
    if price.strip():
        price_inline = f"""
                          <p class="tk-price-inline" style="display: none; max-height: 0; overflow: hidden; mso-hide: all; margin: 10px 0 0; font-family: {_SANS}; font-size: 13px; line-height: 1.4; color: {_C_TEXT_MUTED};">Valor <span style="font-family: {_SERIF}; font-size: 18px; font-weight: 600; color: {_C_TEXT_STRONG};">{html.escape(price.strip())}</span></p>"""
        price_cell = f"""
                        <td class="tk-price" align="right" valign="middle" style="padding-left: 16px; text-align: right; white-space: nowrap;">
                          <p style="margin: 0; font-family: {_SANS}; font-size: 13px; line-height: 1.4; color: {_C_TEXT_MUTED};">Valor</p>
                          <p style="margin: 4px 0 0; font-family: {_SERIF}; font-size: 24px; font-weight: 600; line-height: 1.15; color: {_C_TEXT_STRONG};">{html.escape(price.strip())}</p>
                        </td>"""

    map_section = ""
    if not is_online and clinic_address.strip():
        map_section = _ticket_map(clinic_address, map_image_url)

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light" />
  <title>Consulta confirmada</title>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,500&amp;family=Mulish:wght@400;600;700;800&amp;display=swap" rel="stylesheet" />
  <style>
    @media only screen and (max-width: 520px) {{
      .intro-title {{ font-size: 25px !important; }}
      .tk-top {{ padding: 22px 18px 20px !important; }}
      .tk-px {{ padding-left: 20px !important; padding-right: 20px !important; }}
      .tk-info {{ padding-left: 16px !important; }}
      .tk-time {{ font-size: 28px !important; }}
      .tk-price {{ display: none !important; }}
      .tk-price-inline {{ display: block !important; max-height: none !important; overflow: visible !important; }}
      .tk-btn {{ display: block !important; width: 100% !important; padding: 0 0 10px !important; }}
      .px-foot {{ padding-left: 22px !important; padding-right: 22px !important; }}
    }}
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: {_C_BG}; -webkit-text-size-adjust: 100%;">
  <div style="display: none; max-height: 0; overflow: hidden; opacity: 0; mso-hide: all;">{preheader}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="{_C_BG}" style="background-color: {_C_BG};">
    <tr>
      <td align="center" style="padding: 36px 12px 44px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Confirmacao -->
          <tr>
            <td align="center" style="padding: 0 16px 28px; text-align: center;">
              <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                <tr>
                  <td align="center" valign="middle" width="56" height="56" bgcolor="{_C_ACCENT}" style="width: 56px; height: 56px; border-radius: 50%; background-color: {_C_ACCENT}; background-image: linear-gradient(150deg, {_C_ACCENT} 0%, {_C_PLUM} 100%); box-shadow: 0 12px 28px rgba(94, 47, 82, 0.28); font-family: {_SANS}; font-size: 24px; font-weight: 800; line-height: 56px; color: #ffffff;">&#10003;</td>
                </tr>
              </table>
              <h1 class="intro-title" style="margin: 20px 0 0; font-family: {_SERIF}; font-size: 30px; font-weight: 500; line-height: 1.2; color: {_C_TEXT_STRONG};">Consulta confirmada{title_name}.</h1>
              <p style="margin: 10px 0 0; font-family: {_SANS}; font-size: 15px; line-height: 1.6; color: {_C_TEXT_SOFT};">Será um prazer receber você.</p>
            </td>
          </tr>

          <!-- Ticket -->
          <tr>
            <td bgcolor="{_C_SURFACE}" style="background-color: {_C_SURFACE}; border: 1px solid {_C_LINE}; border-radius: 24px; box-shadow: 0 24px 60px rgba(94, 47, 82, 0.10);">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Ticket: data, horario e modalidade -->
                <tr>
                  <td class="tk-top" bgcolor="{_C_SURFACE_SOFT}" style="padding: 28px 32px 22px; background-color: {_C_SURFACE_SOFT}; background-image: linear-gradient(160deg, {_C_SURFACE_SOFT} 0%, {_C_BG} 55%, {_C_SURFACE_SOFT} 100%); border-radius: 23px 23px 0 0;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="84" valign="middle" style="width: 84px;">
                          <table role="presentation" width="84" cellpadding="0" cellspacing="0" border="0" bgcolor="{_C_PLUM}" style="width: 84px; background-color: {_C_PLUM}; background-image: linear-gradient(160deg, {_C_ACCENT} 0%, {_C_PLUM} 100%); border-radius: 16px; box-shadow: 0 10px 24px rgba(94, 47, 82, 0.25);">
                            <tr>
                              <td align="center" style="padding: 12px 6px 0;">
                                <span style="font-family: {_SANS}; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; color: {_C_BLUSH};">{month_short}</span>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding: 0 6px;">
                                <span style="font-family: {_SERIF}; font-size: 36px; font-weight: 500; line-height: 1.15; color: #ffffff;">{day.day}</span>
                              </td>
                            </tr>
                            <tr>
                              <td align="center" style="padding: 0 6px 12px;">
                                <span style="font-family: {_SANS}; font-size: 11px; font-weight: 800; letter-spacing: 1.6px; color: {_C_BLUSH};">{weekday_short}</span>
                              </td>
                            </tr>
                          </table>
                        </td>
                        <td class="tk-info" valign="middle" style="padding-left: 22px;">
                          <p style="margin: 0; font-family: {_SANS}; font-size: 14px; line-height: 1.4; color: {_C_TEXT_SOFT};">{day_line}</p>
                          <p style="margin: 4px 0 0; font-family: {_SERIF}; line-height: 1.15; color: {_C_TEXT_STRONG};"><span class="tk-time" style="font-size: 34px; font-weight: 600;">{format_time_pt(start)}</span><span style="font-size: 18px; font-weight: 500; color: {_C_TEXT_SOFT};"> às {format_time_pt(end)}</span></p>
                          <p style="margin: 8px 0 0; font-family: {_SANS}; font-size: 14px; font-weight: 700; line-height: 1.4; color: {_C_ACCENT};"><span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: {_C_PINK}; vertical-align: middle; margin-right: 8px;"></span>{modality_label}</p>{price_inline}
                        </td>{price_cell}
                      </tr>
                    </table>
                  </td>
                </tr>
{_ticket_perforation()}

                <!-- Especialidade -->
                <tr>
                  <td class="tk-px" style="padding: 14px 32px 20px;">
                    {_ticket_label("Você vai ser atendida em")}
                    <p style="margin: 4px 0 0; font-family: {_SERIF}; font-size: 22px; font-weight: 500; line-height: 1.3; color: {_C_TEXT_STRONG};">{specialty_esc}</p>
                  </td>
                </tr>

{_ticket_payment(whatsapp_number)}
{buttons_section}
{map_section}
              </table>
            </td>
          </tr>

          <!-- Assinatura -->
          <tr>
            <td align="center" style="padding: 30px 16px 0; text-align: center;">
              <p style="margin: 0; font-family: {_SERIF}; font-size: 16px; font-style: italic; line-height: 1.5; color: {_C_ACCENT};">Com carinho,</p>
              <p style="margin: 2px 0 0; font-family: {_SERIF}; font-size: 16px; font-weight: 600; line-height: 1.5; color: {_C_PLUM};">Equipe Mulher Viva</p>
            </td>
          </tr>

{_email_footer(logo_url, site_url, whatsapp_number)}

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def booking_rescheduled_html(
    client_name: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    clinic_address: str = "",
    manage_link: str = "",
    calendar_link: str = "",
) -> str:
    first_name = html.escape(client_name.strip().split()[0] if client_name.strip() else "")
    specialty_esc = html.escape(specialty_name)
    modality_label = MODALITY_LABELS.get(modality, html.escape(modality))
    date_str = format_date_pt(day)
    time_str = f"{format_time_pt(start)} &ndash; {format_time_pt(end)}"

    address_extra = ""
    if modality != "online" and clinic_address.strip():
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
  <title>Consulta remarcada</title>
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
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b9854c;">Consulta remarcada</span>
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
                      Sua consulta foi <strong style="color: #9a4067;">remarcada</strong>. Confira o novo horário:
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
                      Se o novo horário não funcionar para você, é só responder este
                      e-mail ou falar conosco para reagendar.
                    </p>
                  </td>
                </tr>
                {_cta_button("Adicionar ao Google Agenda", calendar_link) if calendar_link else ""}
                {_cta_button("Gerenciar minha consulta", manage_link) if manage_link else ""}
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


def send_booking_rescheduled(
    to_email: str,
    client_name: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    manage_link: str = "",
    calendar_link: str = "",
    ics: str | None = None,
) -> bool:
    settings = get_settings()
    subject = f"Consulta remarcada — {format_date_pt(day)} às {format_time_pt(start)}"
    body_html = booking_rescheduled_html(
        client_name=client_name,
        specialty_name=specialty_name,
        day=day,
        start=start,
        end=end,
        modality=modality,
        clinic_address=settings.clinic_address,
        manage_link=manage_link,
        calendar_link=calendar_link,
    )
    return _send_resend(
        to_email, subject, body_html, ics=ics, log_label="email de remarcacao"
    )


def _send_resend(
    to_email: str,
    subject: str,
    body_html: str,
    ics: str | None = None,
    log_label: str = "email",
    inline_cids: tuple[str, ...] = (),
) -> bool:
    settings = get_settings()
    if not settings.resend_api_key:
        logger.info("RESEND_API_KEY ausente; %s nao enviado", log_label)
        return False

    payload = {
        "from": settings.email_from,
        "to": [to_email],
        "subject": subject,
        "html": body_html,
    }
    attachments = []
    if ics:
        attachments.append(
            {
                "filename": "consulta.ics",
                "content": base64.b64encode(ics.encode("utf-8")).decode("ascii"),
            }
        )
    for cid in inline_cids:
        filename = _INLINE_ASSETS[cid]
        attachments.append(
            {
                "filename": filename,
                "content": base64.b64encode((EMAIL_ASSETS_DIR / filename).read_bytes()).decode("ascii"),
                "content_id": cid,
            }
        )
    if attachments:
        payload["attachments"] = attachments

    try:
        resp = httpx.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
            timeout=15,
        )
        resp.raise_for_status()
        return True
    except Exception:
        logger.warning("Falha ao enviar %s para %s", log_label, to_email, exc_info=True)
        return False


def send_booking_confirmation(
    to_email: str,
    client_name: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    manage_link: str = "",
    calendar_link: str = "",
    ics: str | None = None,
) -> bool:
    settings = get_settings()
    subject = f"Consulta confirmada — {format_date_pt(day)} às {format_time_pt(start)}"
    inline_cids = [LOGO_CID]
    map_image_url = settings.clinic_map_image_url
    # O mapa só entra para consulta presencial com endereço (é o que o template mostra).
    if not map_image_url and modality != "online" and settings.clinic_address.strip():
        map_image_url = f"cid:{MAP_CID}"
        inline_cids.append(MAP_CID)
    body_html = booking_confirmation_html(
        client_name=client_name,
        specialty_name=specialty_name,
        day=day,
        start=start,
        end=end,
        modality=modality,
        clinic_address=settings.clinic_address,
        manage_link=manage_link,
        calendar_link=calendar_link,
        logo_url=f"cid:{LOGO_CID}",
        site_url=settings.site_url,
        whatsapp_number=settings.clinic_whatsapp,
        map_image_url=map_image_url,
        price=settings.consultation_price,
    )
    return _send_resend(
        to_email,
        subject,
        body_html,
        ics=ics,
        log_label="email de confirmacao",
        inline_cids=tuple(inline_cids),
    )


def booking_reminder_html(
    client_name: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    clinic_address: str = "",
    manage_link: str = "",
) -> str:
    first_name = html.escape(client_name.strip().split()[0] if client_name.strip() else "")
    specialty_esc = html.escape(specialty_name)
    modality_label = MODALITY_LABELS.get(modality, html.escape(modality))
    date_str = format_date_pt(day)
    time_str = f"{format_time_pt(start)} &ndash; {format_time_pt(end)}"

    address_extra = ""
    if modality != "online" and clinic_address.strip():
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
  <title>Lembrete de consulta</title>
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
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b9854c;">Lembrete</span>
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
                      Este é um lembrete de que sua consulta é <strong style="color: #9a4067;">amanhã</strong>. Aqui estão os detalhes:
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

                {_cta_button("Gerenciar minha consulta", manage_link) if manage_link else ""}

                <tr>
                  <td style="padding-top: 28px; border-top: 1px solid #e8d4d8;">
                    <p style="margin: 28px 0 0; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; color: #74284a;">
                      Até amanhã,<br />Equipe Mulher Viva
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


def marketing_blog_post_html(
    title: str,
    excerpt: str,
    post_url: str,
    image_url: str = "",
    unsubscribe_note: str = "",
) -> str:
    title_esc = html.escape(title)
    excerpt_esc = html.escape(excerpt)
    cover = (
        f"""
                <tr>
                  <td style="padding-top: 20px;">
                    <img src="{html.escape(image_url)}" alt="" width="528" style="width: 100%; max-width: 528px; border-radius: 16px; display: block;" />
                  </td>
                </tr>"""
        if image_url
        else ""
    )

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{title_esc}</title>
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
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b9854c;">Novidade no blog</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 14px;">
                    <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 700; line-height: 1.3; color: #2b1421;">{title_esc}</h1>
                  </td>
                </tr>
                {cover}
                <tr>
                  <td style="padding-top: 18px;">
                    <p style="margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 16px; line-height: 1.6; color: #3a2230;">
                      {excerpt_esc}
                    </p>
                  </td>
                </tr>
                {_cta_button("Ler publicação completa", post_url)}
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
                {html.escape(unsubscribe_note) if unsubscribe_note else "Você recebeu este email por já ter contato com nossa clínica."}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_marketing_blog_post(
    to_email: str,
    title: str,
    excerpt: str,
    post_url: str,
    image_url: str = "",
    subject: str | None = None,
) -> bool:
    body_html = marketing_blog_post_html(
        title=title, excerpt=excerpt, post_url=post_url, image_url=image_url
    )
    return _send_resend(
        to_email,
        subject or title,
        body_html,
        log_label="email de marketing (blog)",
    )


def internal_new_booking_html(
    client_name: str,
    client_email: str,
    client_phone: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    is_first_visit: bool = False,
    reason: str = "",
    notes: str = "",
    admin_link: str = "",
) -> str:
    client_esc = html.escape(client_name)
    specialty_esc = html.escape(specialty_name)
    modality_label = MODALITY_LABELS.get(modality, html.escape(modality))
    date_str = format_date_pt(day)
    time_str = f"{format_time_pt(start)} &ndash; {format_time_pt(end)}"

    details = (
        _detail_row("Paciente", client_esc)
        + _detail_row("Contato", html.escape(f"{client_email} · {client_phone}" if client_phone else client_email))
        + _detail_row("Especialidade", specialty_esc)
        + _detail_row("Data", date_str)
        + _detail_row("Horário", time_str)
        + _detail_row(
            "Modalidade",
            modality_label,
            last=not (reason.strip() or notes.strip()),
        )
    )
    if reason.strip() or notes.strip():
        extra_rows = ""
        if reason.strip():
            extra_rows += _detail_row("Motivo", html.escape(reason.strip()))
        if notes.strip():
            extra_rows += _detail_row("Observações", html.escape(notes.strip()), last=True)
        details += extra_rows

    badge = "Primeira consulta" if is_first_visit else "Novo agendamento"

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Novo agendamento</title>
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
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; letter-spacing: 1px; color: #5d4250;">Painel administrativo</span>
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
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b9854c;">{html.escape(badge)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 14px;">
                    <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 700; line-height: 1.3; color: #2b1421;">Novo pedido de agendamento</h1>
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

                {_cta_button("Abrir agenda", admin_link) if admin_link else ""}
              </table>
            </td>
          </tr>

          <!-- Rodape -->
          <tr>
            <td align="center" style="padding: 24px 8px 0;">
              <p style="margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; line-height: 1.6; color: #5d4250;">
                Mulher Viva &middot; Notificação interna da equipe
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_internal_new_booking(
    to_email: str,
    client_name: str,
    client_email: str,
    client_phone: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    is_first_visit: bool = False,
    reason: str = "",
    notes: str = "",
    admin_link: str = "",
) -> bool:
    subject = f"Novo agendamento — {client_name} em {format_date_pt(day)}"
    body_html = internal_new_booking_html(
        client_name=client_name,
        client_email=client_email,
        client_phone=client_phone,
        specialty_name=specialty_name,
        day=day,
        start=start,
        end=end,
        modality=modality,
        is_first_visit=is_first_visit,
        reason=reason,
        notes=notes,
        admin_link=admin_link,
    )
    return _send_resend(
        to_email, subject, body_html, log_label="notificacao interna de agendamento"
    )


def booking_links_html(client_name: str, appointments: list[dict]) -> str:
    """E-mail listing every upcoming appointment with its manage link.

    Sent when the patient asks for their manage link(s) again from the site.
    Each item in ``appointments`` is a dict with ``specialty_name``, ``date``,
    ``start_time``, ``end_time``, ``type`` and ``manage_link``.
    """
    first_name = html.escape(client_name.strip().split()[0] if client_name.strip() else "")

    items = ""
    for appt in appointments:
        modality_label = MODALITY_LABELS.get(appt["type"], html.escape(appt["type"]))
        time_str = f"{format_time_pt(appt['start_time'])} &ndash; {format_time_pt(appt['end_time'])}"
        items += f"""
                <tr>
                  <td style="padding-top: 16px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f7ebf0" style="background-color: #f7ebf0; border-radius: 16px;">
                      <tr>
                        <td style="padding: 20px 24px;">
                          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                            {_detail_row("Data", format_date_pt(appt["date"]))}
                            {_detail_row("Horário", time_str)}
                            {_detail_row("Especialidade", html.escape(appt["specialty_name"]))}
                            {_detail_row("Modalidade", modality_label, last=True)}
                          </table>
                          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top: 16px;">
                            <tr>
                              <td bgcolor="#9a4067" style="background-color: #9a4067; border-radius: 12px;">
                                <a href="{html.escape(appt["manage_link"])}" style="display: inline-block; padding: 12px 22px; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none;">Reagendar ou cancelar</a>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>"""

    plural = len(appointments) > 1
    intro = (
        "Aqui estão os links pessoais das suas próximas consultas. Por eles você pode reagendar ou cancelar sem precisar ligar."
        if plural
        else "Aqui está o link pessoal da sua próxima consulta. Por ele você pode reagendar ou cancelar sem precisar ligar."
    )

    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Seu link de gerenciamento</title>
</head>
<body style="margin: 0; padding: 0; background-color: #faf5f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #faf5f2; padding: 32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%;">

          <!-- Cabecalho / marca -->
          <tr>
            <td style="padding: 0 0 28px;">
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
                    <span style="font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #b9854c;">{"Suas consultas" if plural else "Sua consulta"}</span>
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
                      {intro}
                    </p>
                  </td>
                </tr>
                {items}
                <tr>
                  <td style="padding-top: 28px;">
                    <p style="margin: 0; font-family: 'Segoe UI', Tahoma, sans-serif; font-size: 13px; line-height: 1.6; color: #5d4250;">
                      Se você não pediu este e-mail, pode ignorá-lo. Os links são pessoais: não os compartilhe.
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
                Você recebeu este email porque pediu seu link de gerenciamento em nosso site.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def send_booking_links(to_email: str, client_name: str, appointments: list[dict]) -> bool:
    subject = (
        "Seus links para reagendar ou cancelar"
        if len(appointments) > 1
        else "Seu link para reagendar ou cancelar"
    )
    body_html = booking_links_html(client_name=client_name, appointments=appointments)
    return _send_resend(to_email, subject, body_html, log_label="email de links de gerenciamento")


def send_booking_reminder(
    to_email: str,
    client_name: str,
    specialty_name: str,
    day: date,
    start: time,
    end: time,
    modality: str,
    manage_link: str = "",
) -> bool:
    settings = get_settings()
    subject = f"Lembrete: sua consulta é amanhã, {format_date_pt(day)}"
    body_html = booking_reminder_html(
        client_name=client_name,
        specialty_name=specialty_name,
        day=day,
        start=start,
        end=end,
        modality=modality,
        clinic_address=settings.clinic_address,
        manage_link=manage_link,
    )
    return _send_resend(to_email, subject, body_html, log_label="lembrete de consulta")
