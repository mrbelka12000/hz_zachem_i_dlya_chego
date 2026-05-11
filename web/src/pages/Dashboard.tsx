import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Decimal from 'decimal.js'

import { accountsApi, type AccountBalanceRow } from '../api/accounts'
import { analyticsApi } from '../api/analytics'
import { transactionsApi } from '../api/transactions'
import type {
  CashflowMonthRow,
  CategorySpendRow,
  MerchantSpendRow,
  Transaction,
} from '../api/types'
import { ConvertedHint } from '../components/ConvertedHint'
import { mergeRowsToKZT, sumToKZT } from '../lib/aggregations'
import { currentMonthRange, formatDate, formatMonth } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { toKZT, useRates } from '../lib/rates'
import { amountClassName, amountPrefix } from '../lib/transactions'

export function Dashboard() {
  const range = useMemo(currentMonthRange, [])

  const byCategory = useQuery<CategorySpendRow[]>({
    queryKey: ['analytics', 'spending-by-category', range],
    queryFn: () => analyticsApi.spendingByCategory(range.from, range.to),
  })

  const incomeByCategory = useQuery<CategorySpendRow[]>({
    queryKey: ['analytics', 'income-by-category', range],
    queryFn: () => analyticsApi.incomeByCategory(range.from, range.to),
  })

  const cashflow = useQuery<CashflowMonthRow[]>({
    queryKey: ['analytics', 'cashflow-by-month', 6],
    queryFn: () => analyticsApi.cashflowByMonth(6),
  })

  const topMerchants = useQuery<MerchantSpendRow[]>({
    queryKey: ['analytics', 'top-merchants', range],
    queryFn: () => analyticsApi.topMerchants(range.from, range.to, 5),
  })

  const recent = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => transactionsApi.list({ limit: 10 }),
  })

  const balances = useQuery<AccountBalanceRow[]>({
    queryKey: ['accounts', 'balances', { archived: true }],
    queryFn: () => accountsApi.balances(true),
  })

  const rates = useRates()

  const totalBalance = sumToKZT(
    balances.data ?? [],
    (r) => r.balance,
    (r) => r.currency,
    rates,
  )

  // All aggregations are converted to KZT before being summed/grouped.
  // Backend returns one row per (group, currency); the SPA folds them
  // into a single KZT bucket per group using the live FX rate.
  const monthExpenseTotal = sumToKZT(
    byCategory.data ?? [],
    (r) => r.total,
    (r) => r.currency,
    rates,
  )
  const monthIncomeTotal = sumToKZT(
    incomeByCategory.data ?? [],
    (r) => r.total,
    (r) => r.currency,
    rates,
  )
  const monthNet = monthIncomeTotal.minus(monthExpenseTotal)

  const expenseByCategory = mergeRowsToKZT(
    byCategory.data ?? [],
    (r) => r.category_id ?? r.category_name,
    (r) => r.category_name,
    (r) => r.total,
    (r) => r.currency,
    rates,
  )
  const incomeByCategoryRows = mergeRowsToKZT(
    incomeByCategory.data ?? [],
    (r) => r.category_id ?? r.category_name,
    (r) => r.category_name,
    (r) => r.total,
    (r) => r.currency,
    rates,
  )
  const merchantsRows = mergeRowsToKZT(
    topMerchants.data ?? [],
    (r) => r.merchant,
    (r) => r.merchant,
    (r) => r.total,
    (r) => r.currency,
    rates,
  ).slice(0, 5)
  const cashflowRows = useMemo(
    () => foldCashflow(cashflow.data ?? [], rates),
    [cashflow.data, rates],
  )

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          to="/transactions/new"
          className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
        >
          Add transaction
        </Link>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <Kpi
            label="Total balance"
            value={formatMoney(totalBalance.toString())}
            accent={balanceAccent(totalBalance)}
            loading={balances.isPending}
            subtle={
              balances.data && balances.data.length > 0
                ? `${balances.data.length} account${balances.data.length === 1 ? '' : 's'} · KZT-equivalent`
                : undefined
            }
          />
        </div>
        <Card
          title="Accounts"
          className="lg:col-span-2"
          actions={
            <Link to="/accounts" className="text-xs text-slate-500 hover:underline">
              Manage
            </Link>
          }
        >
          {balances.isError && (
            <ErrorText>{(balances.error as Error).message}</ErrorText>
          )}
          {balances.data && balances.data.length === 0 && (
            <Empty>No accounts yet — create one to start tracking.</Empty>
          )}
          {balances.data && balances.data.length > 0 && (
            <AccountBalances rows={balances.data} />
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Kpi
          label="Spent this month"
          value={formatMoney(monthExpenseTotal.toString())}
          accent="text-red-600"
          loading={byCategory.isPending}
        />
        <Kpi
          label="Earned this month"
          value={formatMoney(monthIncomeTotal.toString())}
          accent="text-green-700"
          loading={incomeByCategory.isPending}
        />
        <Kpi
          label="Net this month"
          value={formatMoney(monthNet.toString())}
          accent={netAccent(monthNet)}
          loading={byCategory.isPending || incomeByCategory.isPending}
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Spending by category">
          {byCategory.isError && <ErrorText>{(byCategory.error as Error).message}</ErrorText>}
          {byCategory.data && byCategory.data.length === 0 && (
            <Empty>No expenses recorded this month yet.</Empty>
          )}
          {byCategory.data && byCategory.data.length > 0 && (
            <BarList
              rows={expenseByCategory.map((r) => ({
                key: String(r.key),
                label: r.label,
                value: r.total,
              }))}
            />
          )}
        </Card>

        <Card title="Income by category">
          {incomeByCategory.data && incomeByCategory.data.length === 0 && (
            <Empty>No income recorded this month yet.</Empty>
          )}
          {incomeByCategory.data && incomeByCategory.data.length > 0 && (
            <BarList
              rows={incomeByCategoryRows.map((r) => ({
                key: String(r.key),
                label: r.label,
                value: r.total,
              }))}
              barClass="bg-green-600"
            />
          )}
        </Card>
      </section>

      <section>
        <Card title="Cash flow by month">
          {cashflow.data && cashflow.data.length === 0 && (
            <Empty>No history yet — import a CSV or add a few transactions.</Empty>
          )}
          {cashflow.data && cashflow.data.length > 0 && (
            <CashflowBars rows={cashflowRows} />
          )}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Top merchants"
          actions={
            <Link to="/transactions" className="text-xs text-slate-500 hover:underline">
              View all
            </Link>
          }
        >
          {topMerchants.data && topMerchants.data.length === 0 && (
            <Empty>No merchant data yet.</Empty>
          )}
          {topMerchants.data && topMerchants.data.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {merchantsRows.map((m) => (
                <li
                  key={String(m.key)}
                  className="py-2 flex items-center justify-between text-sm"
                >
                  <span className="capitalize text-slate-700">{m.label}</span>
                  <span className="font-medium tabular-nums">{formatMoney(m.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          title="Recent transactions"
          actions={
            <Link to="/transactions" className="text-xs text-slate-500 hover:underline">
              View all
            </Link>
          }
        >
          {recent.data && recent.data.transactions.length === 0 && (
            <Empty>No transactions yet.</Empty>
          )}
          {recent.data && recent.data.transactions.length > 0 && (
            <RecentList rows={recent.data.transactions} />
          )}
        </Card>
      </section>
    </div>
  )
}

function Card({
  title,
  actions,
  className,
  children,
}: {
  title: string
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={
        'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm ' +
        (className ?? '')
      }
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  )
}

function Kpi({
  label,
  value,
  subtle,
  accent,
  loading,
}: {
  label: string
  value: string
  subtle?: string
  accent?: string
  loading?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={
          'mt-1 text-2xl font-semibold tabular-nums ' + (accent ?? 'text-slate-900')
        }
      >
        {loading ? '…' : value}
      </p>
      {subtle && <p className="text-xs text-slate-500 mt-0.5">{subtle}</p>}
    </div>
  )
}

function netAccent(net: Decimal): string {
  if (net.isPositive() && !net.isZero()) return 'text-green-700'
  if (net.isNegative()) return 'text-red-600'
  return 'text-slate-700'
}

interface BarRow {
  key: string
  label: string
  value: string
}

function BarList({
  rows,
  barClass = 'bg-slate-900',
}: {
  rows: BarRow[]
  barClass?: string
}) {
  const max = rows.reduce((m, r) => {
    const n = Number(r.value)
    return Number.isFinite(n) && n > m ? n : m
  }, 0)
  return (
    <ul className="space-y-2">
      {rows.map((r) => {
        const n = Number(r.value)
        const pct = max > 0 ? Math.max(2, Math.round((n / max) * 100)) : 0
        return (
          <li key={r.key}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-700 truncate">{r.label}</span>
              <span className="font-medium tabular-nums">{formatMoney(r.value)}</span>
            </div>
            <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div className={'h-full ' + barClass} style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

interface FoldedCashflowRow {
  month: string
  expense: string // KZT
  income: string // KZT
  net: string // KZT
}

/**
 * Converts each (month, currency) row to KZT and merges by month so a
 * single bar pair represents the full household cash flow regardless
 * of how many currencies the user juggles.
 */
function foldCashflow(rows: CashflowMonthRow[], rates: ReturnType<typeof useRates>): FoldedCashflowRow[] {
  const buckets = new Map<string, { expense: Decimal; income: Decimal }>()
  for (const r of rows) {
    const ex = toKZTOrZero(r.expense, r.currency, rates)
    const inc = toKZTOrZero(r.income, r.currency, rates)
    const key = r.month
    const existing = buckets.get(key)
    if (existing) {
      existing.expense = existing.expense.plus(ex)
      existing.income = existing.income.plus(inc)
    } else {
      buckets.set(key, { expense: new Decimal(ex), income: new Decimal(inc) })
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

function toKZTOrZero(amount: string, currency: string, rates: ReturnType<typeof useRates>): string {
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

function RecentList({ rows }: { rows: Transaction[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((t) => (
        <li key={t.id} className="py-2 flex items-center justify-between text-sm">
          <div className="min-w-0">
            <p className="text-slate-700 truncate">
              {t.description || t.merchant || '(unnamed)'}
            </p>
            <p className="text-xs text-slate-500">
              {formatDate(t.occurred_at)} · {t.type}
            </p>
          </div>
          <span className="text-right">
            <span className={'font-medium tabular-nums ' + amountClassName(t)}>
              {amountPrefix(t)}
              {formatMoney(t.amount, t.currency)}
            </span>
            <ConvertedHint amount={t.amount} currency={t.currency} />
          </span>
        </li>
      ))}
    </ul>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-slate-500">{children}</p>
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-red-600">{children}</p>
}

function balanceAccent(total: Decimal): string {
  if (total.isNegative()) return 'text-red-600'
  if (total.isZero()) return 'text-slate-700'
  return 'text-slate-900'
}

function AccountBalances({ rows }: { rows: AccountBalanceRow[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((a) => {
        const archived = a.status === 'archived'
        return (
          <li
            key={a.account_id}
            className="py-2 flex items-center justify-between text-sm"
          >
            <Link
              to={`/accounts/${a.account_id}`}
              className="flex items-center gap-2 min-w-0 hover:underline"
            >
              <span className="truncate text-slate-800">{a.name}</span>
              {archived && (
                <span className="rounded-full bg-amber-100 text-amber-800 text-[10px] px-1.5 py-0.5">
                  archived
                </span>
              )}
            </Link>
            <span className="text-right whitespace-nowrap">
              <span className="font-medium tabular-nums text-slate-800">
                {formatMoney(a.balance, a.currency)}
              </span>
              <ConvertedHint amount={a.balance} currency={a.currency} inline />
            </span>
          </li>
        )
      })}
    </ul>
  )
}
