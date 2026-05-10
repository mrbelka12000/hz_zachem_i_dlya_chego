import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import Decimal from 'decimal.js'

import { analyticsApi } from '../api/analytics'
import { transactionsApi } from '../api/transactions'
import type {
  CashflowMonthRow,
  CategorySpendRow,
  MerchantSpendRow,
  Transaction,
} from '../api/types'
import { currentMonthRange, formatDate, formatMonth } from '../lib/dates'
import { formatMoney, sumMoney } from '../lib/money'
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

  const monthExpenseTotal = sumMoney((byCategory.data ?? []).map((r) => r.total))
  const monthIncomeTotal = sumMoney((incomeByCategory.data ?? []).map((r) => r.total))
  const monthNet = monthIncomeTotal.minus(monthExpenseTotal)

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
              rows={byCategory.data.map((r) => ({
                key: r.category_id ?? r.category_name,
                label: r.category_name,
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
              rows={incomeByCategory.data.map((r) => ({
                key: r.category_id ?? r.category_name,
                label: r.category_name,
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
            <CashflowBars rows={cashflow.data} />
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
              {topMerchants.data.map((m) => (
                <li
                  key={m.merchant}
                  className="py-2 flex items-center justify-between text-sm"
                >
                  <span className="capitalize text-slate-700">{m.merchant}</span>
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
  children,
}: {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
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

function CashflowBars({ rows }: { rows: CashflowMonthRow[] }) {
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
          <span className={'font-medium tabular-nums ' + amountClassName(t)}>
            {amountPrefix(t)}
            {formatMoney(t.amount, t.currency)}
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
