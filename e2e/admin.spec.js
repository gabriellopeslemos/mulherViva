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
  setSettings,
  backendWeekday,
  createAdminAppointment,
  deleteAppointmentsNamed,
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
    // Reservas da LP já nascem confirmadas; "pendente" só existe quando o
    // admin cria/marca assim (ou em registros antigos).
    const appt = await createAdminAppointment(admin.ctx, {
      specialtyId: spec.id,
      date,
      start_time: slots[0].start,
      end_time: slots[0].end,
      client_name: nome,
      status: 'pending',
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

// =====================================================================
// utilidades das rodadas 2 e 3 (#23–#31)
// =====================================================================

const WEEKDAY_LABELS = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const HOUR_H = 64 // altura de 1h na grade (TimeGrid.HOUR_H)

const hhmm = (t) => t.slice(0, 5)
const agendaOf = (page) => page.getByRole('dialog', { name: 'Agenda da clínica' })
const cardOf = (page, nome) => agendaOf(page).getByRole('button', { name: new RegExp(nome) })

/** Sessão admin pronta: API autenticada, API pública, token semeado e especialidade. */
async function setupAdmin(page) {
  const admin = await adminApi()
  const api = await newApi()
  const spec = await specialtyBySlug(api)
  if (page) await seedAdminToken(page, admin.token)
  return {
    admin,
    api,
    spec,
    dispose: async () => {
      await admin.dispose()
      await api.dispose()
    },
  }
}

/** Abre a agenda já na semana que contém `date`. */
async function openAgendaAt(page, date) {
  await openAgendaFromLanding(page)
  await goToWeekOf(page, date)
}

async function findAppt(admin, id, date) {
  const list = await listAppointments(admin, { date_from: date, date_to: date })
  return list.find((a) => a.id === id)
}

/** Arrasta o cartão `deltaMin` minutos para baixo, longe das bordas (evita o auto-scroll). */
async function dragCardDown(page, card, deltaMin) {
  const box = await card.boundingBox()
  const x = box.x + box.width / 2
  const y = box.y + 12
  await page.mouse.move(x, y)
  await page.mouse.down()
  // 1º movimento já longe da borda superior: ativa o arrasto sem disparar auto-scroll.
  await page.mouse.move(x, y + 60)
  await page.mouse.move(x, y + (deltaMin / 60) * HOUR_H, { steps: 8 })
  await page.mouse.up()
}

async function clearOverrides(admin) {
  const ovs = await (await admin.get('/api/admin/availability/overrides')).json()
  for (const o of ovs) await admin.delete(`/api/admin/availability/overrides/${o.id}`)
}

// =====================================================================
// 23. Criar consulta manual
// =====================================================================

test('23a. nova consulta manual pela UI: cria como confirmada (source admin) e aparece na agenda', async ({ page }) => {
  const s = await setupAdmin(page)
  const date = futureDate(12)
  const nome = `Manual E2E ${Date.now()}`
  try {
    await openAgendaAt(page, date)
    await agendaOf(page).getByRole('button', { name: '+ Nova consulta' }).click()

    const form = page.getByRole('dialog', { name: 'Nova consulta' })
    await expect(form).toBeVisible()
    await form.getByLabel('Nome da paciente').fill(nome)
    await form.getByLabel('Data', { exact: true }).fill(date)
    await form.getByLabel('Início', { exact: true }).fill('09:00')
    await form.getByLabel('Fim', { exact: true }).fill('10:00')
    await form.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Consulta criada.' })).toBeVisible()
    await expect(form).toHaveCount(0)
    await expect(cardOf(page, nome)).toBeVisible()

    const list = await listAppointments(s.admin.ctx, { date_from: date, date_to: date })
    const created = list.find((a) => a.client_name === nome)
    expect(created).toBeTruthy()
    expect(created.source).toBe('admin')
    expect(created.status).toBe('confirmed')
    expect(hhmm(created.start_time)).toBe('09:00')
    expect(hhmm(created.end_time)).toBe('10:00')
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Manual E2E')
    await s.dispose()
  }
})

test('23b. nova consulta em horário ocupado: 409 mostra o aviso e "Salvar mesmo assim" envia force', async ({ page }) => {
  const s = await setupAdmin(page)
  const date = futureDate(13)
  const existente = `Manual E2E existente ${Date.now()}`
  const nome = `Manual E2E conflito ${Date.now()}`
  try {
    await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '09:00:00',
      end_time: '10:00:00',
      client_name: existente,
    })
    await openAgendaAt(page, date)
    await agendaOf(page).getByRole('button', { name: '+ Nova consulta' }).click()

    const form = page.getByRole('dialog', { name: 'Nova consulta' })
    await form.getByLabel('Nome da paciente').fill(nome)
    await form.getByLabel('Data', { exact: true }).fill(date)
    await form.getByLabel('Início', { exact: true }).fill('09:30')
    await form.getByLabel('Fim', { exact: true }).fill('10:30')
    await form.getByRole('button', { name: 'Salvar' }).click()

    // 409: o formulário fica aberto com o aviso e nada foi criado.
    const aviso = form.getByRole('alert').filter({ hasText: 'Já existe uma consulta nesse horário.' })
    await expect(aviso).toBeVisible()
    let list = await listAppointments(s.admin.ctx, { date_from: date, date_to: date })
    expect(list.map((a) => a.client_name)).toEqual([existente])

    await aviso.getByRole('button', { name: 'Salvar mesmo assim' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Consulta criada.' })).toBeVisible()
    await expect(form).toHaveCount(0)

    list = await listAppointments(s.admin.ctx, { date_from: date, date_to: date })
    expect(list.map((a) => a.client_name).sort()).toEqual([existente, nome].sort())
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Manual E2E')
    await s.dispose()
  }
})

// =====================================================================
// 24. Mover / reagendar
// =====================================================================

test('24a. editar consulta pelo formulário: novo horário persiste e o cartão muda de lugar', async ({ page }) => {
  const s = await setupAdmin(page)
  const date = futureDate(14)
  const nome = `Mover E2E ${Date.now()}`
  try {
    const appt = await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '09:00:00',
      end_time: '10:00:00',
      client_name: nome,
    })
    await openAgendaAt(page, date)
    await cardOf(page, nome).click()
    await page.getByRole('dialog', { name: 'Detalhes da consulta' }).getByRole('button', { name: 'Editar' }).click()

    const form = page.getByRole('dialog', { name: 'Editar consulta' })
    await expect(form).toBeVisible()
    // Na edição o Fim não acompanha o Início: preencher os dois.
    await form.getByLabel('Início', { exact: true }).fill('11:00')
    await form.getByLabel('Fim', { exact: true }).fill('12:00')
    await form.getByRole('button', { name: 'Salvar' }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Consulta atualizada.' })).toBeVisible()
    await expect(form).toHaveCount(0)
    await expect(cardOf(page, nome)).toContainText('11:00 – 12:00')

    const after = await findAppt(s.admin.ctx, appt.id, date)
    expect(hhmm(after.start_time)).toBe('11:00')
    expect(hhmm(after.end_time)).toBe('12:00')
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Mover E2E')
    await s.dispose()
  }
})

test('24b. editar para horário ocupado: 409, nada muda até "Salvar mesmo assim"', async ({ page }) => {
  const s = await setupAdmin(page)
  const date = futureDate(15)
  const nome = `Mover E2E ${Date.now()}`
  try {
    const appt = await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '09:00:00',
      end_time: '10:00:00',
      client_name: nome,
    })
    await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '12:00:00',
      end_time: '13:00:00',
      client_name: `Mover E2E ocupante ${Date.now()}`,
    })
    await openAgendaAt(page, date)
    await cardOf(page, nome).click()
    await page.getByRole('dialog', { name: 'Detalhes da consulta' }).getByRole('button', { name: 'Editar' }).click()

    const form = page.getByRole('dialog', { name: 'Editar consulta' })
    await form.getByLabel('Início', { exact: true }).fill('12:00')
    await form.getByLabel('Fim', { exact: true }).fill('13:00')
    await form.getByRole('button', { name: 'Salvar' }).click()

    const aviso = form.getByRole('alert').filter({ hasText: 'Já existe uma consulta nesse horário.' })
    await expect(aviso).toBeVisible()
    expect(hhmm((await findAppt(s.admin.ctx, appt.id, date)).start_time)).toBe('09:00')

    await aviso.getByRole('button', { name: 'Salvar mesmo assim' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Consulta atualizada.' })).toBeVisible()
    expect(hhmm((await findAppt(s.admin.ctx, appt.id, date)).start_time)).toBe('12:00')
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Mover E2E')
    await s.dispose()
  }
})

test('24c. arrastar o cartão na grade reagenda; em conflito pergunta antes ("Mover mesmo assim")', async ({ page }) => {
  const s = await setupAdmin(page)
  const date = futureDate(16)
  const nome = `Mover E2E ${Date.now()}`
  try {
    const appt = await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '09:00:00',
      end_time: '10:00:00',
      client_name: nome,
    })
    await openAgendaAt(page, date)

    // Arrasto simples: 09:00 -> 11:00, sem conflito.
    await dragCardDown(page, cardOf(page, nome), 120)
    await expect(page.getByRole('status').filter({ hasText: /movida para/ })).toBeVisible()
    let after = await findAppt(s.admin.ctx, appt.id, date)
    expect(hhmm(after.start_time)).toBe('11:00')
    expect(hhmm(after.end_time)).toBe('12:00')

    // Um ocupante às 13:00: arrastar para lá pede confirmação.
    await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '13:00:00',
      end_time: '14:00:00',
      client_name: `Mover E2E ocupante ${Date.now()}`,
    })
    await page.reload()
    await openAgendaAt(page, date)
    await dragCardDown(page, cardOf(page, nome), 120)

    const dialogo = page.getByRole('dialog', { name: 'Horário ocupado' })
    await expect(dialogo).toBeVisible()
    await dialogo.getByRole('button', { name: 'Voltar' }).click()
    await expect(dialogo).toHaveCount(0)
    expect(hhmm((await findAppt(s.admin.ctx, appt.id, date)).start_time)).toBe('11:00')

    await dragCardDown(page, cardOf(page, nome), 120)
    await expect(dialogo).toBeVisible()
    await dialogo.getByRole('button', { name: 'Mover mesmo assim' }).click()
    await expect(page.getByRole('status').filter({ hasText: /movida para/ })).toBeVisible()
    after = await findAppt(s.admin.ctx, appt.id, date)
    expect(hhmm(after.start_time)).toBe('13:00')
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Mover E2E')
    await s.dispose()
  }
})

// =====================================================================
// 25. CRUD de janelas/regras
// =====================================================================

test('25a. criar janela e horário pela UI gera slots na LP; excluir horário e janela os remove', async ({ page }) => {
  const s = await setupAdmin(page)
  await clearAvailability(s.admin.ctx)
  const date = futureDate(9)
  const dia = WEEKDAY_LABELS[backendWeekday(date)]
  try {
    await openAgendaFromLanding(page)
    await agendaOf(page).getByRole('button', { name: 'Programações' }).click()
    const prog = page.getByRole('dialog', { name: 'Programações' })
    await expect(prog.getByText('Nenhuma janela de horário criada ainda')).toBeVisible()

    // Criar janela (sem data de término).
    await prog.getByRole('button', { name: 'Criar janela de horário' }).click()
    const popover = prog.getByRole('dialog', { name: 'Nova janela de horário' })
    await popover.getByLabel('Sem data de término').check()
    await popover.getByRole('button', { name: 'Criar', exact: true }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Janela de horário criada.' })).toBeVisible()
    const periods = await (await s.admin.ctx.get('/api/admin/availability/periods')).json()
    expect(periods).toHaveLength(1)
    expect(periods[0].end_date).toBeNull()
    expect(await getSlots(s.api, s.spec.id, date)).toEqual([])

    // Adicionar horário no dia da semana da data: 08:00–12:00.
    await prog.getByRole('button', { name: `Adicionar horário em ${dia}` }).click()
    await expect(prog.getByRole('button', { name: `Excluir horário de ${dia}` })).toBeVisible()
    const rules = await (await s.admin.ctx.get('/api/admin/availability/rules')).json()
    expect(rules).toHaveLength(1)
    expect(rules[0].weekday).toBe(backendWeekday(date))
    expect(hhmm(rules[0].start_time)).toBe('08:00')
    expect(hhmm(rules[0].end_time)).toBe('12:00')
    expect((await getSlots(s.api, s.spec.id, date)).map((x) => hhmm(x.start))).toEqual([
      '08:00', '09:00', '10:00', '11:00',
    ])

    // Excluir o horário: os slots somem.
    await prog.getByRole('button', { name: `Excluir horário de ${dia}` }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Programação excluída.' })).toBeVisible()
    expect(await getSlots(s.api, s.spec.id, date)).toEqual([])

    // Excluir a janela (com confirmação).
    await prog.getByRole('button', { name: 'Excluir janela de horário' }).click()
    const confirmar = page.getByRole('dialog', { name: 'Excluir janela de horário' })
    await expect(confirmar).toBeVisible()
    await confirmar.getByRole('button', { name: 'Excluir janela' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Janela de horário excluída.' })).toBeVisible()
    expect(await (await s.admin.ctx.get('/api/admin/availability/periods')).json()).toEqual([])
  } finally {
    await clearAvailability(s.admin.ctx)
    await s.dispose()
  }
})

test('25b. encurtar a janela com consulta confirmada avisa (confirm-schedule-orphans); Voltar não altera, "Salvar mesmo assim" aplica', async ({ page }) => {
  const s = await setupAdmin(page)
  await clearAvailability(s.admin.ctx)
  const date = futureDate(9)
  const fim = futureDate(5)
  const nome = `Janela E2E ${Date.now()}`
  const { period } = await openDay(s.admin.ctx, date)
  try {
    await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '09:00:00',
      end_time: '10:00:00',
      client_name: nome,
      status: 'confirmed',
      // O aviso só considera consultas que cabiam na regra, inclusive a modalidade.
      type: 'presencial_bsb',
    })
    await openAgendaFromLanding(page)
    await agendaOf(page).getByRole('button', { name: 'Programações' }).click()
    const prog = page.getByRole('dialog', { name: 'Programações' })

    const encurtar = async () => {
      await prog.getByLabel('Fim da janela').fill(fim)
      await prog.getByRole('button', { name: 'Salvar datas' }).click()
    }

    await encurtar()
    const aviso = page.getByRole('dialog', { name: 'Consultas fora do novo horário' })
    await expect(aviso).toBeVisible()
    await expect(aviso).toContainText('1 consulta(s) afetada(s)')

    // Voltar: nada foi salvo.
    await aviso.getByRole('button', { name: 'Voltar' }).click()
    await expect(aviso).toHaveCount(0)
    let periods = await (await s.admin.ctx.get('/api/admin/availability/periods')).json()
    expect(periods.find((p) => p.id === period.id).end_date).toBeNull()

    // De novo, agora aceitando.
    await encurtar()
    await expect(aviso).toBeVisible()
    await aviso.getByRole('button', { name: 'Salvar mesmo assim' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Janela de horário atualizada.' })).toBeVisible()
    periods = await (await s.admin.ctx.get('/api/admin/availability/periods')).json()
    expect(periods.find((p) => p.id === period.id).end_date).toBe(fim)
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Janela E2E')
    await clearAvailability(s.admin.ctx)
    await s.dispose()
  }
})

// =====================================================================
// 26. Overrides
// =====================================================================

/** Clica numa área vazia (14:00) da coluna do dia e abre o menu do horário. */
async function openSlotActions(page, date) {
  const col = agendaOf(page).locator('.ag-col').nth(backendWeekday(date))
  await col.click({ position: { x: 30, y: 14 * HOUR_H + 8 } })
}

test('26a. bloquear o dia inteiro cria o bloqueio na agenda e tira os slots da LP; remover devolve', async ({ page }) => {
  const s = await setupAdmin(page)
  await clearAvailability(s.admin.ctx)
  const date = futureDate(11)
  const { cleanup } = await openDay(s.admin.ctx, date)
  try {
    const antes = (await getSlots(s.api, s.spec.id, date)).map((x) => x.start)
    expect(antes.length).toBe(3)

    await openAgendaAt(page, date)
    await openSlotActions(page, date)
    await page.getByRole('button', { name: /Bloquear horário/ }).click()

    const form = page.getByRole('dialog', { name: 'Bloquear horário' })
    await form.getByLabel('Bloquear o dia inteiro').check()
    await form.getByLabel('Motivo').fill('Congresso E2E')
    await form.getByRole('button', { name: 'Bloquear', exact: true }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Horário bloqueado.' })).toBeVisible()
    const banda = agendaOf(page).locator('.ag-band--block')
    await expect(banda).toBeVisible()
    await expect(banda).toContainText('Congresso E2E')
    expect(await getSlots(s.api, s.spec.id, date)).toEqual([])

    // Remover o bloqueio pela UI.
    await banda.click()
    const detalhes = page.getByRole('dialog', { name: 'Horário bloqueado' })
    await expect(detalhes).toContainText('Dia inteiro')
    await detalhes.getByRole('button', { name: 'Remover bloqueio' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Bloqueio removido.' })).toBeVisible()
    await expect(agendaOf(page).locator('.ag-band--block')).toHaveCount(0)
    expect((await getSlots(s.api, s.spec.id, date)).map((x) => x.start)).toEqual(antes)
  } finally {
    await clearOverrides(s.admin.ctx)
    await cleanup()
    await s.dispose()
  }
})

test('26b. abrir horário extra cria a faixa na agenda e oferece o slot na LP; remover retira', async ({ page }) => {
  const s = await setupAdmin(page)
  await clearAvailability(s.admin.ctx)
  const date = futureDate(12)
  // Janela existente, mas sem regra no dia da semana de `date`.
  const { cleanup } = await openDay(s.admin.ctx, futureDate(13))
  try {
    expect(await getSlots(s.api, s.spec.id, date)).toEqual([])

    await openAgendaAt(page, date)
    await openSlotActions(page, date)
    await page.getByRole('button', { name: /Abrir horário extra/ }).click()

    const form = page.getByRole('dialog', { name: 'Abrir horário extra' })
    await form.getByRole('button', { name: 'Abrir horário', exact: true }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Horário extra aberto.' })).toBeVisible()
    const banda = agendaOf(page).locator('.ag-band--open')
    await expect(banda).toBeVisible()
    expect((await getSlots(s.api, s.spec.id, date)).map((x) => hhmm(x.start))).toEqual(['14:00'])

    await banda.click()
    const detalhes = page.getByRole('dialog', { name: 'Horário extra' })
    await expect(detalhes).toContainText('14:00 – 15:00')
    await detalhes.getByRole('button', { name: 'Remover horário extra' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Horário extra removido.' })).toBeVisible()
    await expect(agendaOf(page).locator('.ag-band--open')).toHaveCount(0)
    expect(await getSlots(s.api, s.spec.id, date)).toEqual([])
  } finally {
    await clearOverrides(s.admin.ctx)
    await cleanup()
    await s.dispose()
  }
})

// =====================================================================
// 27. Configurações (só via API: o admin não tem tela de configurações)
// =====================================================================

test('27. configurações (via API, sem UI): persistem no GET, validam limites e mudam o comportamento da LP', async () => {
  const s = await setupAdmin()
  await clearAvailability(s.admin.ctx)
  const date = futureDate(10)
  const { cleanup } = await openDay(s.admin.ctx, date, { start_time: '09:00:00', end_time: '12:00:00' })
  const apptIds = []
  try {
    // Sem token não lê nem altera.
    expect((await s.api.get('/api/admin/settings')).status()).toBe(401)
    expect((await s.api.patch('/api/admin/settings', { data: { buffer_minutes: 5 } })).status()).toBe(401)

    // Persistência dos três campos.
    const patch = {
      buffer_minutes: 30,
      cancellation_window_hours: 48,
      max_booking_advance_days: 20,
    }
    expect(await setSettings(s.admin.ctx, patch)).toEqual(patch)
    expect(await (await s.admin.ctx.get('/api/admin/settings')).json()).toEqual(patch)

    // Limites do schema: fora da faixa -> 422 e nada muda.
    for (const bad of [
      { buffer_minutes: 241 },
      { buffer_minutes: -1 },
      { cancellation_window_hours: 337 },
      { max_booking_advance_days: 0 },
      { max_booking_advance_days: 366 },
    ]) {
      expect((await s.admin.ctx.patch('/api/admin/settings', { data: bad })).status()).toBe(422)
    }
    expect(await (await s.admin.ctx.get('/api/admin/settings')).json()).toEqual(patch)

    // Toda reserva pública nasce confirmed.
    const livres = await getSlots(s.api, s.spec.id, date)
    expect(livres.map((x) => hhmm(x.start))).toEqual(['09:00', '10:00', '11:00'])
    const a1 = await bookViaApi(s.api, { specialtyId: s.spec.id, date, start: livres[1].start })
    apptIds.push(a1.id)
    expect(a1.status).toBe('confirmed')

    // Efeito: o buffer de 30 min estende a consulta das 10h e bloqueia os vizinhos;
    // sem buffer, 09:00 e 11:00 voltam.
    expect(await getSlots(s.api, s.spec.id, date)).toEqual([])
    await setSettings(s.admin.ctx, { buffer_minutes: 0 })
    const semBuffer = await getSlots(s.api, s.spec.id, date)
    expect(semBuffer.map((x) => hhmm(x.start))).toEqual(['09:00', '11:00'])

    const a2 = await bookViaApi(s.api, { specialtyId: s.spec.id, date, start: semBuffer[0].start })
    apptIds.push(a2.id)
    expect(a2.status).toBe('confirmed')

    // Efeito: antecedência máxima curta remove o dia dos slots.
    await setSettings(s.admin.ctx, { max_booking_advance_days: 5 })
    expect(await getSlots(s.api, s.spec.id, date)).toEqual([])

    // Efeito: janela de cancelamento maior que a antecedência trava a autogestão.
    await setSettings(s.admin.ctx, { max_booking_advance_days: 60, cancellation_window_hours: 336 })
    const managed = await (await s.api.get(`/api/bookings/manage/${a2.token}`)).json()
    expect(managed.can_modify).toBe(false)
    expect(managed.cancellation_window_hours).toBe(336)
  } finally {
    for (const id of apptIds) await s.admin.ctx.delete(`/api/admin/appointments/${id}`)
    await cleanup()
    await resetSettings(s.admin.ctx)
    await s.dispose()
  }
})

// =====================================================================
// 28. Visualizações da agenda
// =====================================================================

test('28a. desktop: semana, mês, lista e volta; navegação e "Ir para data de hoje"', async ({ page }) => {
  const s = await setupAdmin(page)
  const date = futureDate(14)
  const nome = `Visoes E2E ${Date.now()}`
  try {
    await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '09:00:00',
      end_time: '10:00:00',
      client_name: nome,
    })
    await openAgendaFromLanding(page)
    const agenda = agendaOf(page)
    const titulo = agenda.locator('.ag-topbar__title span')

    // Semana: 7 dias, sem opção "Dia" no desktop; navegar e voltar para hoje.
    await expect(agenda.getByRole('radio', { name: 'Semana' })).toBeChecked()
    await expect(agenda.getByRole('radio', { name: 'Dia', exact: true })).toHaveCount(0)
    await expect(agenda.locator('.ag-grid__dayhead')).toHaveCount(7)
    const hoje = (await titulo.textContent()).trim()
    await agenda.getByRole('button', { name: 'Próxima semana' }).click()
    await expect(titulo).not.toHaveText(hoje)
    await agenda.getByRole('button', { name: 'Semana anterior' }).click()
    await expect(titulo).toHaveText(hoje)
    await agenda.getByRole('button', { name: 'Próxima semana' }).click()
    await agenda.getByRole('button', { name: 'Ir para data de hoje' }).click()
    await expect(titulo).toHaveText(hoje)

    // Mês: rótulo do mês corrente, navegação até o mês da consulta e o chip.
    await agenda.getByRole('radio', { name: 'Mês' }).click()
    await expect(agenda.locator('.ag-month')).toBeVisible()
    const [ty, tm] = futureDate(0).split('-').map(Number)
    await expect(titulo).toHaveText(`${MONTHS_LONG[tm - 1]} de ${ty}`)
    const [y, m] = date.split('-').map(Number)
    for (let i = 0; i < (y - ty) * 12 + (m - tm); i += 1) {
      await agenda.getByRole('button', { name: 'Próximo mês' }).click()
    }
    const chip = agenda.locator('.ag-month__chip', { hasText: nome })
    await expect(chip).toBeVisible()
    await chip.click()
    const detalhes = page.getByRole('dialog', { name: 'Detalhes da consulta' })
    await expect(detalhes).toBeVisible()
    await detalhes.getByRole('button', { name: 'Fechar' }).click()

    // Tocar no dia leva à semana daquele dia, com o cartão.
    await agenda
      .locator('.ag-month__day:not(.is-outside)')
      .filter({ has: page.locator('.ag-month__chip', { hasText: nome }) })
      .click({ position: { x: 6, y: 6 } })
    await expect(agenda.getByRole('radio', { name: 'Semana' })).toBeChecked()
    await expect(cardOf(page, nome)).toBeVisible()

    // Lista (Consultas): só o dia âncora, sem navegação, com filtros.
    await agenda.getByRole('radio', { name: 'Consultas' }).click()
    await expect(agenda.getByRole('heading', { name: 'Consultas do dia' })).toBeVisible()
    await expect(agenda.getByRole('button', { name: 'Semana anterior' })).toHaveCount(0)
    const linha = agenda.locator('.ag-list__row', { hasText: nome })
    await expect(linha).toBeVisible()
    await expect(agenda.locator('.ag-stat', { hasText: 'Consultas no dia' }).locator('strong')).toHaveText('1')
    await agenda.getByRole('tab', { name: 'Aguardando' }).click()
    await expect(agenda.getByText('Nenhuma consulta encontrada.')).toBeVisible()
    await agenda.getByRole('tab', { name: 'Confirmadas' }).click()
    await expect(linha).toBeVisible()
    await agenda.getByLabel('Buscar paciente').fill('zzz-nao-existe')
    await expect(agenda.getByText('Nenhuma consulta encontrada.')).toBeVisible()
    await agenda.getByLabel('Buscar paciente').fill(nome.toLowerCase())
    await expect(linha).toBeVisible()

    // Voltar ao calendário.
    await agenda.getByRole('radio', { name: 'Calendário' }).click()
    await expect(agenda.locator('.ag-grid__dayhead')).toHaveCount(7)
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Visoes E2E')
    await s.dispose()
  }
})

test('28b. mobile (≤760px): semana vira dia, faixa de dias, FAB no lugar do botão "+ Nova consulta"', async ({ page }) => {
  const s = await setupAdmin(page)
  const date = futureDate(14)
  const nome = `Visoes E2E ${Date.now()}`
  try {
    await createAdminAppointment(s.admin.ctx, {
      specialtyId: s.spec.id,
      date,
      start_time: '09:00:00',
      end_time: '10:00:00',
      client_name: nome,
    })
    // O "Login" da navbar só existe no desktop: abre no desktop e encolhe a janela.
    await openAgendaFromLanding(page)
    const agenda = agendaOf(page)
    await expect(agenda.getByRole('button', { name: '+ Nova consulta' })).toBeVisible()
    await page.setViewportSize({ width: 390, height: 800 })

    await expect(agenda.getByRole('radio', { name: 'Dia', exact: true })).toBeChecked()
    await expect(agenda.getByRole('radio', { name: 'Semana' })).toHaveCount(0)
    await expect(agenda.getByRole('tablist', { name: 'Escolher dia' })).toBeVisible()
    await expect(agenda.locator('.ag-grid__dayhead')).toHaveCount(1)
    await expect(agenda.getByRole('button', { name: 'Dia anterior' })).toBeVisible()
    await expect(agenda.getByRole('button', { name: 'Próximo dia' })).toBeVisible()
    await expect(agenda.getByRole('button', { name: 'Nova consulta', exact: true })).toBeVisible() // FAB
    await expect(agenda.getByRole('button', { name: '+ Nova consulta' })).toHaveCount(0)

    // A faixa começa em ontem: o dia da consulta está no índice 1 + 14.
    await agenda.locator('.ag-daystrip__day').nth(15).click()
    await expect(cardOf(page, nome)).toBeVisible()
    await agenda.getByRole('button', { name: 'Dia anterior' }).click()
    await expect(cardOf(page, nome)).toHaveCount(0)
    await agenda.getByRole('button', { name: 'Próximo dia' }).click()
    await expect(cardOf(page, nome)).toBeVisible()
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Visoes E2E')
    await s.dispose()
  }
})

// =====================================================================
// 29. Excluir consulta
// =====================================================================

test('29. excluir consulta: Voltar preserva, confirmar remove de vez e libera o slot na LP', async ({ page }) => {
  const s = await setupAdmin(page)
  await clearAvailability(s.admin.ctx)
  const date = futureDate(10)
  const { cleanup } = await openDay(s.admin.ctx, date)
  const nome = `Excluir E2E ${Date.now()}`
  try {
    const antes = await getSlots(s.api, s.spec.id, date)
    const appt = await bookViaApi(s.api, {
      specialtyId: s.spec.id,
      date,
      start: antes[0].start,
      client_name: nome,
    })
    expect((await getSlots(s.api, s.spec.id, date)).length).toBe(antes.length - 1)

    await openAgendaAt(page, date)
    await cardOf(page, nome).click()
    const detalhes = page.getByRole('dialog', { name: 'Detalhes da consulta' })
    await detalhes.getByRole('button', { name: 'Excluir consulta' }).click()

    const confirmar = page.getByRole('dialog', { name: 'Excluir consulta' })
    await expect(confirmar).toContainText(nome)
    await expect(confirmar).toContainText('Essa ação não pode ser desfeita')

    // Voltar: retorna aos detalhes e nada é apagado.
    await confirmar.getByRole('button', { name: 'Voltar' }).click()
    await expect(page.getByRole('dialog', { name: 'Detalhes da consulta' })).toBeVisible()
    expect(await findAppt(s.admin.ctx, appt.id, date)).toBeTruthy()

    await page.getByRole('dialog', { name: 'Detalhes da consulta' }).getByRole('button', { name: 'Excluir consulta' }).click()
    await page.getByRole('dialog', { name: 'Excluir consulta' }).getByRole('button', { name: 'Excluir', exact: true }).click()

    await expect(page.getByRole('status').filter({ hasText: 'Consulta excluída.' })).toBeVisible()
    await expect(cardOf(page, nome)).toHaveCount(0)
    // Nem com "Mostrar canceladas": excluir não é cancelar.
    await agendaOf(page).getByLabel('Mostrar canceladas').check()
    await expect(cardOf(page, nome)).toHaveCount(0)

    expect(await findAppt(s.admin.ctx, appt.id, date)).toBeUndefined()
    expect((await getSlots(s.api, s.spec.id, date)).map((x) => x.start)).toEqual(antes.map((x) => x.start))
  } finally {
    await deleteAppointmentsNamed(s.admin.ctx, 'Excluir E2E')
    await cleanup()
    await s.dispose()
  }
})

// =====================================================================
// 30. Waitlist no admin (só via API: não há tela de lista de espera)
// =====================================================================

test('30. lista de espera (via API, sem UI): admin lista e remove; anônimo não acessa', async () => {
  const s = await setupAdmin()
  const email = `espera.admin.${Date.now()}@example.com`
  let entryId
  try {
    const join = await s.api.post('/api/waitlist', {
      data: { specialty_id: s.spec.id, client_name: 'Espera Admin E2E', client_email: email },
    })
    expect(join.status()).toBe(201)
    entryId = (await join.json()).id

    // Sem token: 401 na listagem e na remoção.
    expect((await s.api.get('/api/admin/waitlist')).status()).toBe(401)
    expect((await s.api.delete(`/api/admin/waitlist/${entryId}`)).status()).toBe(401)

    const lista = await (await s.admin.ctx.get('/api/admin/waitlist')).json()
    expect(lista.find((e) => e.id === entryId)).toMatchObject({
      client_email: email,
      client_name: 'Espera Admin E2E',
      specialty_id: s.spec.id,
      active: true,
    })
    // O filtro por especialidade também a encontra.
    const filtrada = await (
      await s.admin.ctx.get('/api/admin/waitlist', { params: { specialty_id: s.spec.id } })
    ).json()
    expect(filtrada.map((e) => e.id)).toContain(entryId)

    expect((await s.admin.ctx.delete(`/api/admin/waitlist/${entryId}`)).status()).toBe(204)
    const depois = await (
      await s.admin.ctx.get('/api/admin/waitlist', { params: { active_only: false } })
    ).json()
    expect(depois.map((e) => e.id)).not.toContain(entryId)
    // Remover de novo: 404.
    expect((await s.admin.ctx.delete(`/api/admin/waitlist/${entryId}`)).status()).toBe(404)
    entryId = null
  } finally {
    if (entryId) await s.admin.ctx.delete(`/api/admin/waitlist/${entryId}`)
    await s.dispose()
  }
})

// =====================================================================
// 31. Blog admin
// =====================================================================

test('31. blog admin: publicado aparece em /blog, rascunho não; publicar e arquivar refletem no site', async ({ page }) => {
  const s = await setupAdmin(page)
  const stamp = Date.now()
  const publicado = `Post publicado E2E ${stamp}`
  const rascunho = `Post rascunho E2E ${stamp}`
  const publicList = async () =>
    (await (await s.api.get('/api/blog', { params: { limit: 50 } })).json()).items.map((p) => p.title)
  const card = (titulo) => page.locator('.bp-card', { hasText: titulo })

  const abrirBlog = async () => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Login' }).click()
    await page.getByRole('dialog', { name: 'Painel administrativo' }).getByRole('button', { name: /Blog/ }).click()
    await expect(page.getByRole('dialog', { name: 'Publicações do blog' })).toBeVisible()
  }
  const criar = async (titulo, status) => {
    await page.getByRole('button', { name: '+ Nova publicação' }).first().click()
    const form = page.getByRole('dialog', { name: 'Nova publicação' })
    await form.getByLabel('Título').fill(titulo)
    await form.getByLabel('Status').selectOption(status)
    await form.getByPlaceholder('Escreva o conteúdo da publicação em Markdown').fill(`Texto de ${titulo}`)
    await form.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Publicação criada.' })).toBeVisible()
    await expect(form).toHaveCount(0)
  }

  try {
    await abrirBlog()
    await criar(publicado, 'published')
    await criar(rascunho, 'draft')
    await expect(card(publicado)).toContainText('Publicado')
    await expect(card(rascunho)).toContainText('Rascunho')

    // API pública: só o publicado.
    expect(await publicList()).toContain(publicado)
    expect(await publicList()).not.toContain(rascunho)

    // Site: /blog lista o publicado e não o rascunho.
    await page.goto('/blog')
    await expect(page.getByRole('heading', { name: publicado })).toBeVisible()
    await expect(page.getByRole('heading', { name: rascunho })).toHaveCount(0)

    // Publicar o rascunho pelo painel faz ele aparecer.
    await abrirBlog()
    await card(rascunho).getByRole('button', { name: 'Publicar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Publicação publicada.' })).toBeVisible()
    expect(await publicList()).toContain(rascunho)

    // Arquivar tira do site.
    await card(publicado).getByRole('button', { name: 'Arquivar' }).click()
    await expect(page.getByRole('status').filter({ hasText: 'Publicação arquivada.' })).toBeVisible()
    expect(await publicList()).not.toContain(publicado)
  } finally {
    const posts = await (await s.admin.ctx.get('/api/admin/blog')).json()
    for (const p of posts) {
      if (p.title.endsWith(`E2E ${stamp}`)) await s.admin.ctx.delete(`/api/admin/blog/${p.id}`)
    }
    await s.dispose()
  }
})

// =====================================================================
// 32. Logout
// =====================================================================

// Lacuna de produto: nenhuma tela do admin (navbar, hub, agenda, blog) tem botão
// de "Sair"; o único caminho que limpa o token é o 401 (coberto em 19b).
// Ao criar o botão, trocar `test.fixme` por `test` e validar: clicar em "Sair"
// remove `mv_admin_token`, fecha o painel e o próximo "Login" pede autenticação.
test.fixme('32. logout limpa o token e bloqueia o admin (sem botão de sair na UI)', async () => {})
