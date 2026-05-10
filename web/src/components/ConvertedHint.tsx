import { formatMoney } from '../lib/money'
import { convertToKZT, useRates } from '../lib/rates'

interface Props {
  amount: string | undefined | null
  currency: string
  /** When true, render inline (margin-left). When false, render as a block under the main amount. */
  inline?: boolean
}

/**
 * Renders "≈ X KZT" beside any non-KZT amount. Returns nothing when
 * the amount is already in KZT or rates haven't loaded yet.
 */
export function ConvertedHint({ amount, currency, inline = false }: Props) {
  const rates = useRates()
  const kzt = convertToKZT(amount, currency, rates)
  if (!kzt) return null

  const cls = inline
    ? 'ml-2 text-xs text-slate-500'
    : 'block text-xs text-slate-500 mt-0.5'

  return <span className={cls}>≈ {formatMoney(kzt, 'KZT')}</span>
}
