import { test, expect } from '@playwright/test'
import {
  newApi,
  adminApi,
  specialtyBySlug,
  openDay,
  futureDate,
  getSlots,
  bookViaApi,
  listAppointments,
  clearAvailability,
  resetSettings,
} from './helpers/api.js'
import { signJwt, seedAdminToken, TOKEN_KEY } from './helpers/auth.js'

// ---------- utilidades locais ----------

/** Segunda-feira (UTC, sobre a string YYYY-MM-DD) da semana da data. */
function mondayOf(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7))
  return dt
}

/** Quantas semanas a data está à frente da semana de hoje (SP). */
function weeksAhead(dateStr) {
  const diffMs = mondayOf(dateStr) - mondayOf(futureDate(0))
  return Math.round(diffMs / (7 * 24 * 3600 * 1000))
}

/** Abre o painel admin pela navbar: Login -> hub -> Agenda (semana de hoje). */
async function openAgendaFromLanding(page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Login' }).click()
  const hub = page.getByRole('dialog', { name: 'Painel administrativo' })
  await expect(hub).toBeVisible()
  await hub.getByRole('button', { name: /Agenda/ }).click()
  await expect(page.getByRole('dialog', { name: 'Agenda da clínica' })).toBeVisible()
}

/** Navega a agenda (visão semanal) até a semana que contém `dateStr`. */
async function goToWeekOf(page, dateStr) {
  const agenda = page.getByRole('dialog', { name: 'Agenda da clínica' })
  const n = weeksAhead(dateStr)
  for (let i = 0; i < n; i += 1) {
    await agenda.getByRole('button', { name: 'Próxima semana' }).click()
  }
}

/** Quantidade exibida no contador "Aguardando" da legenda (0 se não houver). */
async function pendingBadge(page) {
  const badge = page.locator('.ag-legend__count')
  if ((await badge.count()) === 0) return 0
  return Number((await badge.first().textContent()).trim())
}

async function deleteAppointment(admin, id) {
  await admin.delete(`/api/admin/appointments/${id}`)
}

// =====================================================================
// 19. Proteção de acesso
// =====================================================================

test('19a. API admin recusa requisições sem JWT, com e-mail fora da allowlist e com chave errada', async () => {
  const api = await newApi()
  try {
    const semToken = await api.get('/api/admin/appointments')
    expect(semToken.status()).toBe(401)

    const intruso = signJwt({ sub: 'intruso@x.com' })
    const foraDaLista = await api.get('/api/admin/appointments', {
      headers: { Authorization: `Bearer ${intruso}` },
    })
    expect(foraDaLista.status()).toBe(401)

    const outraChave = signJwt({ secret: 'outra-chave-que-nao-e-a-do-servidor-123456' })
    const assinaturaInvalida = await api.get('/api/admin/appointments', {
      headers: { Authorization: `Bearer ${outraChave}` },
    })
    expect(assinaturaInvalida.status()).toBe(401)

    const expirado = await api.get('/api/admin/appointments', {
      headers: { Authorization: `Bearer ${signJwt({ expInSeconds: -60 })}` },
    })
    expect(expirado.status()).toBe(401)

    // Controle positivo: um JWT válido do admin permitido passa.
    const valido = await api.get('/api/admin/appointments', {
      headers: { Authorization: `Bearer ${signJwt()}` },
    })
    expect(valido.status()).toBe(200)
  } finally {
    await api.dispose()
  }
})

test('19b. UI: JWT expirado no localStorage derruba a agenda para o login e limpa o token', async ({ page }) => {
  await seedAdminToken(page, signJwt({ expInSeconds: -60 }))
  await page.goto('/')

  // A UI só checa a presença do token: o hub abre normalmente...
  await page.getByRole('button', { name: 'Login' }).click()
  const hub = page.getByRole('dialog', { name: 'Painel administrativo' })
  await expect(hub).toBeVisible()

  // ...e o 401 da primeira chamada autenticada (agenda) expira a sessão.
  await hub.getByRole('button', { name: /Agenda/ }).click()

  await expect(page.getByRole('heading', { name: 'Área administrativa' })).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Agenda da clínica' })).toHaveCount(0)
  await expect(page.getByRole('dialog', { name: 'Painel administrativo' })).toHaveCount(0)
  expect(await page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY)).toBeNull()
})

// =====================================================================
// 20. Dev-login -> hub -> agenda
// =====================================================================

test('20. dev-login pela UI grava o JWT, abre o hub e carrega a agenda da semana', async ({ page }) => {
  await page.goto('/')
  expect(await page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY)).toBeNull()

  await page.getByRole('button', { name: 'Login' }).click()
  await expect(page.getByRole('heading', { name: 'Área administrativa' })).toBeVisible()

  await page.getByRole('button', { name: 'Entrar sem Google (dev)' }).click()

  // Hub aberto e JWT gravado.
  const hub = page.getByRole('dialog', { name: 'Painel administrativo' })
  await expect(hub).toBeVisible()
  const token = await page.evaluate((k) => window.localStorage.getItem(k), TOKEN_KEY)
  expect(token).toBeTruthy()
  expect(token.split('.')).toHaveLength(3)

  // O token gravado é aceito pela API admin.
  const api = await newApi()
  try {
    const res = await api.get('/api/admin/appointments', {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(res.status()).toBe(200)
  } finally {
    await api.dispose()
  }

  // Hub -> Agenda: visão semanal com 7 colunas de dia.
  await expect(hub.getByRole('heading', { name: 'Blog' })).toBeVisible()
  await hub.getByRole('button', { name: /Agenda/ }).click()
  const agenda = page.getByRole('dialog', { name: 'Agenda da clínica' })
  await expect(agenda).toBeVisible()
  await expect(agenda.getByRole('heading', { name: 'Agenda' })).toBeVisible()
  await expect(agenda.getByRole('button', { name: 'Semana anterior' })).toBeVisible()
  await expect(agenda.getByRole('radio', { name: 'Semana' })).toBeChecked()
  await expect(agenda.locator('.ag-grid__dayhead')).toHaveCount(7)
  await expect(agenda.getByText('Mostrar canceladas')).toBeVisible()
  await expect(page.getByText('Não foi possível carregar a agenda.')).toHaveCount(0)
})

// =====================================================================
// 21. Confirmar pendente
// =====================================================================

test('21. confirmar reserva pendente pela UI: status confirmed, contador cai e toast aparece', async ({ page }) => {
  const admin = await adminApi()
  const api = await newApi()
  await clearAvailability(admin.ctx)
  const date = futureDate(10)
  const { cleanup } = await openDay(admin.ctx, date)
  let apptId
  try {
    const spec = await specialtyBySlug(api)
    const slots = await getSlots(api, spec.id, date)
    expect(slots.length).toBeGreaterThan(0)
    const nome = `Confirmar E2E ${Date.now()}`
    const appt = await bookViaApi(api, {
      specialtyId: spec.id,
      date,
      start: slots[0].start,
      client_name: nome,
    })
    apptId = appt.id
    expect(appt.status).toBe('pending')

    await seedAdminToken(page, admin.token)
    await openAgendaFromLanding(page)
    await goToWeekOf(page, date)

    const card = page.getByRole('button', { name: new RegExp(nome) })
    await expect(card).toBeVisible()
    await expect(card).toHaveClass(/ag-appt--pending/)
    const antes = await pendingBadge(page)
    expect(antes).toBeGreaterThanOrEqual(1)

    await card.click()
    const detalhes = page.getByRole('dialog', { name: 'Detalhes da consulta' })
    await expect(detalhes).toBeVisible()
    await detalhes.getByRole('button', { name: 'Confirmar consulta' }).click()

    // Toast, modal fechado, cartão confirmado e contador diminuído em 1.
    await expect(page.getByRole('status').filter({ hasText: 'Consulta confirmada.' })).toBeVisible()
    await expect(detalhes).toHaveCount(0)
    await expect(card).toHaveClass(/ag-appt--confirmed/)
    await expect.poll(() => pendingBadge(page)).toBe(antes - 1)

    // API: status persistido como confirmed.
    const list = await listAppointments(admin.ctx, { date_from: date, date_to: date })
    expect(list.find((a) => a.id === apptId).status).toBe('confirmed')
  } finally {
    if (apptId) await deleteAppointment(admin.ctx, apptId)
    await cleanup()
    await resetSettings(admin.ctx)
    await admin.dispose()
    await api.dispose()
  }
})

// =====================================================================
// 22. Cancelar pelo admin
// =====================================================================

test('22. cancelar pelo admin: some da agenda (exceto com "Mostrar canceladas"), status cancelled e slot liberado', async ({ page }) => {
  const admin = await adminApi()
  const api = await newApi()
  await clearAvailability(admin.ctx)
  const date = futureDate(10)
  const { cleanup } = await openDay(admin.ctx, date)
  let apptId
  try {
    const spec = await specialtyBySlug(api)
    const antes = await getSlots(api, spec.id, date)
    expect(antes.length).toBeGreaterThan(0)
    const slot = antes[0]
    const nome = `Cancelar E2E ${Date.now()}`
    const appt = await bookViaApi(api, {
      specialtyId: spec.id,
      date,
      start: slot.start,
      client_name: nome,
    })
    apptId = appt.id

    // Reserva ocupa o slot.
    const ocupado = await getSlots(api, spec.id, date)
    expect(ocupado.map((s) => s.start)).not.toContain(slot.start)

    await seedAdminToken(page, admin.token)
    await openAgendaFromLanding(page)
    await goToWeekOf(page, date)

    const agenda = page.getByRole('dialog', { name: 'Agenda da clínica' })
    const card = agenda.getByRole('button', { name: new RegExp(nome) })
    await expect(card).toBeVisible()

    await card.click()
    await page
      .getByRole('dialog', { name: 'Detalhes da consulta' })
      .getByRole('button', { name: 'Marcar como cancelada' })
      .click()

    // Modal de confirmação (confirm-cancel).
    const confirmar = page.getByRole('dialog', { name: 'Cancelar consulta' })
    await expect(confirmar).toBeVisible()
    await expect(confirmar).toContainText(nome)
    await confirmar.getByRole('button', { name: 'Marcar como cancelada' }).click()

    await expect(
      page.getByRole('status').filter({ hasText: 'Consulta marcada como cancelada.' }),
    ).toBeVisible()
    await expect(confirmar).toHaveCount(0)

    // Estado 1: "Mostrar canceladas" desmarcado -> some da agenda.
    const toggle = agenda.getByLabel('Mostrar canceladas')
    await expect(toggle).not.toBeChecked()
    await expect(card).toHaveCount(0)

    // Estado 2: marcado -> reaparece como cancelada.
    await toggle.check()
    await expect(card).toBeVisible()
    await expect(card).toHaveClass(/ag-appt--cancelled/)

    // Desmarcar -> some de novo.
    await toggle.uncheck()
    await expect(card).toHaveCount(0)

    // API: status cancelled e slot liberado.
    const list = await listAppointments(admin.ctx, { date_from: date, date_to: date })
    expect(list.find((a) => a.id === apptId).status).toBe('cancelled')
    const depois = await getSlots(api, spec.id, date)
    expect(depois.map((s) => s.start)).toContain(slot.start)
    expect(depois.length).toBe(antes.length)
  } finally {
    if (apptId) await deleteAppointment(admin.ctx, apptId)
    await cleanup()
    await resetSettings(admin.ctx)
    await admin.dispose()
    await api.dispose()
  }
})
