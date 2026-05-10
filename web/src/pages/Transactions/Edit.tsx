import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { transactionsApi } from '../../api/transactions'
import type { Transaction } from '../../api/types'
import { isoToLocalInput } from '../../lib/dates'

import { TransactionForm, type TransactionFormSubmit } from './TransactionForm'

export function EditTransaction() {
  const { id = '' } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const txQuery = useQuery<Transaction>({
    queryKey: ['transactions', 'one', id],
    queryFn: () => transactionsApi.get(id),
    enabled: Boolean(id),
  })

  if (txQuery.isPending) {
    return <p className="text-slate-500">Loading…</p>
  }
  if (txQuery.isError || !txQuery.data) {
    return (
      <p className="text-red-600">
        Could not load transaction:{' '}
        {(txQuery.error as Error | null)?.message ?? 'not found'}
      </p>
    )
  }

  const t = txQuery.data

  async function onSubmit(values: TransactionFormSubmit) {
    await transactionsApi.update(id, {
      amount: values.amount,
      occurred_at: values.occurred_at,
      description: values.description,
      merchant: values.merchant,
      category_id: values.category_id ?? null,
    })
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['analytics'] })
  }

  return (
    <TransactionForm
      mode="edit"
      onSubmit={onSubmit}
      submitLabel="Save changes"
      initial={{
        account_id: t.account_id,
        type: (t.type === 'transfer'
          ? 'expense'
          : t.type) as 'expense' | 'income' | 'adjustment',
        amount: t.amount,
        occurred_at: isoToLocalInput(t.occurred_at),
        description: t.description,
        merchant: t.merchant,
        category_id: t.category_id ?? '',
      }}
    />
  )
}
