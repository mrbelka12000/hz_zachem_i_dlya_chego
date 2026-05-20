import type { Transaction } from '../api/types'

type Sided = Pick<Transaction, 'type' | 'transfer_direction'>

export interface DayGroup {
  dayKey: string
  label: string
  items: Transaction[]
}

/**
 * Local-date YYYY-MM-DD key for grouping. We deliberately use the
 * user's local timezone — a transaction that occurred at 23:50 in
 * the user's wallclock belongs to that calendar day, even if UTC
 * rolled over already.
 */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function dayLabel(key: string): string {
  const today = dayKey(new Date().toISOString())
  if (key === today) return 'Today'
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString())
  if (key === yesterday) return 'Yesterday'
  // Build a date at local midnight from the YYYY-MM-DD key so
  // toLocaleDateString uses the right day in every timezone.
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Groups a DESC-sorted Transaction list into day buckets. Linear
 * pass — relies on the caller already having the rows in
 * occurred_at DESC order (the API returns them that way).
 */
export function groupTransactionsByDay(rows: readonly Transaction[]): DayGroup[] {
  const groups: DayGroup[] = []
  let current: DayGroup | null = null
  for (const t of rows) {
    const key = dayKey(t.occurred_at)
    if (!current || current.dayKey !== key) {
      current = { dayKey: key, label: dayLabel(key), items: [] }
      groups.push(current)
    }
    current.items.push(t)
  }
  return groups
}

/**
 * Tailwind class for the amount text. Rules:
 *   expense -> red
 *   income -> green
 *   transfer + direction='out' -> red (money leaving this account)
 *   transfer + direction='in' -> green (money arriving in this account)
 *   anything else (legacy transfers without direction, adjustment) -> slate
 */
export function amountClassName(t: Sided): string {
  if (t.type === 'expense') return 'text-red-600'
  if (t.type === 'income') return 'text-green-700'
  if (t.type === 'transfer') {
    if (t.transfer_direction === 'out') return 'text-red-600'
    if (t.transfer_direction === 'in') return 'text-green-700'
  }
  return 'text-slate-700'
}

/** Sign prefix matching amountClassName. Empty string for slate cases. */
export function amountPrefix(t: Sided): string {
  if (t.type === 'expense') return '−'
  if (t.type === 'income') return '+'
  if (t.type === 'transfer') {
    if (t.transfer_direction === 'out') return '−'
    if (t.transfer_direction === 'in') return '+'
  }
  return ''
}
