import { test, expect } from '@playwright/test'
import {
  newApi,
  adminApi,
  specialtyBySlug,
  openDay,
  futureDate,
  getSlots,
  clearAvailability,
  bookViaApi,
  listAppointments,
  createOverride,
  setSettings,
  resetSettings,
  uniquePhone,
} from './helpers/api.js'

// A LP só oferece "Online" e "Rio de Janeiro" (Brasília está oculta), e o
// wizard abre em "Online". Todas as regras aqui são online para que os slots
// apareçam sem trocar de modalidade.
const LOCATION = 'online'
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const parts = (iso) => {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

// ---- helpers de UI ----

async function openWizard(page) {
  await page.goto('/')
  const section = page.locator('#agendamento')
  await section.scrollIntoViewIfNeeded()
  await expect(section.getByRole('heading', { name: 'Sua consulta, no seu tempo.' })).toBeVisible()
  await expect(page.getByRole('list', { name: 'Etapas do agendamento' })).toBeVisible()
}

/** Navega o calendário até o mês de `date`, tolerando a auto-seleção da LP. */
async function gotoMonth(page, date) {
  const { y, m } = parts(date)
  const target = `${MONTHS[m - 1]} ${y}`
  const heading = page.locator('.bk-calendar__nav strong')
  await expect(async () => {
    const current = (await heading.textContent()).trim()
    if (current !== target) {
      const [mName, yStr] = current.split(' ')
      const curIdx = Number(yStr) * 12 + MONTHS.indexOf(mName)
      const goNext = curIdx < y * 12 + (m - 1)
      await page.getByRole('button', { name: goNext ? 'Próximo mês' : 'Mês anterior' }).click()
    }
    await expect(heading).toHaveText(target, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
  await expect(page.getByText('Carregando agenda…')).toBeHidden()
}

const dayButton = (page, date, available = true) => {
  const { m, d } = parts(date)
  return page.getByRole('button', {
    name: `${d} de ${MONTHS[m - 1]}${available ? ', com horários disponíveis' : ', indisponível'}`,
    exact: true,
  })
}

const slotRadios = (page) =>
  page.getByRole('radiogroup', { name: 'Horários disponíveis' }).getByRole('radio')

/** Passo 1: escolhe data e (opcionalmente) horário e devolve o radio. */
async function pickDate(page, date) {
  await gotoMonth(page, date)
  await dayButton(page, date).click()
  await expect(dayButton(page, date)).toHaveAttribute('aria-pressed', 'true')
}

async function pickSlot(page, time) {
  const radio = page.getByRole('radio', { name: time, exact: true })
  await radio.click()
  await expect(radio).toHaveAttribute('aria-checked', 'true')
}

const currentStep = (page) =>
  page.getByRole('list', { name: 'Etapas do agendamento' }).locator('[aria-current="step"]')

async function next(page, name = 'Próximo passo') {
  await page.getByRole('button', { name, exact: true }).click()
}

async function fillPersonal(page, { name, phone, email }) {
  await expect(currentStep(page)).toContainText('Dados pessoais')
  await page.getByLabel('Nome completo').fill(name)
  await page.getByLabel('Telefone / WhatsApp').fill(phone)
  await page.getByLabel('E-mail').fill(email)
}

async function chooseSpecialty(page, name) {
  await expect(currentStep(page)).toContainText('Motivo da consulta')
  const radio = page.getByRole('radiogroup', { name: 'Especialidade' }).getByRole('radio', {
    name: new RegExp(`^${name}`),
  })
  await radio.click()
  await expect(radio).toHaveAttribute('aria-checked', 'true')
}

/** Conduz a UI do passo 1 até a revisão (passo 4), sem confirmar. */
async function walkToReview(page, { date, time, person, specialtyName }) {
  await pickDate(page, date)
  await pickSlot(page, time)
  await next(page)
  await fillPersonal(page, person)
  await next(page)
  await chooseSpecialty(page, specialtyName)
  await page.getByRole('radio', { name: 'Sim', exact: true }).click()
  await next(page, 'Revisar agendamento')
  await expect(currentStep(page)).toContainText('Confirmação')
  await expect(page.getByRole('button', { name: 'Confirmar agendamento' })).toBeEnabled()
}

const waitBooking = (page) =>
  page.waitForResponse(
    (r) => r.url().endsWith('/api/bookings') && r.request().method() === 'POST',
  )

// ---- estado compartilhado por teste ----

let admin
let api
let spec
let created // ids de consultas a apagar no cleanup
let cleanups // funções de limpeza extras

test.beforeEach(async () => {
  admin = await adminApi()
  api = await newApi()
  created = []
  cleanups = []
  await clearAvailability(admin.ctx)
  await resetSettings(admin.ctx)
  spec = await specialtyBySlug(api)
  // Consultas sobram entre execuções (--repeat-each) e bloqueiam slots.
  const leftovers = await listAppointments(admin.ctx, {
    date_from: futureDate(0),
    date_to: futureDate(40),
  })
  for (const a of leftovers) await admin.ctx.delete(`/api/admin/appointments/${a.id}`)
})

test.afterEach(async () => {
  try {
    for (const id of created) await admin.ctx.delete(`/api/admin/appointments/${id}`)
    for (const fn of cleanups) await fn()
    await clearAvailability(admin.ctx)
    await resetSettings(admin.ctx)
  } finally {
    await admin.dispose()
    await api.dispose()
  }
})

test('agendamento completo pelo wizard: passos 1 a 4, 201, confirmação e consulta pendente no admin', async ({
  page,
}) => {
  const date = futureDate(4)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)
  const person = {
    name: 'Maria Teste Silva',
    phone: uniquePhone(),
    email: 'maria.teste@example.com',
  }

  await openWizard(page)
  await expect(currentStep(page)).toContainText('Data e horário')
  await pickDate(page, date)
  await expect(slotRadios(page)).toHaveText(['09:00', '10:00', '11:00'])
  await pickSlot(page, '10:00')
  await next(page)

  await fillPersonal(page, person)
  await next(page)

  await chooseSpecialty(page, spec.name)
  await page.getByRole('radio', { name: 'Sim', exact: true }).click()
  await next(page, 'Revisar agendamento')

  // Passo 4: o resumo reflete tudo o que foi escolhido.
  await expect(currentStep(page)).toContainText('Confirmação')
  const ticket = page.getByRole('article', { name: 'Resumo da consulta' })
  await expect(ticket).toContainText('10:00')
  await expect(ticket).toContainText('11:00')
  await expect(ticket).toContainText(spec.name)
  await expect(ticket).toContainText(person.name)
  await expect(ticket).toContainText(person.email)
  await expect(ticket).toContainText(person.phone)
  await expect(ticket).toContainText('Telemedicina (Online)')

  const responsePromise = waitBooking(page)
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(201)
  const booking = await response.json()
  created.push(booking.id)
  expect(booking.status).toBe('pending')

  // Tela de confirmação.
  await expect(page.getByRole('heading', { name: /Consulta confirmada, Maria\./ })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(person.email)
  await expect(page.getByRole('button', { name: 'Fazer novo agendamento' })).toBeVisible()
  await expect(page.locator('.bk-error[role="alert"]')).toHaveCount(0)

  // A consulta existe no admin, pendente, com os dados do wizard.
  const list = await listAppointments(admin.ctx, { date_from: date, date_to: date })
  const mine = list.filter((a) => a.client_phone === person.phone)
  expect(mine).toHaveLength(1)
  expect(mine[0]).toMatchObject({
    id: booking.id,
    status: 'pending',
    specialty_id: spec.id,
    date,
    start_time: '10:00:00',
    end_time: '11:00:00',
    type: LOCATION,
    client_name: person.name,
    client_email: person.email,
    is_first_visit: true,
    source: 'public',
  })
})

test('horário reservado some de /api/slots e da LP', async ({ page }) => {
  const date = futureDate(5)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)

  const before = await getSlots(api, spec.id, date)
  expect(before.map((s) => s.start)).toEqual(['09:00:00', '10:00:00', '11:00:00'])

  // Controle positivo: a LP oferece os 3 horários antes da reserva.
  await openWizard(page)
  await pickDate(page, date)
  await expect(slotRadios(page)).toHaveText(['09:00', '10:00', '11:00'])

  const booking = await bookViaApi(api, {
    specialtyId: spec.id,
    date,
    start: '10:00:00',
    type: LOCATION,
  })
  created.push(booking.id)

  const after = await getSlots(api, spec.id, date)
  expect(after.map((s) => s.start)).toEqual(['09:00:00', '11:00:00'])

  // Recarrega a LP: o horário ocupado não é mais oferecido.
  await openWizard(page)
  await pickDate(page, date)
  await expect(slotRadios(page)).toHaveText(['09:00', '11:00'])
  await expect(page.getByRole('radio', { name: '10:00', exact: true })).toHaveCount(0)
})

test('corrida pelo mesmo horário: 409, aviso em role=alert e a UI se recupera', async ({ page }) => {
  const date = futureDate(6)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)
  const person = {
    name: 'Ana Corrida',
    phone: uniquePhone(),
    email: 'ana.corrida@example.com',
  }

  await openWizard(page)
  await walkToReview(page, { date, time: '09:00', person, specialtyName: spec.name })

  // "Voltar" funciona a partir da revisão e o estado é preservado.
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(currentStep(page)).toContainText('Motivo da consulta')
  await next(page, 'Revisar agendamento')
  await expect(currentStep(page)).toContainText('Confirmação')

  // Outra pessoa reserva exatamente o mesmo horário antes da confirmação.
  const rival = await bookViaApi(api, {
    specialtyId: spec.id,
    date,
    start: '09:00:00',
    type: LOCATION,
  })
  created.push(rival.id)

  const responsePromise = waitBooking(page)
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(409)

  const alert = page.locator('.bk-error[role="alert"]')
  await expect(alert).toBeVisible()
  await expect(alert).toContainText('Esse horário acabou de ser reservado')

  // A app devolve a paciente ao passo 1, sem seleção, com o horário perdido fora da lista.
  await expect(currentStep(page)).toContainText('Data e horário')
  await expect(page.getByRole('button', { name: 'Próximo passo', exact: true })).toBeDisabled()
  await expect(slotRadios(page)).toHaveText(['10:00', '11:00'])
  await expect(page.getByRole('radio', { name: '09:00', exact: true })).toHaveCount(0)

  // Nada foi criado para a paciente: só a consulta do rival ocupa o dia.
  const afterConflict = await listAppointments(admin.ctx, { date_from: date, date_to: date })
  expect(afterConflict.map((a) => a.id)).toEqual([rival.id])

  // Recuperação: escolhe outro horário, os dados digitados foram mantidos e a reserva conclui.
  await pickSlot(page, '10:00')
  await next(page)
  await expect(page.getByLabel('Nome completo')).toHaveValue(person.name)
  await expect(page.getByLabel('E-mail')).toHaveValue(person.email)
  await next(page)
  await expect(currentStep(page)).toContainText('Motivo da consulta')
  await next(page, 'Revisar agendamento')
  await expect(alert).toHaveCount(0)

  const retryPromise = waitBooking(page)
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  const retry = await retryPromise
  expect(retry.status()).toBe(201)
  created.push((await retry.json()).id)
  await expect(page.getByRole('heading', { name: /Consulta confirmada, Ana\./ })).toBeVisible()

  const final = await listAppointments(admin.ctx, { date_from: date, date_to: date })
  expect(final.map((a) => a.start_time).sort()).toEqual(['09:00:00', '10:00:00'])
})

test('slots respeitam a regra: 09:00-11:00 gera exatamente 09:00 e 10:00 (API e LP)', async ({
  page,
}) => {
  const date = futureDate(7)
  const otherWeekday = futureDate(8)
  const { cleanup } = await openDay(admin.ctx, date, {
    start_time: '09:00:00',
    end_time: '11:00:00',
    location: LOCATION,
  })
  cleanups.push(cleanup)

  expect(spec.slot_duration_min).toBe(60)
  const slots = await getSlots(api, spec.id, date)
  expect(slots).toEqual([
    { start: '09:00:00', end: '10:00:00', location: LOCATION },
    { start: '10:00:00', end: '11:00:00', location: LOCATION },
  ])
  // A regra vale só para o dia da semana configurado.
  expect(await getSlots(api, spec.id, otherWeekday)).toEqual([])

  await openWizard(page)
  await gotoMonth(page, date)
  await expect(dayButton(page, otherWeekday, false)).toBeDisabled()
  await dayButton(page, date).click()
  await expect(slotRadios(page)).toHaveText(['09:00', '10:00'])
})

test('buffer entre consultas remove os slots vizinhos (API e LP)', async ({ page }) => {
  const date = futureDate(9)
  const { cleanup } = await openDay(admin.ctx, date, {
    start_time: '09:00:00',
    end_time: '13:00:00',
    location: LOCATION,
  })
  cleanups.push(cleanup)
  await setSettings(admin.ctx, { buffer_minutes: 15 })

  // Sem consultas o buffer não altera nada.
  expect((await getSlots(api, spec.id, date)).map((s) => s.start)).toEqual([
    '09:00:00',
    '10:00:00',
    '11:00:00',
    '12:00:00',
  ])

  // 10:00-11:00 ocupa 09:45-11:15 com buffer: 09:00 e 11:00 encostam nessa janela.
  const booking = await bookViaApi(api, {
    specialtyId: spec.id,
    date,
    start: '10:00:00',
    type: LOCATION,
  })
  created.push(booking.id)
  expect((await getSlots(api, spec.id, date)).map((s) => s.start)).toEqual(['12:00:00'])

  await openWizard(page)
  await pickDate(page, date)
  await expect(slotRadios(page)).toHaveText(['12:00'])

  // Sem buffer, só o horário reservado some.
  await setSettings(admin.ctx, { buffer_minutes: 0 })
  expect((await getSlots(api, spec.id, date)).map((s) => s.start)).toEqual([
    '09:00:00',
    '11:00:00',
    '12:00:00',
  ])
})

test('override de bloqueio do dia remove os slots (API e LP) e some ao remover o override', async ({
  page,
}) => {
  const date = futureDate(10)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)

  // Controle positivo: dia aberto na API e na LP.
  expect((await getSlots(api, spec.id, date)).length).toBe(3)
  await openWizard(page)
  await gotoMonth(page, date)
  await expect(dayButton(page, date)).toBeEnabled()

  const override = await createOverride(admin.ctx, { date, kind: 'block', reason: 'e2e' })
  let overrideRemoved = false
  cleanups.push(async () => {
    if (!overrideRemoved) await admin.ctx.delete(`/api/admin/availability/overrides/${override.id}`)
  })

  expect(await getSlots(api, spec.id, date)).toEqual([])

  await openWizard(page)
  await gotoMonth(page, date)
  await expect(dayButton(page, date, false)).toBeDisabled()
  await expect(dayButton(page, date)).toHaveCount(0)

  // Remover o override reabre o dia.
  const res = await admin.ctx.delete(`/api/admin/availability/overrides/${override.id}`)
  expect(res.ok()).toBe(true)
  overrideRemoved = true
  expect((await getSlots(api, spec.id, date)).length).toBe(3)
  await openWizard(page)
  await gotoMonth(page, date)
  await expect(dayButton(page, date)).toBeEnabled()
})

test('override parcial (10:00-11:00) bloqueia só aquele horário', async ({ page }) => {
  const date = futureDate(11)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)
  await createOverride(admin.ctx, {
    date,
    kind: 'block',
    start_time: '10:00:00',
    end_time: '11:00:00',
  })

  expect((await getSlots(api, spec.id, date)).map((s) => s.start)).toEqual([
    '09:00:00',
    '11:00:00',
  ])
  await openWizard(page)
  await pickDate(page, date)
  await expect(slotRadios(page)).toHaveText(['09:00', '11:00'])
})
