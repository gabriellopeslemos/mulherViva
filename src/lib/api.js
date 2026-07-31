// Trailing slashes here would produce `//api/...` once joined with a path.
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

const TOKEN_KEY = 'mv_admin_token'

// A request that never settles leaves the UI stuck on "Carregando..." forever.
const DEFAULT_TIMEOUT_MS = 15000

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    // Safari in private mode throws on storage access.
    return null
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Non-fatal: the session just will not survive a reload.
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Nothing to clean up.
  }
}

export class ApiError extends Error {
  constructor(status, detail) {
    super(detail || `Erro ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

// Lets the app react to an expired session from anywhere, so every caller does
// not have to special-case 401.
let onUnauthorized = null

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

/** FastAPI returns `detail` as a string, or as a list of validation errors. */
function readDetail(data) {
  if (!data) return undefined
  if (typeof data.detail === 'string') return data.detail
  if (Array.isArray(data.detail) && data.detail[0]?.msg) return data.detail[0].msg
  return undefined
}

async function request(
  path,
  { method = 'GET', body, auth = false, timeout = DEFAULT_TIMEOUT_MS } = {},
) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)

  let res
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new ApiError(
        0,
        'A conexão demorou demais. Verifique sua internet e tente novamente.',
      )
    }
    throw new ApiError(0, 'Não foi possível conectar ao servidor.')
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    let detail
    try {
      detail = readDetail(await res.json())
    } catch {
      // non-JSON error body
    }
    if (res.status === 401 && auth) {
      clearToken()
      onUnauthorized?.()
    }
    throw new ApiError(res.status, detail)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
}
