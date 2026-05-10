import { useQueries } from '@tanstack/react-query'
import Decimal from 'decimal.js'

import { fetchRates } from '../api/rates'

export interface RatesData {
  usdToKzt?: number
  eurToKzt?: number
  asOf?: string
  isLoading: boolean
  isError: boolean
}

const STALE_MS = 6 * 60 * 60 * 1000 // 6 hours

/**
 * Returns USD->KZT and EUR->KZT spot rates fetched from jsdelivr.
 *
 * The two rates are fetched in parallel; both are cached in TanStack
 * Query for 6 hours and never refetched on window focus, so the cost
 * is essentially one network round-trip per session per currency.
 */
export function useRates(): RatesData {
  const [usd, eur] = useQueries({
    queries: [
      {
        queryKey: ['rates', 'usd'],
        queryFn: () => fetchRates('usd'),
        staleTime: STALE_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      {
        queryKey: ['rates', 'eur'],
        queryFn: () => fetchRates('eur'),
        staleTime: STALE_MS,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    ],
  })

  return {
    usdToKzt: usd.data?.rates.kzt,
    eurToKzt: eur.data?.rates.kzt,
    asOf: usd.data?.date ?? eur.data?.date,
    isLoading: usd.isPending || eur.isPending,
    isError: usd.isError || eur.isError,
  }
}

/**
 * For UI hints beside a non-KZT amount: returns the KZT equivalent
 * as a decimal string, or null when the source is already KZT (no
 * hint needed) or the rate hasn't loaded yet.
 */
export function convertToKZT(
  amount: string | undefined | null,
  currency: string,
  rates: RatesData,
): string | null {
  if (!amount) return null
  const upper = currency.toUpperCase()
  if (upper === 'KZT') return null

  let rate: number | undefined
  if (upper === 'USD') rate = rates.usdToKzt
  else if (upper === 'EUR') rate = rates.eurToKzt
  if (!rate) return null

  return new Decimal(amount).times(rate).toFixed(2)
}

/**
 * Like convertToKZT, but returns the source amount unchanged when it
 * is already KZT (so aggregations can sum freely without a special
 * case). Returns null only when conversion was needed but the rate
 * is missing — caller should treat that as "skip this row".
 */
export function toKZT(
  amount: string | undefined | null,
  currency: string,
  rates: RatesData,
): string | null {
  if (!amount) return '0'
  const upper = currency.toUpperCase()
  if (upper === 'KZT') return amount

  let rate: number | undefined
  if (upper === 'USD') rate = rates.usdToKzt
  else if (upper === 'EUR') rate = rates.eurToKzt
  if (!rate) return null

  return new Decimal(amount).times(rate).toFixed(2)
}
