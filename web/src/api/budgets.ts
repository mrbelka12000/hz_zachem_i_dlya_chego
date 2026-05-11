import { apiFetch } from './client'
import type { ID, Money } from './types'

export type BudgetPeriod = 'monthly'

export interface Budget {
  id: ID
  household_id: ID
  category_id: ID | null
  period: BudgetPeriod
  amount: Money
  currency: string
  starts_on: string
  enabled: boolean
  name: string
  created_by: ID
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: ID | null
}

export interface BudgetStatus {
  budget: Budget
  spent: Money
  remaining: Money
  percent: number
  period_from: string
  period_to: string
}

export interface BudgetPayload {
  name: string
  category_id: ID | null
  amount: string
  currency: string
  enabled: boolean
}

interface ListResponse {
  budgets: Budget[]
}

interface StatusEnvelope {
  rows: BudgetStatus[]
}

export const budgetsApi = {
  list: () =>
    apiFetch<ListResponse>('GET', '/v1/budgets').then((r) => r.budgets),

  status: () =>
    apiFetch<StatusEnvelope>('GET', '/v1/budgets/status').then((r) => r.rows),

  get: (id: ID) => apiFetch<Budget>('GET', `/v1/budgets/${id}`),

  create: (payload: BudgetPayload) =>
    apiFetch<Budget>('POST', '/v1/budgets', { body: payload }),

  update: (id: ID, payload: BudgetPayload) =>
    apiFetch<Budget>('PUT', `/v1/budgets/${id}`, { body: payload }),

  remove: (id: ID) => apiFetch<void>('DELETE', `/v1/budgets/${id}`),
}

export interface TelegramLinkPayload {
  chat_id: number | null
}

export const meTelegramApi = {
  setChatID: (payload: TelegramLinkPayload) =>
    apiFetch<void>('PATCH', '/v1/me/telegram', { body: payload }),
}
