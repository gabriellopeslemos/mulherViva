/**
 * Single source of truth for the clinic's public details.
 *
 * These strings appear in the header, the contact block, the footer, the
 * structured data and the map link. Keeping one copy is what stops the page
 * from contradicting itself — before this existed the contact card advertised
 * a Rio de Janeiro office while the address section listed Brasília.
 */

export const clinic = {
  name: 'Mulher Viva',
  doctor: 'Dra. Luciana da Silva Lopes',
  tagline: 'Medicina Integrativa da Saúde Feminina',
  crm: '',

  building: 'Centro Médico Lúcio Costa',
  street: 'SGAS 610, Bloco 2, Sala 250',
  city: 'Brasília',
  state: 'DF',
  postalCode: '70200-700',
  country: 'BR',

  phoneDisplay: '(61) 3245-0000',
  // E.164, used for tel: and WhatsApp links.
  phoneE164: '+556132450000',
  whatsappDisplay: '(61) 99999-0000',
  whatsappE164: '5561999990000',
  email: 'contato@mulherviva.com.br',

  hours: 'Segunda a sexta, das 8h às 18h',
  responseTime: 'Respondemos em até 24h',
  instagram: 'https://www.instagram.com/',
}

export const fullAddress = `${clinic.building}, ${clinic.street} — ${clinic.city}/${clinic.state}`

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${clinic.building}, ${clinic.street}, ${clinic.city} - ${clinic.state}`,
)}`

export function whatsappUrl(message = 'Olá! Gostaria de agendar uma consulta.') {
  return `https://wa.me/${clinic.whatsappE164}?text=${encodeURIComponent(message)}`
}

export const specialtyOptions = [
  'Ginecologia Integrativa',
  'Obstetrícia Humanizada',
  'Homeopatia Clínica',
  'Outro assunto',
]
