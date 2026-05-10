import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { analyticsApi } from '../api/analytics'
import { transactionsApi } from '../api/transactions'
import type {
  CategorySpendRow,
  MerchantSpendRow,
  MonthSpendRow,
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

  const byMonth = useQuery<MonthSpendRow[]>({
    queryKey: ['analytics', 'spending-by-month', 6],
    queryFn: () => analyticsApi.spendingByMonth(6),
  })

  const topMerchants = useQuery<MerchantSpendRow[]>({
    queryKey: ['analytics', 'top-merchants', range],
    queryFn: () => analyticsApi.topMerchants(range.from, range.to, 5),
  })

  const recent = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => transactionsApi.list({ limit: 10 }),
  })

  const monthTotal = sumMoney((byCategory.data ?? []).map((r) => r.total)).toString()

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
          value={formatMoney(monthTotal)}
          loading={byCategory.isPending}
        />
        <Kpi
          label="Top category"
          value={byCategory.data?.[0]?.category_name ?? '—'}
          subtle={
            byCategory.data?.[0] ? formatMoney(byCategory.data[0].total) : undefined
          }
          loading={byCategory.isPending}
        />
        <Kpi
          label="Recent count"
          value={recent.data ? String(recent.data.transactions.length) : '—'}
          loading={recent.isPending}
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

        <Card title="Spending by month">
          {byMonth.data && byMonth.data.length === 0 && <Empty>No history yet.</Empty>}
          {byMonth.data && byMonth.data.length > 0 && (
            <BarList
              rows={byMonth.data.map((r) => ({
                key: r.month,
                label: formatMonth(r.month),
                value: r.total,
              }))}
            />
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
  loading,
}: {
  label: string
  value: string
  subtle?: string
  loading?: boolean
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{loading ? '…' : value}</p>
      {subtle && <p className="text-xs text-slate-500 mt-0.5">{subtle}</p>}
    </div>
  )
}

interface BarRow {
  key: string
  label: string
  value: string
}

function BarList({ rows }: { rows: BarRow[] }) {
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
              <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
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
