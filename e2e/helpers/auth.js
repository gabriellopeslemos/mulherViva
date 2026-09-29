import { createHmac } from 'node:crypto'
import { E2E_SECRET_KEY, E2E_ADMIN_EMAIL } from './constants.mjs'

const b64url = (input) => Buffer.from(input).toString('base64url')

/** Assina um JWT HS256 com a SECRET_KEY do e2e (sem dependências). */
export function signJwt({ sub = E2E_ADMIN_EMAIL, expInSeconds = 3600, secret = E2E_SECRET_KEY } = {}) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const exp = Math.floor(Date.now() / 1000) + expInSeconds
  const payload = b64url(JSON.stringify({ sub, exp }))
  const sig = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}

export const TOKEN_KEY = 'mv_admin_token'

/** Injeta o JWT no localStorage antes de qualquer script da página. */
export async function seedAdminToken(page, token) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [TOKEN_KEY, token],
  )
}
