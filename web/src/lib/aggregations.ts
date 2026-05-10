import Decimal from 'decimal.js'

import { type RatesData, toKZT } from './rates'

/**
 * Sum a list of {amount, currency} rows into one Decimal in KZT.
 * Rows whose currency cannot be converted (rate not loaded) are skipped.
 */
export function sumToKZT<T>(
  rows: readonly T[],
  amountFn: (r: T) => string,
  currencyFn: (r: T) => string,
  rates: RatesData,
): Decimal {
  return rows.reduce<Decimal>((acc, r) => {
    const kzt = toKZT(amountFn(r), currencyFn(r), rates)
    if (kzt === null) return acc
    return acc.plus(kzt)
  }, new Decimal(0))
}

export interface MergedRow<K> {
  key: K
  label: string
  total: string // KZT, decimal string
}

/**
 * Merge rows by `keyFn` (e.g. category id, merchant name, month-iso),
 * converting each row to KZT before adding it to the bucket. Returns
 * the merged rows sorted by total descending.
 */
export function mergeRowsToKZT<T, K>(
  rows: readonly T[],
  keyFn: (r: T) => K,
  labelFn: (r: T) => string,
  amountFn: (r: T) => string,
  currencyFn: (r: T) => string,
  rates: RatesData,
): MergedRow<K>[] {
  const buckets = new Map<K, { label: string; total: Decimal }>()

  for (const r of rows) {
    const kzt = toKZT(amountFn(r), currencyFn(r), rates)
    if (kzt === null) continue
    const key = keyFn(r)
    const existing = buckets.get(key)
    if (existing) {
      existing.total = existing.total.plus(kzt)
    } else {
      buckets.set(key, { label: labelFn(r), total: new Decimal(kzt) })
    }
  }

  return Array.from(buckets.entries())
    .map(([key, { label, total }]) => ({ key, label, total: total.toString() }))
    .sort((a, b) => new Decimal(b.total).cmp(new Decimal(a.total)))
}
