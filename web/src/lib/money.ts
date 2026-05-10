import Decimal from 'decimal.js'

import type { Money } from '../api/types'

const formatterCache = new Map<string, Intl.NumberFormat>()

function formatterFor(currency: string): Intl.NumberFormat {
  const key = `${currency}|en`
  let f = formatterCache.get(key)
  if (!f) {
    f = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    formatterCache.set(key, f)
  }
  return f
}

export function formatMoney(amount: Money | undefined | null, currency = 'KZT'): string {
  if (amount === undefined || amount === null || amount === '') return '—'
  // Decimal preserves precision; Number() conversion only happens at the
  // formatter boundary, where typical budget amounts stay well below
  // safe-integer range.
  const d = new Decimal(amount)
  return formatterFor(currency).format(d.toNumber())
}

export function sumMoney(values: Array<Money | undefined | null>): Decimal {
  return values.reduce<Decimal>((acc, v) => {
    if (v === undefined || v === null || v === '') return acc
    return acc.plus(v)
  }, new Decimal(0))
}

export function isZero(value: Money | undefined | null): boolean {
  if (value === undefined || value === null || value === '') return true
  return new Decimal(value).isZero()
}
