import { apiFetch } from './client'
import type {
  ID,
  Transaction,
  TransactionsListResponse,
  TransactionType,
} from './types'

export interface CreateTransactionPayload {
  account_id: ID
  type: TransactionType
  amount: string
  occurred_at?: string
  description?: string
  merchant?: string
  category_id?: ID | null
}

export interface UpdateTransactionPayload {
  amount: string
  occurred_at?: string
  description?: string
  merchant?: string
  category_id?: ID | null
}

export interface CreateTransferPayload {
  from_account_id: ID
  to_account_id: ID
  amount: string
  occurred_at?: string
  description?: string
}

export interface ListTransactionsQuery {
  from?: string
  to?: string
  category_id?: ID
  account_id?: ID
  type?: TransactionType
  uncategorized?: boolean
  q?: string
  amount_min?: string
  amount_max?: string
  limit?: number
  cursor_id?: ID
  cursor_at?: string
}

function makeIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export const transactionsApi = {
  list: (query: ListTransactionsQuery = {}) =>
    apiFetch<TransactionsListResponse>('GET', '/v1/transactions', {
      query: {
        from: query.from,
        to: query.to,
        category_id: query.category_id,
        account_id: query.account_id,
        type: query.type,
        uncategorized: query.uncategorized ? 'true' : '',
        q: query.q,
        amount_min: query.amount_min,
        amount_max: query.amount_max,
        limit: query.limit,
        cursor_id: query.cursor_id,
        cursor_at: query.cursor_at,
      },
    }),

  get: (id: ID) => apiFetch<Transaction>('GET', `/v1/transactions/${id}`),

  create: (payload: CreateTransactionPayload, idempotencyKey?: string) =>
    apiFetch<Transaction>('POST', '/v1/transactions', {
      body: payload,
      idempotencyKey: idempotencyKey ?? makeIdempotencyKey(),
    }),

  transfer: (payload: CreateTransferPayload, idempotencyKey?: string) =>
    apiFetch<{ expense: Transaction; income: Transaction }>(
      'POST',
      '/v1/transactions/transfer',
      {
        body: payload,
        idempotencyKey: idempotencyKey ?? makeIdempotencyKey(),
      },
    ),

  update: (id: ID, payload: UpdateTransactionPayload) =>
    apiFetch<Transaction>('PUT', `/v1/transactions/${id}`, { body: payload }),

  remove: (id: ID) => apiFetch<void>('DELETE', `/v1/transactions/${id}`),

  pairTransfers: () =>
    apiFetch<{ paired: number }>('POST', '/v1/transactions/pair-transfers'),
}
