import { apiFetch } from './client'
import type { Account, AccountStatus, AccountType, ID, Money } from './types'

export interface AccountPayload {
  name: string
  type: AccountType
  currency: string
  initial_balance: string
}

interface ListAccountsResponse {
  accounts: Account[]
}

export interface AccountBalance {
  balance: Money
  currency: string
}

export interface AccountBalanceRow {
  account_id: ID
  name: string
  currency: string
  status: AccountStatus
  balance: Money
}

interface BalancesEnvelope {
  rows: AccountBalanceRow[]
}

export const accountsApi = {
  list: (includeArchived = false) =>
    apiFetch<ListAccountsResponse>('GET', '/v1/accounts', {
      query: { archived: includeArchived ? 'true' : '' },
    }).then((r) => r.accounts),

  get: (id: string) => apiFetch<Account>('GET', `/v1/accounts/${id}`),

  balance: (id: string) =>
    apiFetch<AccountBalance>('GET', `/v1/accounts/${id}/balance`),

  balances: (includeArchived = false) =>
    apiFetch<BalancesEnvelope>('GET', '/v1/accounts/balances', {
      query: { archived: includeArchived ? 'true' : '' },
    }).then((r) => r.rows),

  create: (payload: AccountPayload) =>
    apiFetch<Account>('POST', '/v1/accounts', { body: payload }),

  update: (id: string, payload: AccountPayload) =>
    apiFetch<Account>('PUT', `/v1/accounts/${id}`, { body: payload }),

  archive: (id: string) => apiFetch<void>('PATCH', `/v1/accounts/${id}/archive`),

  unarchive: (id: string) => apiFetch<void>('PATCH', `/v1/accounts/${id}/unarchive`),

  remove: (id: string) => apiFetch<void>('DELETE', `/v1/accounts/${id}`),
}
