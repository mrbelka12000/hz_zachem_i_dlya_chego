import { apiFetch } from './client'
import type {
  CashflowMonthRow,
  CategorySpendRow,
  MerchantSpendRow,
  MonthSpendRow,
} from './types'

interface RowsEnvelope<T> {
  rows: T[]
}

export const analyticsApi = {
  spendingByCategory: (from: string, to: string) =>
    apiFetch<RowsEnvelope<CategorySpendRow>>('GET', '/v1/analytics/spending-by-category', {
      query: { from, to },
    }).then((r) => r.rows),

  spendingByMonth: (months = 6) =>
    apiFetch<RowsEnvelope<MonthSpendRow>>('GET', '/v1/analytics/spending-by-month', {
      query: { months },
    }).then((r) => r.rows),

  topMerchants: (from: string, to: string, limit = 10) =>
    apiFetch<RowsEnvelope<MerchantSpendRow>>('GET', '/v1/analytics/top-merchants', {
      query: { from, to, limit },
    }).then((r) => r.rows),

  incomeByCategory: (from: string, to: string) =>
    apiFetch<RowsEnvelope<CategorySpendRow>>('GET', '/v1/analytics/income-by-category', {
      query: { from, to },
    }).then((r) => r.rows),

  cashflowByMonth: (months = 6) =>
    apiFetch<RowsEnvelope<CashflowMonthRow>>('GET', '/v1/analytics/cashflow-by-month', {
      query: { months },
    }).then((r) => r.rows),
}
