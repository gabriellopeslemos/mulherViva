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

const MONTHS_LONG = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const hhmm = (t) => t.slice(0, 5)
const parts = (iso) => iso.split('-').map(Number) // [y, m, d]

/**
 * Abre a LP, navega até o mês de `date`, escolhe o dia e devolve o radiogroup de
 * horários. A modalidade padrão da LP é "Online" (Brasília está oculta), por isso
 * os testes usam regras `online`.
 */
async function openLpDay(page, date) {
  const [y, m, d] = parts(date)
  await page.goto('/')
  await page.locator('#agendamento').scrollIntoViewIfNeeded()
  // Navega mês a mês (hoje em São Paulo -> mês de `date`), confirmando cada título.
  const [ty, tm] = parts(futureDate(0))
  const monthHeading = (yy, mm) => page.getByText(new RegExp(`^${MONTHS_LONG[mm]} ${yy}$`, 'i'))
  await expect(monthHeading(ty, tm - 1)).toBeVisible()
  const monthsAhead = (y - ty) * 12 + (m - tm)
  for (let i = 1; i <= monthsAhead; i++) {
    const idx = tm - 1 + i
    await page.getByRole('button', { name: 'Próximo mês' }).click()
    await expect(monthHeading(ty + Math.floor(idx / 12), idx % 12)).toBeVisible()
  }
  const day = page.getByRole('button', {
    name: new RegExp(`^${d} de ${MONTHS_LONG[m - 1]}, com horários disponíveis`),
  })
  await expect(day).toBeEnabled()
  await day.click()
  const group = page.getByRole('radiogroup', { name: 'Horários disponíveis' })
  await expect(group).toBeVisible()
  return group
}

async function findAppointment(admin, id, date) {
  const list = await listAppointments(admin, { date_from: date, date_to: date })
  return list.find((a) => a.id === id)
}

test.describe('autogestão pelo link', () => {
  let admin
  let api

  test.beforeEach(async () => {
    admin = await adminApi()
    api = await newApi()
    await clearAvailability(admin.ctx)
    await resetSettings(admin.ctx)
  })

  test.afterEach(async () => {
    await clearAvailability(admin.ctx)
    await resetSettings(admin.ctx)
    await admin.dispose()
    await api.dispose()
  })

  test('cancelar pelo link: status vira cancelled e o horário é liberado', async ({ page }) => {
    const date = futureDate(4)
    const { cleanup } = await openDay(admin.ctx, date, { location: 'online' })
    let appt
    try {
      const spec = await specialtyBySlug(api)
      const before = await getSlots(api, spec.id, date)
      expect(before.length).toBeGreaterThan(0)
      const slot = before[0]
      const start = hhmm(slot.start)

      appt = await bookViaApi(api, { specialtyId: spec.id, date, start: slot.start, type: 'online' })
      expect(appt.token).toBeTruthy()

      // Ocupado: some da API e da LP.
      expect((await getSlots(api, spec.id, date)).map((s) => hhmm(s.start))).not.toContain(start)
      const groupBusy = await openLpDay(page, date)
      await expect(groupBusy.getByRole('radio', { name: start })).toHaveCount(0)
      await expect(groupBusy.getByRole('radio').first()).toBeVisible()

      // Autogestão (overlay lido de ?manage=).
      await page.goto(`/?manage=${appt.token}`)
      const card = page.locator('.manage-card') // overlay de autogestão
      await expect(card.getByText('Gerenciar agendamento')).toBeVisible()
      await expect(card.getByRole('heading', { name: spec.name })).toBeVisible()
      await expect(card.getByText(new RegExp(`às ${start} ·`))).toBeVisible()
      await card.getByRole('button', { name: 'Cancelar consulta' }).click()
      await expect(card.getByRole('heading', { name: 'Pronto!' })).toBeVisible()
      await expect(card.getByText('Sua consulta foi cancelada.')).toBeVisible()

      // API pública de autogestão + API admin.
      const managed = await (await api.get(`/api/bookings/manage/${appt.token}`)).json()
      expect(managed.status).toBe('cancelled')
      expect(managed.can_modify).toBe(false)
      expect((await findAppointment(admin.ctx, appt.id, date)).status).toBe('cancelled')

      // Slot liberado: reaparece em /api/slots e na LP.
      await expect
        .poll(async () => (await getSlots(api, spec.id, date)).map((s) => hhmm(s.start)))
        .toContain(start)
      const groupFree = await openLpDay(page, date)
      await expect(groupFree.getByRole('radio', { name: start })).toBeVisible()
    } finally {
      if (appt) await admin.ctx.patch(`/api/admin/appointments/${appt.id}`, { data: { status: 'cancelled' } })
      await cleanup()
    }
  })

  test('reagendar pelo link: slot antigo liberado, novo ocupado e admin atualizado', async ({ page }) => {
    const oldDate = futureDate(4)
    const newDate = futureDate(11) // mesmo dia da semana, dentro dos 14 dias da tela
    const { cleanup } = await openDay(admin.ctx, oldDate, { location: 'online' })
    let appt
    try {
      const spec = await specialtyBySlug(api)
      const oldSlots = await getSlots(api, spec.id, oldDate)
      const newSlots = await getSlots(api, spec.id, newDate)
      expect(oldSlots.length).toBeGreaterThan(1)
      expect(newSlots.length).toBeGreaterThan(1)
      const oldStart = hhmm(oldSlots[0].start)
      const target = newSlots[1]
      const newStart = hhmm(target.start)

      appt = await bookViaApi(api, { specialtyId: spec.id, date: oldDate, start: oldSlots[0].start, type: 'online' })
      expect((await getSlots(api, spec.id, oldDate)).map((s) => hhmm(s.start))).not.toContain(oldStart)

      await page.goto(`/?manage=${appt.token}`)
      const card = page.locator('.manage-card') // overlay de autogestão
      await expect(card.getByText('Gerenciar agendamento')).toBeVisible()
      await card.getByRole('button', { name: 'Reagendar' }).click()
      await expect(card.getByText('Escolha um novo horário')).toBeVisible()

      const [, nm, nd] = parts(newDate)
      const dayChip = card.getByRole('button', { name: new RegExp(`^\\D+${nd} ${MONTHS_SHORT[nm - 1]}$`) })
      await expect(dayChip).toBeEnabled()
      await dayChip.click()
      const timeChip = card.getByRole('button', { name: newStart, exact: true })
      await timeChip.click()
      await card.getByRole('button', { name: 'Confirmar novo horário' }).click()

      await expect(card.getByRole('heading', { name: 'Pronto!' })).toBeVisible()
      await expect(card.getByText('Sua consulta foi reagendada com sucesso.')).toBeVisible()
      await expect(card.getByText(new RegExp(`às ${newStart}$`))).toBeVisible()

      // Slot antigo liberado, novo ocupado.
      await expect
        .poll(async () => (await getSlots(api, spec.id, oldDate)).map((s) => hhmm(s.start)))
        .toContain(oldStart)
      expect((await getSlots(api, spec.id, newDate)).map((s) => hhmm(s.start))).not.toContain(newStart)

      // Autogestão e admin enxergam data/hora novas.
      const managed = await (await api.get(`/api/bookings/manage/${appt.token}`)).json()
      expect(managed.date).toBe(newDate)
      expect(hhmm(managed.start_time)).toBe(newStart)
      expect(managed.status).not.toBe('cancelled')

      const adminView = await findAppointment(admin.ctx, appt.id, newDate)
      expect(adminView).toBeTruthy()
      expect(adminView.date).toBe(newDate)
      expect(hhmm(adminView.start_time)).toBe(newStart)
      expect(await findAppointment(admin.ctx, appt.id, oldDate)).toBeUndefined()
    } finally {
      if (appt) await admin.ctx.patch(`/api/admin/appointments/${appt.id}`, { data: { status: 'cancelled' } })
      await cleanup()
    }
  })
})
