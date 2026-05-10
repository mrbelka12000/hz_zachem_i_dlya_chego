// Public CDN-backed currency rates by Fawaz Ahmed.
// https://github.com/fawazahmed0/exchange-api
//
// We always pull the rates by base currency (USD / EUR) and read the
// KZT entry, since the SPA's display base is KZT.

const RATES_URL =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies'

export type RateBase = 'usd' | 'eur'

export interface FetchRatesResponse {
  date: string
  rates: Record<string, number>
}

interface RawResponse {
  date: string
  [key: string]: unknown
}

export async function fetchRates(base: RateBase): Promise<FetchRatesResponse> {
  const res = await fetch(`${RATES_URL}/${base}.json`)
  if (!res.ok) {
    throw new Error(`rates fetch failed: ${res.status}`)
  }
  const body = (await res.json()) as RawResponse
  const rates = body[base]
  if (!rates || typeof rates !== 'object') {
    throw new Error('rates response missing base key')
  }
  return { date: body.date, rates: rates as Record<string, number> }
}
