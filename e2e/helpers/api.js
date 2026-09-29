// Helpers de API para montar/limpar estado dos testes e2e (não pela UI).
// Datas sempre relativas ao "hoje" de São Paulo; nunca use page.clock — o
// backend usa datetime.now() real.
import { request as pwRequest } from '@playwright/test'

export const API_URL = `http://127.0.0.1:${process.env.E2E_API_PORT || '8001'}`

const TZ = 'America/Sao_Paulo'

/** 'YYYY-MM-DD' de hoje + n dias, no fuso de São Paulo. */
export function futureDate(n) {
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
  const [y, m, d] = todayStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

/** Weekday no padrão do backend (0 = segunda … 6 = domingo). */
export function backendWeekday(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const js = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  return (js + 6) % 7
}

let phoneSeq = 0
/** Telefone único por reserva (o 4º pendente do mesmo telefone/dia dá 429). */
export function uniquePhone() {
  phoneSeq += 1
  const tail = `${Date.now()}${phoneSeq}`.slice(-9)
  return `619${tail}`
}

export async function newApi() {
  return pwRequest.newContext({ baseURL: API_URL })
}

async function ok(res, what) {
  if (!res.ok()) throw new Error(`${what} falhou: ${res.status()} ${await res.text()}`)
  return res.status() === 204 ? null : res.json()
}

export async function adminToken(api) {
  const data = await ok(await api.post('/api/auth/dev-login'), 'dev-login')
  return data.access_token
}

/** Cliente admin autenticado. `ctx` é um APIRequestContext com Bearer. */
export async function adminApi() {
  const anon = await newApi()
  const token = await adminToken(anon)
  const ctx = await pwRequest.newContext({
    baseURL: API_URL,
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  return { ctx, token, dispose: () => Promise.all([ctx.dispose(), anon.dispose()]) }
}

export async function getSpecialties(api) {
  return ok(await api.get('/api/specialties'), 'GET specialties')
}

export async function specialtyBySlug(api, slug = 'ginecologia') {
  const list = await getSpecialties(api)
  const found = list.find((s) => s.slug === slug)
  if (!found) throw new Error(`especialidade ${slug} não encontrada`)
  return found
}

// ---- disponibilidade ----

export async function createPeriod(admin, start_date, end_date = null) {
  return ok(
    await admin.post('/api/admin/availability/periods', { data: { start_date, end_date } }),
    'criar período',
  )
}

export async function createRule(admin, rule) {
  return ok(
    await admin.post('/api/admin/availability/rules', {
      data: { location: 'presencial_bsb', also_online: false, active: true, ...rule },
    }),
    'criar regra',
  )
}

/**
 * Período + regra no dia da semana de `date`, cobrindo essa data.
 * Retorna { period, rule, cleanup } — chame cleanup() ao final.
 */
export async function openDay(
  admin,
  date,
  { start_time = '09:00:00', end_time = '12:00:00', location = 'presencial_bsb', also_online = false } = {},
) {
  const period = await createPeriod(admin, futureDate(-1), null)
  const rule = await createRule(admin, {
    period_id: period.id,
    weekday: backendWeekday(date),
    start_time,
    end_time,
    location,
    also_online,
  })
  return {
    period,
    rule,
    cleanup: () =>
      admin.delete(`/api/admin/availability/periods/${period.id}`, { data: { force: true } }),
  }
}

export async function createOverride(admin, override) {
  return ok(
    await admin.post('/api/admin/availability/overrides', {
      data: { kind: 'block', ...override },
    }),
    'criar override',
  )
}

export async function deleteOverride(admin, id) {
  return ok(await admin.delete(`/api/admin/availability/overrides/${id}`), 'remover override')
}

/** Remove todos os períodos/regras e overrides — reset global entre specs. */
export async function clearAvailability(admin) {
  const periods = await ok(await admin.get('/api/admin/availability/periods'), 'listar períodos')
  for (const p of periods) {
    await admin.delete(`/api/admin/availability/periods/${p.id}`, { data: { force: true } })
  }
  const overrides = await ok(
    await admin.get('/api/admin/availability/overrides'),
    'listar overrides',
  )
  for (const o of overrides) await admin.delete(`/api/admin/availability/overrides/${o.id}`)
}

// ---- slots / reservas ----

export async function getSlots(api, specialtyId, date) {
  const data = await ok(
    await api.get('/api/slots', {
      params: { specialty_id: specialtyId, date_from: date, date_to: date },
    }),
    'GET slots',
  )
  return data.days.find((d) => d.date === date)?.slots ?? []
}

export async function bookViaApi(api, { specialtyId, date, start, type = 'presencial_bsb', ...rest }) {
  const res = await api.post('/api/bookings', {
    data: {
      specialty_id: specialtyId,
      date,
      start,
      type,
      client_name: 'Paciente E2E',
      client_email: 'paciente.e2e@example.com',
      client_phone: uniquePhone(),
      ...rest,
    },
  })
  return ok(res, 'POST bookings')
}

export async function listAppointments(admin, params = {}) {
  return ok(await admin.get('/api/admin/appointments', { params }), 'listar consultas')
}

// ---- configurações ----

export async function setSettings(admin, patch) {
  return ok(await admin.patch('/api/admin/settings', { data: patch }), 'PATCH settings')
}

export async function resetSettings(admin) {
  return setSettings(admin, {
    auto_confirm_bookings: false,
    buffer_minutes: 0,
    cancellation_window_hours: 12,
    max_booking_advance_days: 60,
  })
}
