import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Decimal from 'decimal.js'

import { accountsApi, type AccountBalanceRow } from '../api/accounts'
import { analyticsApi } from '../api/analytics'
import { budgetsApi, type BudgetStatus } from '../api/budgets'
import { transactionsApi } from '../api/transactions'
import type {
  CashflowMonthRow,
  CategorySpendRow,
  Transaction,
} from '../api/types'
import { mergeRowsToKZT, sumToKZT } from '../lib/aggregations'
import { currentMonthRange, formatDate } from '../lib/dates'
import { formatMoney } from '../lib/money'
import { toKZT, useRates } from '../lib/rates'
import { amountClassName, amountPrefix } from '../lib/transactions'

export function Dashboard() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const range = useMemo(currentMonthRange, [])

  const byCategory = useQuery<CategorySpendRow[]>({
    queryKey: ['analytics', 'spending-by-category', range],
    queryFn: () => analyticsApi.spendingByCategory(range.from, range.to),
  })

  const cashflow = useQuery<CashflowMonthRow[]>({
    queryKey: ['analytics', 'cashflow-by-month', 2],
    queryFn: () => analyticsApi.cashflowByMonth(2),
  })

  const recent = useQuery({
    queryKey: ['transactions', 'recent'],
    queryFn: () => transactionsApi.list({ limit: 8 }),
  })

  const balances = useQuery<AccountBalanceRow[]>({
    queryKey: ['accounts', 'balances', { archived: true }],
    queryFn: () => accountsApi.balances(true),
  })

  const budgets = useQuery<BudgetStatus[]>({
    queryKey: ['budgets', 'status'],
    queryFn: () => budgetsApi.status(),
  })

  const detectTransfers = useMutation({
    mutationFn: () => transactionsApi.pairTransfers(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      alert(
        res.paired === 0
          ? 'No new transfer pairs detected.'
          : `Paired ${res.paired} transfer${res.paired === 1 ? '' : 's'}.`,
      )
    },
  })

  const rates = useRates()

  // Net worth signals.
  const assetsTotal = sumToKZT(
    (balances.data ?? []).filter((r) => !new Decimal(r.balance).isNegative()),
    (r) => r.balance,
    (r) => r.currency,
    rates,
  )
  const debtsTotal = sumToKZT(
    (balances.data ?? []).filter((r) => new Decimal(r.balance).isNegative()),
    (r) => new Decimal(r.balance).abs().toString(),
    (r) => r.currency,
    rates,
  )
  const netWorth = assetsTotal.minus(debtsTotal)

  // This-month cashflow (income / expense / net) from analytics rows.
  const monthExpenseTotal = sumToKZT(
    byCategory.data ?? [],
    (r) => r.total,
    (r) => r.currency,
    rates,
  )
  const cashflowByMonth = useMemo(
    () => foldCashflow(cashflow.data ?? [], rates),
    [cashflow.data, rates],
  )
  const thisMonth = cashflowByMonth[cashflowByMonth.length - 1]
  const lastMonth =
    cashflowByMonth.length >= 2
      ? cashflowByMonth[cashflowByMonth.length - 2]
      : undefined

  // Spent vs last month: percent change of this-month expense vs prior month.
  // Returns null when prior is zero (avoid divide-by-zero, surface as "—").
  const monthDelta = useMemo(() => {
    if (!lastMonth) return null
    const prev = new Decimal(lastMonth.expense || '0')
    if (prev.isZero()) return null
    const curr = new Decimal(thisMonth?.expense || '0')
    return curr.minus(prev).div(prev).times(100).toDecimalPlaces(0).toNumber()
  }, [thisMonth, lastMonth])

  // Uncategorized: surfaced as its own problem instead of mixing into
  // the category chart. category_id IS NULL on the backend rows.
  const uncategorizedRows = (byCategory.data ?? []).filter(
    (r) => r.category_id == null,
  )
  const categorizedRows = (byCategory.data ?? []).filter(
    (r) => r.category_id != null,
  )
  const uncategorizedKZT = sumToKZT(
    uncategorizedRows,
    (r) => r.total,
    (r) => r.currency,
    rates,
  )
  const uncategorizedCount = uncategorizedRows.reduce(
    (n, r) => n + Number(r.count || 0),
    0,
  )
  const uncategorizedShare = monthExpenseTotal.isZero()
    ? 0
    : Number(
        uncategorizedKZT
          .div(monthExpenseTotal)
          .times(100)
          .toDecimalPlaces(0)
          .toString(),
      )

  const categorizedSpending = mergeRowsToKZT(
    categorizedRows,
    (r) => r.category_id ?? r.category_name,
    (r) => r.category_name,
    (r) => r.total,
    (r) => r.currency,
    rates,
  )

  // Negative balance on a non-debt account = problem worth surfacing.
  // Debt-typed accounts are designed to be negative when you owe.
  const overdrawnAccounts = (balances.data ?? []).filter(
    (r) => r.type !== 'debt' && new Decimal(r.balance).isNegative(),
  )

  // Budgets sorted by risk: most at-risk first.
  const budgetsByRisk = useMemo(
    () =>
      (budgets.data ?? [])
        .filter((s) => s.budget.enabled)
        .slice()
        .sort((a, b) => b.percent - a.percent),
    [budgets.data],
  )
  const budgetsAtRisk = budgetsByRisk.filter((s) => s.percent >= 80)

  // Compact accounts list (top 5 by |KZT balance|) for the dashboard.
  const compactAccounts = useMemo(() => {
    const rows = (balances.data ?? []).slice()
    rows.sort((a, b) => {
      const aBal = Math.abs(Number(toKZT(a.balance, a.currency, rates) ?? '0'))
      const bBal = Math.abs(Number(toKZT(b.balance, b.currency, rates) ?? '0'))
      return bBal - aBal
    })
    return rows.slice(0, 5)
  }, [balances.data, rates])

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <Link
          to="/transactions/new"
          className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
        >
          Add transaction
        </Link>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          label="Net worth"
          value={formatMoney(netWorth.toString())}
          subtle={`Assets ${formatMoney(assetsTotal.toString())} · Debts ${formatMoney(debtsTotal.toString())}`}
          accent={netWorth.isNegative() ? 'text-red-600' : 'text-slate-900'}
          loading={balances.isPending}
        />
        <Kpi
          label="This month"
          value={formatMoney(thisMonth?.net ?? '0')}
          subtle={
            thisMonth
              ? `Income ${formatMoney(thisMonth.income)} · Expense ${formatMoney(thisMonth.expense)}`
              : '—'
          }
          accent={netToneFromString(thisMonth?.net)}
          loading={cashflow.isPending}
        />
        <Kpi
          label="Spent this month"
          value={formatMoney(monthExpenseTotal.toString())}
          subtle={
            monthDelta == null
              ? 'vs last month: —'
              : `vs last month: ${monthDelta > 0 ? '+' : ''}${monthDelta}%`
          }
          loading={byCategory.isPending}
        />
        <Kpi
          label="Needs review"
          value={
            uncategorizedCount === 0
              ? '0 uncategorized'
              : `${uncategorizedCount} uncategorized`
          }
          subtle={
            uncategorizedCount === 0
              ? 'All this month'
              : `${formatMoney(uncategorizedKZT.toString())} · ${uncategorizedShare}% of spend`
          }
          accent={uncategorizedShare >= 30 ? 'text-amber-700' : 'text-slate-900'}
          onClick={
            uncategorizedCount > 0
              ? () => navigate('/transactions?uncategorized=true')
              : undefined
          }
          loading={byCategory.isPending}
        />
      </section>

      <NeedsAttention
        uncategorizedShare={uncategorizedShare}
        uncategorizedKZT={uncategorizedKZT.toString()}
        budgetsAtRisk={budgetsAtRisk}
        overdrawnAccounts={overdrawnAccounts}
        netNegative={!!thisMonth && new Decimal(thisMonth.net || '0').isNegative()}
      />

      <QuickActions
        onDetectTransfers={() => detectTransfers.mutate()}
        detecting={detectTransfers.isPending}
        showReviewUncategorized={uncategorizedCount > 0}
      />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Categorized spending this month"
          actions={
            <Link to="/transactions" className="text-xs text-slate-500 hover:underline">
              View all
            </Link>
          }
        >
          {byCategory.isError && (
            <ErrorText>{(byCategory.error as Error).message}</ErrorText>
          )}
          {categorizedRows.length === 0 ? (
            <Empty>
              {uncategorizedCount > 0
                ? `No categorized expenses yet — ${uncategorizedCount} transactions need a category.`
                : 'No expenses recorded this month yet.'}
            </Empty>
          ) : (
            <BarList
              rows={categorizedSpending.map((r) => ({
                key: String(r.key),
                label: r.label,
                value: r.total,
              }))}
            />
          )}
        </Card>

        <Card
          title="Budget risk"
          actions={
            <Link to="/budgets" className="text-xs text-slate-500 hover:underline">
              Manage
            </Link>
          }
        >
          {(!budgets.data || budgets.data.length === 0) && (
            <Empty>
              No budgets yet — set one in{' '}
              <Link to="/budgets" className="underline">Budgets</Link> to start tracking.
            </Empty>
          )}
          {budgetsByRisk.length > 0 && <BudgetRiskList rows={budgetsByRisk.slice(0, 5)} />}
        </Card>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card
          title="Accounts"
          actions={
            <Link to="/accounts" className="text-xs text-slate-500 hover:underline">
              View all
            </Link>
          }
        >
          {balances.data && balances.data.length === 0 && (
            <Empty>No accounts yet — create one to start tracking.</Empty>
          )}
          {compactAccounts.length > 0 && <AccountBalances rows={compactAccounts} />}
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

function NeedsAttention({
  uncategorizedShare,
  uncategorizedKZT,
  budgetsAtRisk,
  overdrawnAccounts,
  netNegative,
}: {
  uncategorizedShare: number
  uncategorizedKZT: string
  budgetsAtRisk: BudgetStatus[]
  overdrawnAccounts: AccountBalanceRow[]
  netNegative: boolean
}) {
  const items: { tone: 'critical' | 'warning'; text: React.ReactNode }[] = []

  if (uncategorizedShare >= 30) {
    items.push({
      tone: 'warning',
      text: (
        <>
          {uncategorizedShare}% of this month's spending is{' '}
          <Link to="/transactions?uncategorized=true" className="underline">
            uncategorized
          </Link>{' '}
          ({formatMoney(uncategorizedKZT)})
        </>
      ),
    })
  }

  for (const s of budgetsAtRisk) {
    const name = s.budget.name || (s.budget.category_id ? 'Category budget' : 'Overall budget')
    items.push({
      tone: s.percent >= 100 ? 'critical' : 'warning',
      text: (
        <>
          <strong>{name}</strong> is at {s.percent}% — {formatMoney(s.spent, s.budget.currency)}{' '}
          / {formatMoney(s.budget.amount, s.budget.currency)}
        </>
      ),
    })
  }

  for (const a of overdrawnAccounts) {
    items.push({
      tone: 'critical',
      text: (
        <>
          <strong>{a.name}</strong> is overdrawn: {formatMoney(a.balance, a.currency)}
        </>
      ),
    })
  }

  if (netNegative) {
    items.push({
      tone: 'warning',
      text: <>You're spending more than you earn this month.</>,
    })
  }

  if (items.length === 0) return null

  return (
    <section className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
      <h2 className="text-sm font-semibold text-amber-900 mb-3">
        Needs attention
      </h2>
      <ul className="space-y-1.5 text-sm">
        {items.map((item, i) => (
          <li
            key={i}
            className={
              'flex items-start gap-2 ' +
              (item.tone === 'critical' ? 'text-red-800' : 'text-amber-900')
            }
          >
            <span aria-hidden className="mt-0.5">·</span>
            <span>{item.text}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function QuickActions({
  onDetectTransfers,
  detecting,
  showReviewUncategorized,
}: {
  onDetectTransfers: () => void
  detecting: boolean
  showReviewUncategorized: boolean
}) {
  return (
    <section className="flex flex-wrap gap-2">
      <Link
        to="/transactions/new"
        className="rounded-md border border-slate-300 bg-white text-sm px-3 py-1.5 hover:bg-slate-50"
      >
        Add expense
      </Link>
      <Link
        to="/transactions/transfer"
        className="rounded-md border border-slate-300 bg-white text-sm px-3 py-1.5 hover:bg-slate-50"
      >
        Transfer
      </Link>
      <Link
        to="/imports"
        className="rounded-md border border-slate-300 bg-white text-sm px-3 py-1.5 hover:bg-slate-50"
      >
        Import CSV
      </Link>
      {showReviewUncategorized && (
        <Link
          to="/transactions?uncategorized=true"
          className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm px-3 py-1.5 hover:bg-amber-100"
        >
          Review uncategorized
        </Link>
      )}
      <button
        type="button"
        onClick={onDetectTransfers}
        disabled={detecting}
        className="rounded-md border border-slate-300 bg-white text-sm px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
        title="Pair same-day, same-amount expense + income on different accounts as transfers"
      >
        {detecting ? 'Detecting…' : 'Detect transfers'}
      </button>
    </section>
  )
}

function BudgetRiskList({ rows }: { rows: BudgetStatus[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((s) => {
        const label =
          s.budget.name ||
          (s.budget.category_id ? 'Category budget' : 'Overall budget')
        const cappedPct = Math.min(100, s.percent)
        const overflowPct = s.percent > 100 ? Math.min(40, s.percent - 100) : 0
        const accent =
          s.percent >= 100
            ? 'bg-red-600'
            : s.percent >= 80
              ? 'bg-amber-500'
              : s.percent >= 50
                ? 'bg-slate-700'
                : 'bg-slate-400'
        return (
          <li key={s.budget.id}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="text-slate-800 truncate">{label}</span>
              <span className={'text-xs tabular-nums ' + budgetPctTone(s.percent)}>
                {s.percent}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
              <div className={'h-full ' + accent} style={{ width: `${cappedPct}%` }} />
              {overflowPct > 0 && (
                <div className="h-full bg-red-800" style={{ width: `${overflowPct}%` }} />
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 mt-1 tabular-nums">
              <span>
                {formatMoney(s.spent, s.budget.currency)} /{' '}
                {formatMoney(s.budget.amount, s.budget.currency)}
              </span>
              <span>{formatMoney(s.remaining, s.budget.currency)} left</span>
            </div>
          </li>
        )
      })}
    </ul>
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
  onClick,
}: {
  label: string
  value: string
  subtle?: string
  accent?: string
  loading?: boolean
  onClick?: () => void
}) {
  const className =
    'bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-left w-full' +
    (onClick ? ' cursor-pointer hover:bg-slate-50' : '')
  const Inner = (
    <>
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={
          'mt-1 text-xl md:text-2xl font-semibold tabular-nums ' +
          (accent ?? 'text-slate-900')
        }
      >
        {loading ? '…' : value}
      </p>
      {subtle && <p className="text-xs text-slate-500 mt-0.5">{subtle}</p>}
    </>
  )
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {Inner}
      </button>
    )
  }
  return <div className={className}>{Inner}</div>
}

function netToneFromString(net: string | undefined): string {
  if (!net) return 'text-slate-700'
  const d = new Decimal(net)
  if (d.isPositive() && !d.isZero()) return 'text-green-700'
  if (d.isNegative()) return 'text-red-600'
  return 'text-slate-700'
}

function budgetPctTone(pct: number): string {
  if (pct >= 100) return 'text-red-600'
  if (pct >= 80) return 'text-amber-700'
  return 'text-slate-500'
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
              <div className="h-full bg-slate-700" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

function AccountBalances({ rows }: { rows: AccountBalanceRow[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {rows.map((a) => {
        const archived = a.status === 'archived'
        const isNegative = new Decimal(a.balance).isNegative()
        const isOverdrawn = isNegative && a.type !== 'debt'
        const tone = isOverdrawn
          ? 'text-red-600'
          : isNegative
            ? 'text-slate-700'
            : 'text-slate-800'
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
            <span className={'tabular-nums font-medium ' + tone}>
              {formatMoney(a.balance, a.currency)}
            </span>
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
          <Link
            to={`/transactions/${t.id}`}
            className="min-w-0 flex flex-col hover:underline"
          >
            <span className="text-slate-800 truncate">
              {t.description || t.merchant || '(unnamed)'}
            </span>
            <span className="text-xs text-slate-500">{formatDate(t.occurred_at)}</span>
          </Link>
          <span className={'tabular-nums font-medium ' + amountClassName(t)}>
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
