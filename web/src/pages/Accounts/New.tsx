import { useQueryClient } from '@tanstack/react-query'

import { accountsApi } from '../../api/accounts'

import { AccountForm, type AccountFormValues } from './AccountForm'

export function NewAccount() {
  const qc = useQueryClient()

  async function onSubmit(values: AccountFormValues) {
    await accountsApi.create(values)
    qc.invalidateQueries({ queryKey: ['accounts'] })
  }

  return <AccountForm mode="create" onSubmit={onSubmit} submitLabel="Create" />
}
