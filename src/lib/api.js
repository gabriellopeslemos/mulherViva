const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const TOKEN_KEY = 'mv_admin_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export class ApiError extends Error {
  constructor(status, detail, payload) {
    super(detail || `Erro ${status}`)
    this.status = status
    this.detail = detail
    // Raw `detail` from the API response, even when it isn't a plain string
    // (e.g. a structured conflict payload) — callers that need more than the
    // display message read this instead of `.detail`.
    this.payload = payload
  }
}

async function request(path, { method = 'GET', body, auth = false } = {}) {
  const isFormData = body instanceof FormData
  const headers = {}
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'
  if (auth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
  })

  if (!res.ok) {
    let detail
    let payload
    try {
      const data = await res.json()
      payload = data.detail
      detail = typeof payload === 'string' ? payload : undefined
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, detail, payload)
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  get: (path, opts) => request(path, { ...opts, method: 'GET' }),
  post: (path, body, opts) => request(path, { ...opts, method: 'POST', body }),
  patch: (path, body, opts) => request(path, { ...opts, method: 'PATCH', body }),
  delete: (path, opts) => request(path, { ...opts, method: 'DELETE' }),
  upload: (path, formData, opts) => request(path, { ...opts, method: 'POST', body: formData }),
}

export function resolveMediaUrl(url) {
  if (!url) return url
  return url.startsWith('/') ? `${BASE_URL}${url}` : url
}
