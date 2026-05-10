// Typed fetch wrapper.
//
//  - Always sends cookies (same-origin) so the session JWT and CSRF
//    cookie ride along.
//  - Reads the csrf_token cookie and forwards it as X-CSRF-Token on
//    state-changing requests.
//  - On 401 it attempts ONE silent /v1/auth/refresh, then retries the
//    original call. This is the only place the SPA touches the refresh
//    cookie path.
//  - Errors are normalized to ApiError with .code and .status so
//    consumers can switch on them.

const API_PREFIX = '/v1'
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const CSRF_COOKIE = 'csrf_token'

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface ServerErrorEnvelope {
  error?: {
    code?: string
    message?: string
  }
}

interface RequestOptions {
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  headers?: Record<string, string>
  /** Idempotency-Key header for POST routes that honor it. */
  idempotencyKey?: string
  /** Bypass the refresh-on-401 retry. Used by /auth/refresh itself. */
  noRefresh?: boolean
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length))
    }
  }
  return null
}

function resolveURL(path: string, query?: RequestOptions['query']): string {
  const base = path.startsWith('/') ? path : `${API_PREFIX}/${path}`
  if (!query) return base
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue
    params.append(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}

async function parseError(res: Response): Promise<ApiError> {
  let code = 'http_error'
  let message = res.statusText
  try {
    const body = (await res.json()) as ServerErrorEnvelope
    if (body.error?.code) code = body.error.code
    if (body.error?.message) message = body.error.message
  } catch {
    // ignore non-JSON bodies; keep the default message
  }
  return new ApiError(message, res.status, code)
}

async function performFetch(method: string, url: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...opts.headers,
  }

  let body: BodyInit | undefined
  if (opts.body !== undefined && !SAFE_METHODS.has(method)) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }

  if (!SAFE_METHODS.has(method)) {
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) headers['X-CSRF-Token'] = csrf
  }

  if (opts.idempotencyKey) {
    headers['Idempotency-Key'] = opts.idempotencyKey
  }

  return fetch(url, {
    method,
    credentials: 'include',
    headers,
    body,
  })
}

async function silentRefresh(): Promise<boolean> {
  try {
    const res = await performFetch('POST', `${API_PREFIX}/auth/refresh`, { noRefresh: true })
    return res.ok
  } catch {
    return false
  }
}

export async function apiFetch<T>(
  method: string,
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const upper = method.toUpperCase()
  const url = resolveURL(path, opts.query)

  let res = await performFetch(upper, url, opts)

  if (res.status === 401 && !opts.noRefresh && !path.includes('/auth/')) {
    const refreshed = await silentRefresh()
    if (refreshed) {
      res = await performFetch(upper, url, opts)
    }
  }

  if (!res.ok) {
    throw await parseError(res)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return (await res.json()) as T
  }
  return (await res.text()) as unknown as T
}
