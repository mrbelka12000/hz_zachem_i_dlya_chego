// Shared API types — mirrors the Go DTOs declared under internal/models
// and the JSON envelopes produced by internal/delivery/http/v1/*.go.
//
// Money values are serialized as decimal strings by Go's
// shopspring/decimal so the wire format never loses precision; on the
// client side we keep them as strings and only lift to decimal.js when
// arithmetic is needed.

export type ID = string

export type Money = string

export type AccountType = 'cash' | 'card' | 'bank' | 'other'
export type AccountStatus = 'active' | 'archived'

export type TransactionType = 'expense' | 'income' | 'transfer' | 'adjustment'
export type TransactionSource = 'manual' | 'csv' | 'bot'
export type CategorySource =
  | 'manual'
  | 'rule'
  | 'import'
  | 'system'
  | 'none'
export type Role = 'owner' | 'admin' | 'member'

export interface Account {
  id: ID
  household_id: ID
  name: string
  type: AccountType
  currency: string
  initial_balance: Money
  status: AccountStatus
  created_by: ID
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: ID | null
}

export interface Category {
  id: ID
  household_id: ID
  parent_id: ID | null
  name: string
  icon: string
  color: string
  created_by: ID
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: ID | null
}

export interface Transaction {
  id: ID
  household_id: ID
  account_id: ID
  type: TransactionType
  amount: Money
  currency: string
  occurred_at: string
  description: string
  merchant: string
  category_id: ID | null
  category_source: CategorySource
  categorization_rule_id?: ID | null
  source: TransactionSource
  external_id?: string | null
  external_hash?: string | null
  raw_payload?: Record<string, unknown> | null
  transfer_id?: ID | null
  transfer_direction?: 'out' | 'in' | null
  idempotency_key?: string | null
  created_by: ID
  updated_by?: ID | null
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: ID | null

  /**
   * Populated by GET /v1/transactions/:id when the row is a transfer
   * leg with a still-existing counterpart in another account.
   */
  counterpart?: Transaction | null
}

export interface Household {
  id: ID
  name: string
  base_currency: string
  timezone: string
}

export interface MeResponse {
  user_id: ID
  household_ids: ID[]
}

export interface AuthResponse {
  user_id: ID
  household_id: ID
}

export interface CategorySpendRow {
  category_id: ID | null
  category_name: string
  currency: string
  total: Money
  count: number
}

export interface MonthSpendRow {
  month: string
  currency: string
  total: Money
  count: number
}

export interface MerchantSpendRow {
  merchant: string
  currency: string
  total: Money
  count: number
}

export interface CashflowMonthRow {
  month: string
  currency: string
  expense: Money
  income: Money
  net: Money
}

export interface TransactionsListResponse {
  transactions: Transaction[]
  next_cursor?: {
    id: ID
    occurred_at: string
  } | null
}
