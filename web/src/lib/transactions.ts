import type { Transaction } from '../api/types'

type Sided = Pick<Transaction, 'type' | 'transfer_direction'>

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
