import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { accountsApi } from '../../api/accounts'
import { categoriesApi } from '../../api/categories'
import { transactionsApi } from '../../api/transactions'
import type { Account, Category, ID, Transaction } from '../../api/types'
import { formatDateTime } from '../../lib/dates'
import { formatMoney } from '../../lib/money'

export function TransactionDetail() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const txQuery = useQuery<Transaction>({
    queryKey: ['transactions', 'one', id],
    queryFn: () => transactionsApi.get(id),
    enabled: Boolean(id),
  })

  const accountsQuery = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(true),
  })

  const categoriesQuery = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  if (txQuery.isPending) {
    return <p className="text-slate-500">Loading…</p>
  }
  if (txQuery.isError || !txQuery.data) {
    return (
      <p className="text-red-600">
        Could not load transaction:{' '}
        {(txQuery.error as Error | null)?.message ?? 'not found'}
      </p>
    )
  }

  const t = txQuery.data
  const accountById = byId(accountsQuery.data ?? [])
  const categoryById = byId(categoriesQuery.data ?? [])
  const account = accountById.get(t.account_id)
  const category = t.category_id ? categoryById.get(t.category_id) : null

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transaction</h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-white"
          >
            Back
          </button>
          <Link
            to={`/transactions/${t.id}/edit`}
            className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
          >
            Edit
          </Link>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs uppercase tracking-wide text-slate-500">{t.type}</p>
          <p
            className={
              'text-2xl font-semibold tabular-nums ' +
              (t.type === 'expense'
                ? 'text-red-600'
                : t.type === 'income'
                  ? 'text-green-700'
                  : 'text-slate-700')
            }
          >
            {t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}
            {formatMoney(t.amount, t.currency)}
          </p>
        </div>
        <h2 className="text-lg font-medium text-slate-800">
          {t.description || t.merchant || '(unnamed)'}
        </h2>

        <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-3 text-sm">
          <Field label="Account">{account?.name ?? '—'}</Field>
          <Field label="Currency">{t.currency}</Field>
          <Field label="Category">{category?.name ?? '—'}</Field>
          <Field label="Merchant">{t.merchant || '—'}</Field>
          <Field label="Source">{t.source}</Field>
          <Field label="Occurred">{formatDateTime(t.occurred_at)}</Field>
          <Field label="Created">{formatDateTime(t.created_at)}</Field>
          <Field label="Updated">{formatDateTime(t.updated_at)}</Field>
          {t.transfer_id && (
            <Field label="Transfer ID" mono>
              {t.transfer_id.slice(0, 8)}…
            </Field>
          )}
          {t.idempotency_key && (
            <Field label="Idempotency" mono>
              {t.idempotency_key.slice(0, 8)}…
            </Field>
          )}
          {t.external_hash && (
            <Field label="External hash" mono>
              {t.external_hash.slice(0, 12)}…
            </Field>
          )}
        </dl>
      </section>

      {t.counterpart && (
        <CounterpartCard t={t.counterpart} accountById={accountById} />
      )}

      {t.transfer_id && !t.counterpart && (
        <p className="text-sm text-slate-500 bg-slate-100 border border-slate-200 rounded-md px-3 py-2">
          This row is a transfer leg, but the matching counterpart is no longer
          available (deleted or out of the household).
        </p>
      )}

      {t.raw_payload && Object.keys(t.raw_payload as object).length > 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">
            Original CSV row
          </h3>
          <pre className="text-xs bg-slate-50 border border-slate-200 rounded p-3 overflow-x-auto">
            {JSON.stringify(t.raw_payload, null, 2)}
          </pre>
        </section>
      )}
    </div>
  )
}

function CounterpartCard({
  t,
  accountById,
}: {
  t: Transaction
  accountById: Map<ID, Account>
}) {
  const account = accountById.get(t.account_id)
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <header className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Transfer counterpart</h3>
        <Link
          to={`/transactions/${t.id}`}
          className="text-xs text-slate-500 hover:underline"
        >
          Open →
        </Link>
      </header>
      <div className="flex items-baseline justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-500">{t.type}</p>
        <p className="text-lg font-semibold tabular-nums text-slate-800">
          {formatMoney(t.amount, t.currency)}
        </p>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-3 gap-y-3 text-sm mt-3">
        <Field label="Account">{account?.name ?? '—'}</Field>
        <Field label="Occurred">{formatDateTime(t.occurred_at)}</Field>
        <Field label="Description">{t.description || '—'}</Field>
        <Field label="Merchant">{t.merchant || '—'}</Field>
      </dl>
    </section>
  )
}

function byId<T extends { id: ID }>(rows: T[]): Map<ID, T> {
  const map = new Map<ID, T>()
  for (const r of rows) map.set(r.id, r)
  return map
}

function Field({
  label,
  children,
  mono,
}: {
  label: string
  children: React.ReactNode
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={'text-slate-800 ' + (mono ? 'font-mono text-xs' : '')}>
        {children}
      </dd>
    </div>
  )
}
