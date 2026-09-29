import { test, expect } from '@playwright/test'
import {
  newApi,
  adminApi,
  specialtyBySlug,
  openDay,
  futureDate,
  getSlots,
  clearAvailability,
} from './helpers/api.js'

test('smoke: stack sobe, LP carrega sem splash e slots vêm da API', async ({ page }) => {
  const admin = await adminApi()
  const api = await newApi()
  await clearAvailability(admin.ctx)
  const date = futureDate(3)
  const { cleanup } = await openDay(admin.ctx, date)
  try {
    const spec = await specialtyBySlug(api)
    const slots = await getSlots(api, spec.id, date)
    expect(slots.length).toBe(3) // 09h-12h em slots de 60 min
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  } finally {
    await cleanup()
    await admin.dispose()
    await api.dispose()
  }
})
