import React, { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Decimal from 'decimal.js'

import { accountsApi, type AccountBalance } from '../../api/accounts'
import { analyticsApi } from '../../api/analytics'
import { categoriesApi } from '../../api/categories'
import { transactionsApi } from '../../api/transactions'
import type {
  Account,
  CashflowMonthRow,
  Category,
  ID,
  TransactionsListResponse,
} from '../../api/types'
import { ConvertedHint } from '../../components/ConvertedHint'
import { formatMonth } from '../../lib/dates'
import { formatMoney } from '../../lib/money'
import { toKZT, useRates } from '../../lib/rates'
import {
  amountClassName,
  amountPrefix,
  groupTransactionsByDay,
  type DayGroup,
} from '../../lib/transactions'

const RECENT_LIMIT = 15
const CASHFLOW_MONTHS = 6

export function AccountDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const accountQuery = useQuery<Account>({
    queryKey: ['accounts', 'one', id],
    queryFn: () => accountsApi.get(id),
    enabled: Boolean(id),
  })

  const balanceQuery = useQuery<AccountBalance>({
    queryKey: ['accounts', 'balance', id],
    queryFn: () => accountsApi.balance(id),
    enabled: Boolean(id),
  })

  const cashflowQuery = useQuery<CashflowMonthRow[]>({
    queryKey: ['analytics', 'cashflow-by-month', { account_id: id, months: CASHFLOW_MONTHS }],
    queryFn: () => analyticsApi.cashflowByMonth(CASHFLOW_MONTHS, id),
    enabled: Boolean(id),
  })

  const transactionsQuery = useQuery<TransactionsListResponse>({
    queryKey: ['transactions', { account_id: id, limit: RECENT_LIMIT }],
    queryFn: () =>
      transactionsApi.list({ account_id: id, limit: RECENT_LIMIT }),
    enabled: Boolean(id),
  })

  const categoriesQuery = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const rates = useRates()

  const categoryById = useMemo(() => {
    const map = new Map<ID, Category>()
    for (const c of categoriesQuery.data ?? []) map.set(c.id, c)
    return map
  }, [categoriesQuery.data])

  const cashflowRows = useMemo(
    () => foldCashflow(cashflowQuery.data ?? [], rates),
    [cashflowQuery.data, rates],
  )

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

  const account = accountQuery.data
  const archived = account.status === 'archived'
  const txRows = transactionsQuery.data?.transactions ?? []
  // Group rows under day headers the same way the Transactions list
  // does, so this page reads consistently with the global list.
  const txGroups = useMemo<DayGroup[]>(
    () => groupTransactionsByDay(txRows),
    [txRows],
  )

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{account.name}</h1>
          <p className="text-xs uppercase tracking-wide text-slate-500 mt-1">
            {account.type} · {account.currency} · {archived ? 'archived' : 'active'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-white"
          >
            Back
          </button>
          <Link
            to={`/accounts/${account.id}/edit`}
            className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
          >
            Edit
          </Link>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Kpi
          label="Current balance"
          value={
            balanceQuery.data
              ? formatMoney(balanceQuery.data.balance, balanceQuery.data.currency)
              : '…'
          }
          accent={balanceAccent(balanceQuery.data?.balance)}
          hint={
            balanceQuery.data ? (
              <ConvertedHint
                amount={balanceQuery.data.balance}
                currency={balanceQuery.data.currency}
              />
            ) : null
          }
        />
        <Kpi
          label="Transactions shown"
          value={String(txRows.length)}
          subtle={
            transactionsQuery.data?.next_cursor
              ? `more available — see all`
              : 'all loaded'
          }
        />
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-700">
            Cash flow ({CASHFLOW_MONTHS} months)
          </h2>
          <span className="text-xs text-slate-500">
            transfers included; KZT-equivalent
          </span>
        </div>
        {cashflowQuery.isPending && <p className="text-sm text-slate-500">Loading…</p>}
        {cashflowQuery.isError && (
          <p className="text-sm text-red-600">
            {(cashflowQuery.error as Error).message}
          </p>
        )}
        {cashflowQuery.data && cashflowRows.length === 0 && (
          <p className="text-sm text-slate-500">
            No flow on this account in the last {CASHFLOW_MONTHS} months.
          </p>
        )}
        {cashflowRows.length > 0 && <CashflowBars rows={cashflowRows} />}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            Recent transactions
          </h2>
          <Link
            to={`/transactions?account_id=${account.id}`}
            className="text-xs text-slate-500 hover:underline"
          >
            View all in this account →
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {transactionsQuery.isPending && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!transactionsQuery.isPending && txRows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-slate-500">
                  No transactions on this account yet.
                </td>
              </tr>
            )}
            {txGroups.map((group) => (
              <React.Fragment key={group.dayKey}>
                <tr className="bg-slate-100 border-y-2 border-slate-200">
                  <td colSpan={3} className="px-4 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                        {group.label}
                      </span>
                      <span className="text-xs font-medium text-slate-600 bg-white rounded-full px-2 py-0.5 tabular-nums">
                        {group.items.length}
                      </span>
                    </div>
                  </td>
                </tr>
                {group.items.map((t) => {
                  const category = t.category_id
                    ? categoryById.get(t.category_id)
                    : null
                  return (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/transactions/${t.id}`)}
                      className="cursor-pointer hover:bg-slate-50"
                    >
                      <td className="px-4 py-2 min-w-0">
                        <div className="flex flex-col">
                          <span className="text-slate-800">
                            {t.description || t.merchant || '(unnamed)'}
                          </span>
                          <span className="text-xs text-slate-500">{t.type}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-slate-600">
                        {category?.name ?? (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td
                        className={
                          'px-4 py-2 text-right font-medium tabular-nums ' +
                          amountClassName(t)
                        }
                      >
                        {amountPrefix(t)}
                        {formatMoney(t.amount, t.currency)}
                        <ConvertedHint
                          amount={t.amount}
                          currency={t.currency}
                        />
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}

interface FoldedCashflowRow {
  month: string
  expense: string
  income: string
  net: string
}

function foldCashflow(
  rows: CashflowMonthRow[],
  rates: ReturnType<typeof useRates>,
): FoldedCashflowRow[] {
  const buckets = new Map<string, { expense: Decimal; income: Decimal }>()
  for (const r of rows) {
    const ex = toKZTOrZero(r.expense, r.currency, rates)
    const inc = toKZTOrZero(r.income, r.currency, rates)
    const existing = buckets.get(r.month)
    if (existing) {
      existing.expense = existing.expense.plus(ex)
      existing.income = existing.income.plus(inc)
    } else {
      buckets.set(r.month, { expense: new Decimal(ex), income: new Decimal(inc) })
    }
  }
  return Array.from(buckets.entries())
    .map(([month, { expense, income }]) => ({
      month,
      expense: expense.toString(),
      income: income.toString(),
      net: income.minus(expense).toString(),
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
}

function toKZTOrZero(
  amount: string,
  currency: string,
  rates: ReturnType<typeof useRates>,
): string {
  const v = toKZT(amount, currency, rates)
  return v ?? '0'
}

function CashflowBars({ rows }: { rows: FoldedCashflowRow[] }) {
  const max = rows.reduce((m, r) => {
    const ex = Number(r.expense)
    const inc = Number(r.income)
    return Math.max(m, Number.isFinite(ex) ? ex : 0, Number.isFinite(inc) ? inc : 0)
  }, 0)
  return (
    <ul className="space-y-4">
      {rows.map((r) => {
        const ex = Number(r.expense)
        const inc = Number(r.income)
        const exPct = max > 0 && ex > 0 ? Math.max(2, Math.round((ex / max) * 100)) : 0
        const incPct =
          max > 0 && inc > 0 ? Math.max(2, Math.round((inc / max) * 100)) : 0
        const net = new Decimal(r.net || '0')
        return (
          <li key={r.month} className="space-y-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-700 font-medium">{formatMonth(r.month)}</span>
              <span className={'tabular-nums text-xs ' + netAccent(net)}>
                net {formatMoney(net.toString())}
              </span>
            </div>
            <Bar
              label="Income"
              amount={r.income}
              pct={incPct}
              accent="text-green-700"
              barClass="bg-green-600"
            />
            <Bar
              label="Expense"
              amount={r.expense}
              pct={exPct}
              accent="text-red-600"
              barClass="bg-red-600"
            />
          </li>
        )
      })}
    </ul>
  )
}

function Bar({
  label,
  amount,
  pct,
  accent,
  barClass,
}: {
  label: string
  amount: string
  pct: number
  accent: string
  barClass: string
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{label}</span>
        <span className={'tabular-nums ' + accent}>{formatMoney(amount)}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={'h-full ' + barClass} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function netAccent(net: Decimal): string {
  if (net.isPositive() && !net.isZero()) return 'text-green-700'
  if (net.isNegative()) return 'text-red-600'
  return 'text-slate-700'
}

function balanceAccent(balance: string | undefined): string {
  if (!balance) return 'text-slate-900'
  const d = new Decimal(balance)
  if (d.isNegative()) return 'text-red-600'
  if (d.isZero()) return 'text-slate-700'
  return 'text-slate-900'
}

function Kpi({
  label,
  value,
  subtle,
  accent,
  hint,
}: {
  label: string
  value: string
  subtle?: string
  accent?: string
  hint?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' + (accent ?? 'text-slate-900')
        }
      >
        {value}
      </p>
      {hint}
      {subtle && <p className="text-xs text-slate-500 mt-0.5">{subtle}</p>}
    </div>
  )
}
