import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { accountsApi } from '../../api/accounts'
import type { Account } from '../../api/types'

import { AccountForm, type AccountFormValues } from './AccountForm'

export function EditAccount() {
  const { id = '' } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const accountQuery = useQuery<Account>({
    queryKey: ['accounts', 'one', id],
    queryFn: () => accountsApi.get(id),
    enabled: Boolean(id),
  })

  if (accountQuery.isPending) {
    return <p className="text-slate-500">Loading…</p>
  }
  if (accountQuery.isError || !accountQuery.data) {
    return (
      <p className="text-red-600">
        Could not load account:{' '}
        {(accountQuery.error as Error | null)?.message ?? 'not found'}
      </p>
    )
  }

  const a = accountQuery.data

  async function onSubmit(values: AccountFormValues) {
    await accountsApi.update(id, values)
    qc.invalidateQueries({ queryKey: ['accounts'] })
  }

  return (
    <AccountForm
      mode="edit"
      onSubmit={onSubmit}
      submitLabel="Save changes"
      initial={{
        name: a.name,
        type: a.type,
        currency: a.currency,
        initial_balance: a.initial_balance,
      }}
    />
  )
}
