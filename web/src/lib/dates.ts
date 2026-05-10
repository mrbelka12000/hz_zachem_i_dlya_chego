const dateFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const monthFmt = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
})

const dateTimeFmt = new Intl.DateTimeFormat('en-CA', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatDate(value: string | Date | undefined | null): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return dateFmt.format(d)
}

export function formatMonth(value: string | Date | undefined | null): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return monthFmt.format(d)
}

export function formatDateTime(value: string | Date | undefined | null): string {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return '—'
  return dateTimeFmt.format(d)
}

/** Returns ISO RFC3339 strings spanning the start of the current month
 * through "now", suitable for the analytics endpoints. */
export function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  return { from: start.toISOString(), to: now.toISOString() }
}

/** ISO RFC3339 string for "N days ago, midnight UTC". Used by filter defaults. */
export function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export function nowIso(): string {
  return new Date().toISOString()
}

/** Convert a `<input type="datetime-local">` value to RFC3339 (assuming
 * the browser's local timezone). Returns `''` for empty input. */
export function localInputToIso(value: string): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString()
}

/** Format an ISO timestamp into a value <input type="datetime-local"> accepts. */
export function isoToLocalInput(value: string | undefined | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
