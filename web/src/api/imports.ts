import { ApiError } from './client'
import type { ID } from './types'

export interface ImportSummary {
  total: number
  inserted: number
  duplicates: number
  errors?: Array<{ line: number; message: string }>
}

const CSRF_COOKIE = 'csrf_token'

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  for (const part of document.cookie.split('; ')) {
    if (part.startsWith(prefix)) {
      return decodeURIComponent(part.slice(prefix.length))
    }
  }
  return null
}

export const importsApi = {
  async uploadCsv(accountId: ID, file: File): Promise<ImportSummary> {
    const form = new FormData()
    form.append('account_id', accountId)
    form.append('file', file)

    const headers: Record<string, string> = { Accept: 'application/json' }
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) headers['X-CSRF-Token'] = csrf

    const res = await fetch('/v1/imports/csv', {
      method: 'POST',
      credentials: 'include',
      headers,
      body: form,
    })

    if (!res.ok) {
      let code = 'http_error'
      let message = res.statusText
      try {
        const body = (await res.json()) as { error?: { code?: string; message?: string } }
        if (body.error?.code) code = body.error.code
        if (body.error?.message) message = body.error.message
      } catch {
        // ignore non-JSON body
      }
      throw new ApiError(message, res.status, code)
    }
    return (await res.json()) as ImportSummary
  },
}
