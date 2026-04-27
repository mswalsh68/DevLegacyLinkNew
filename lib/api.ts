// ─── API client — thin fetch wrapper ─────────────────────────────────────────
//
// Exposes globalApi and appApi (both point to /api on the same Next.js origin).
// Mimics the Axios call-site API used in the original project:
//   globalApi.get('/players', { params: { search: 'jones' } })
//   globalApi.post('/alumni', { firstName: 'Jane', ... })
//   globalApi.patch('/config', { teamName: 'Bulls' })
//   globalApi.delete('/users/123/permissions/roster')
//
// Auto-refresh on 401:
//   On first 401, calls POST /api/auth/refresh (refresh token is in httpOnly cookie).
//   Server re-issues access_token cookie on success, then the original request retries.
//   Concurrent 401s queue behind a single refresh attempt (thundering-herd guard).
//   On refresh failure: clears cfb_user localStorage and redirects to /login.
//
// No Axios — native fetch only.

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildUrl(base: string, path: string, params?: Record<string, unknown>): string {
  const url = `${base}${path}`
  if (!params || Object.keys(params).length === 0) return url
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  }
  return `${url}?${qs.toString()}`
}

function clearSession() {
  try { localStorage.removeItem('cfb_user') } catch { /* private browsing */ }
  if (typeof window !== 'undefined') window.location.href = '/login'
}

// ─── Refresh logic ────────────────────────────────────────────────────────────

let isRefreshing        = false
let refreshQueue: Array<(ok: boolean) => void> = []

async function tryRefresh(): Promise<boolean> {
  // Preserve currentTeamId across token refresh
  let currentTeamId: number | null = null
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('cfb_user') : null
    if (raw) currentTeamId = JSON.parse(raw).currentTeamId ?? null
  } catch { /* ignore */ }

  try {
    const res = await fetch('/api/auth/refresh', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ currentTeamId }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Response wrapper (mirrors Axios shape) ───────────────────────────────────

export interface ApiResponse<T = unknown> {
  data:   T
  status: number
}

// ─── Core request ─────────────────────────────────────────────────────────────

async function request<T = unknown>(
  method:  string,
  url:     string,
  options: { params?: Record<string, unknown>; body?: unknown } = {},
  _retry = false,
): Promise<ApiResponse<T>> {
  const finalUrl = buildUrl('', url, options.params)

  const res = await fetch(finalUrl, {
    method,
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  // ── 401: attempt token refresh once ───────────────────────────────────────
  if (res.status === 401 && !_retry) {
    if (isRefreshing) {
      // Queue behind the in-flight refresh
      await new Promise<boolean>((resolve) => refreshQueue.push(resolve))
      return request<T>(method, url, options, true)
    }

    isRefreshing = true
    const ok = await tryRefresh()
    isRefreshing = false

    // Drain the queue
    refreshQueue.forEach((cb) => cb(ok))
    refreshQueue = []

    if (ok) {
      return request<T>(method, url, options, true)
    }

    // Refresh failed — clear session and redirect
    clearSession()
    throw new ApiError('Session expired. Please log in again.', 401, null)
  }

  // ── Parse JSON body ────────────────────────────────────────────────────────
  let body: T
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    body = (await res.json()) as T
  } else {
    body = (await res.text()) as unknown as T
  }

  if (!res.ok) {
    const msg =
      (body as Record<string, unknown>)?.error as string ??
      (body as Record<string, unknown>)?.message as string ??
      `HTTP ${res.status}`
    throw new ApiError(msg, res.status, { data: body })
  }

  return { data: body, status: res.status }
}

// ─── Error class ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly response: { data?: unknown } | null,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// ─── Client factory ───────────────────────────────────────────────────────────

function createClient(base: string) {
  return {
    get<T = unknown>(path: string, opts?: { params?: Record<string, unknown> }) {
      return request<T>('GET', `${base}${path}`, { params: opts?.params })
    },
    post<T = unknown>(path: string, body?: unknown) {
      return request<T>('POST', `${base}${path}`, { body })
    },
    put<T = unknown>(path: string, body?: unknown) {
      return request<T>('PUT', `${base}${path}`, { body })
    },
    patch<T = unknown>(path: string, body?: unknown) {
      return request<T>('PATCH', `${base}${path}`, { body })
    },
    delete<T = unknown>(path: string) {
      return request<T>('DELETE', `${base}${path}`)
    },
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────

// Single unified client — all requests go to /api/* on the same Next.js origin.
// Both globalApi and appApi point to the same base; the names are kept so
// pages ported from the original project don't need call-site changes.
const apiClient = createClient('/api')

export const globalApi = apiClient
export const appApi    = apiClient

/**
 * Extracts the API error message from an ApiError or unknown thrown value,
 * falling back to a provided default string.
 */
export function getApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error)    return err.message || fallback
  return fallback
}
