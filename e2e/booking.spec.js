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
import { RETENTION_NOTICE } from '../src/lib/privacy.js'

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

test('agendamento completo pelo wizard: passos 1 a 4, 201, confirmação e consulta confirmada no admin', async ({
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
  expect(booking.status).toBe('confirmed')

  // Tela de confirmação.
  await expect(page.getByRole('heading', { name: /Consulta confirmada, Maria\./ })).toBeVisible()
  await expect(page.getByRole('status')).toContainText(person.email)
  await expect(page.getByRole('button', { name: 'Fazer novo agendamento' })).toBeVisible()
  await expect(page.locator('.bk-error[role="alert"]')).toHaveCount(0)

  // A consulta existe no admin, confirmada, com os dados do wizard.
  const list = await listAppointments(admin.ctx, { date_from: date, date_to: date })
  const mine = list.filter((a) => a.client_phone === person.phone)
  expect(mine).toHaveLength(1)
  expect(mine[0]).toMatchObject({
    id: booking.id,
    status: 'confirmed',
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

// ---- Rodada 2/3: modalidade, formulário, políticas, lista de espera, erros ----

test('modalidade: trocar para Rio de Janeiro oferece só slots presenciais e grava o tipo escolhido', async ({
  page,
}) => {
  const date = futureDate(12)
  const online = await openDay(admin.ctx, date, {
    start_time: '09:00:00',
    end_time: '11:00:00',
    location: 'online',
  })
  cleanups.push(online.cleanup)
  const rio = await openDay(admin.ctx, date, {
    start_time: '14:00:00',
    end_time: '16:00:00',
    location: 'presencial_rj',
  })
  cleanups.push(rio.cleanup)
  const person = { name: 'Rita Presencial', phone: uniquePhone(), email: 'rita.rj@example.com' }

  // O tipo do slot precisa bater com o `type` do pedido.
  const wrong = await api.post('/api/bookings', {
    data: {
      specialty_id: spec.id,
      date,
      start: '14:00:00',
      type: 'online',
      client_name: person.name,
      client_email: person.email,
      client_phone: person.phone,
    },
  })
  expect(wrong.status()).toBe(409)

  await openWizard(page)
  await pickDate(page, date)
  await expect(slotRadios(page)).toHaveText(['09:00', '10:00'])

  await page.getByRole('radio', { name: 'Rio de Janeiro' }).click()
  await expect(page.getByRole('radio', { name: 'Rio de Janeiro' })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await pickDate(page, date)
  await expect(slotRadios(page)).toHaveText(['14:00', '15:00'])
  await pickSlot(page, '15:00')
  await next(page)
  await fillPersonal(page, person)
  await next(page)
  await chooseSpecialty(page, spec.name)
  await page.getByRole('radio', { name: 'Sim', exact: true }).click()
  await next(page, 'Revisar agendamento')
  await expect(page.getByRole('article', { name: 'Resumo da consulta' })).toContainText(
    'Presencial — Rio de Janeiro',
  )

  const responsePromise = waitBooking(page)
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(201)
  const booking = await response.json()
  created.push(booking.id)
  expect(booking.type).toBe('presencial_rj')
  expect(booking.start_time).toBe('15:00:00')
})

test('validação do formulário: obrigatórios, e-mail inválido e Voltar preserva os dados', async ({
  page,
}) => {
  const date = futureDate(13)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)

  await openWizard(page)
  await pickDate(page, date)
  await pickSlot(page, '09:00')
  await next(page)
  await expect(currentStep(page)).toContainText('Dados pessoais')

  const name = page.getByLabel('Nome completo')
  const phone = page.getByLabel('Telefone / WhatsApp')
  const email = page.getByLabel('E-mail')
  const invalid = (loc) => loc.evaluate((el) => !el.validity.valid)

  // Tudo vazio: a validação nativa bloqueia o avanço.
  await next(page)
  await expect(currentStep(page)).toContainText('Dados pessoais')
  expect(await invalid(name)).toBe(true)
  expect(await invalid(phone)).toBe(true)
  expect(await invalid(email)).toBe(true)

  // E-mail inválido com o resto preenchido continua bloqueando.
  await name.fill('Bia Validação')
  await phone.fill(uniquePhone())
  await email.fill('isto-nao-e-email')
  await next(page)
  await expect(currentStep(page)).toContainText('Dados pessoais')
  expect(await invalid(email)).toBe(true)
  expect(await invalid(name)).toBe(false)

  // Telefone curto demais também.
  await email.fill('bia@example.com')
  await phone.fill('123')
  await next(page)
  await expect(currentStep(page)).toContainText('Dados pessoais')
  expect(await invalid(phone)).toBe(true)

  const validPhone = uniquePhone()
  await phone.fill(validPhone)
  await next(page)
  await expect(currentStep(page)).toContainText('Motivo da consulta')

  // Voltar mantém o que foi digitado, inclusive o horário do passo 1.
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(name).toHaveValue('Bia Validação')
  await expect(phone).toHaveValue(validPhone)
  await expect(email).toHaveValue('bia@example.com')
  await page.getByRole('button', { name: 'Voltar' }).click()
  await expect(currentStep(page)).toContainText('Data e horário')
  await expect(page.getByRole('radio', { name: '09:00', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  )
})

test('a consulta marcada na LP já nasce confirmada', async ({ page }) => {
  const date = futureDate(14)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)
  const person = { name: 'Clara Auto', phone: uniquePhone(), email: 'clara.auto@example.com' }

  await openWizard(page)
  await walkToReview(page, { date, time: '11:00', person, specialtyName: spec.name })
  const responsePromise = waitBooking(page)
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(201)
  const booking = await response.json()
  created.push(booking.id)
  expect(booking.status).toBe('confirmed')
  await expect(page.getByRole('heading', { name: /Consulta confirmada, Clara\./ })).toBeVisible()

  const list = await listAppointments(admin.ctx, { date_from: date, date_to: date })
  expect(list.find((a) => a.id === booking.id)?.status).toBe('confirmed')
})

test('antecedência máxima: dias além de max_booking_advance_days não têm slots (API e LP)', async ({
  page,
}) => {
  const near = futureDate(2)
  const far = futureDate(8)
  for (const d of [near, far]) {
    const { cleanup } = await openDay(admin.ctx, d, { location: LOCATION })
    cleanups.push(cleanup)
  }
  await setSettings(admin.ctx, { max_booking_advance_days: 4 })

  expect((await getSlots(api, spec.id, near)).length).toBe(3)
  expect(await getSlots(api, spec.id, far)).toEqual([])

  await openWizard(page)
  await gotoMonth(page, far)
  await expect(dayButton(page, far, false)).toBeDisabled()
  await gotoMonth(page, near)
  await expect(dayButton(page, near)).toBeEnabled()

  // Sem o limite o dia distante volta a ser oferecido.
  await setSettings(admin.ctx, { max_booking_advance_days: 60 })
  expect((await getSlots(api, spec.id, far)).length).toBe(3)
})

test('limite de 3 reservas por telefone/dia: o 4º pedido recebe 429 e a UI mostra a mensagem', async ({
  page,
}) => {
  const date = futureDate(15)
  const { cleanup } = await openDay(admin.ctx, date, {
    start_time: '09:00:00',
    end_time: '13:00:00',
    location: LOCATION,
  })
  cleanups.push(cleanup)
  const person = { name: 'Paula Limite', phone: uniquePhone(), email: 'paula.limite@example.com' }

  for (const start of ['09:00:00', '10:00:00', '11:00:00']) {
    const b = await bookViaApi(api, {
      specialtyId: spec.id,
      date,
      start,
      type: LOCATION,
      client_phone: person.phone,
    })
    created.push(b.id)
  }

  await openWizard(page)
  await walkToReview(page, { date, time: '12:00', person, specialtyName: spec.name })
  const responsePromise = waitBooking(page)
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  const response = await responsePromise
  expect(response.status()).toBe(429)

  const alert = page.locator('.bk-error[role="alert"]')
  await expect(alert).toContainText('Limite de agendamentos atingido')
  // A paciente continua na revisão e nada foi criado além das 3 consultas.
  await expect(currentStep(page)).toContainText('Confirmação')
  await expect(page.getByRole('heading', { name: /Consulta confirmada/ })).toHaveCount(0)
  const list = await listAppointments(admin.ctx, { date_from: date, date_to: date })
  expect(list).toHaveLength(3)
})

test('lista de espera: entrar gera 201 e repetir o mesmo e-mail devolve 200 sem duplicar', async ({
  page,
}) => {
  const email = `espera.${Date.now()}@example.com`
  cleanups.push(async () => {
    const entries = await admin.ctx.get('/api/admin/waitlist')
    for (const e of await entries.json()) {
      if (e.client_email === email) await admin.ctx.delete(`/api/admin/waitlist/${e.id}`)
    }
  })

  const join = async () => {
    await openWizard(page)
    await page.getByRole('button', { name: /Entre na lista de espera/ }).click()
    const form = page.locator('.bk-waitlist__form')
    await expect(form.getByText(RETENTION_NOTICE)).toBeVisible()
    await form.getByLabel('Especialidade').selectOption({ label: spec.name })
    await form.getByLabel('Nome completo').fill('Lívia Espera')
    await form.getByLabel('E-mail').fill(email)
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/api/waitlist') && r.request().method() === 'POST',
    )
    await form.getByRole('button', { name: 'Entrar na lista' }).click()
    const response = await responsePromise
    await expect(page.locator('.bk-waitlist__done')).toContainText(email)
    return response
  }

  expect((await join()).status()).toBe(201)
  expect((await join()).status()).toBe(200)

  const entries = await (await admin.ctx.get('/api/admin/waitlist')).json()
  expect(entries.filter((e) => e.client_email === email)).toHaveLength(1)
})

test('sem horários: estado vazio explícito e nenhum dia habilitado', async ({ page }) => {
  await openWizard(page)
  await expect(page.getByText('Nenhum nas próximas semanas')).toBeVisible()
  await expect(page.getByRole('button', { name: /com horários disponíveis/ })).toHaveCount(0)
  await expect(slotRadios(page)).toHaveCount(0)
  await expect(page.locator('.bk-error[role="alert"]')).toHaveCount(0)
})

test('falha de rede em /api/slots: aviso em role=alert e a página não quebra', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e))
  await page.route('**/api/slots**', (route) => route.abort())

  await openWizard(page)
  await expect(page.locator('.bk-error[role="alert"]')).toContainText(
    'Não foi possível carregar a agenda',
  )
  await expect(page.getByRole('list', { name: 'Etapas do agendamento' })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('falha em /api/specialties: a seção de agendamento some sem derrubar a LP', async ({
  page,
}) => {
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e))
  await page.route('**/api/specialties**', (route) => route.abort())

  await page.goto('/')
  // As especialidades só carregam quando a seção se aproxima da viewport.
  await page.locator('#agendamento').scrollIntoViewIfNeeded()
  await expect(page.locator('#agendamento')).toHaveCount(0)
  await expect(page.locator('body')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('aviso LGPD (RETENTION_NOTICE) aparece nos dados pessoais', async ({ page }) => {
  const date = futureDate(16)
  const { cleanup } = await openDay(admin.ctx, date, { location: LOCATION })
  cleanups.push(cleanup)

  await openWizard(page)
  await pickDate(page, date)
  await pickSlot(page, '09:00')
  await next(page)
  await expect(currentStep(page)).toContainText('Dados pessoais')
  await expect(page.locator('.bk-privacy')).toHaveText(RETENTION_NOTICE)
  await expect(page.locator('.bk-privacy')).toContainText('contato@mulherviva.org')
})
