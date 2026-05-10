import { useQueryClient } from '@tanstack/react-query'

import { transactionsApi } from '../../api/transactions'

import { TransactionForm, type TransactionFormSubmit } from './TransactionForm'

export function NewTransaction() {
  const qc = useQueryClient()

  async function onSubmit(values: TransactionFormSubmit) {
    await transactionsApi.create(values)
    qc.invalidateQueries({ queryKey: ['transactions'] })
    qc.invalidateQueries({ queryKey: ['analytics'] })
  }

  return <TransactionForm mode="create" onSubmit={onSubmit} submitLabel="Create" />
}
