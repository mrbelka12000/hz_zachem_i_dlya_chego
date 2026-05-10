import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { accountsApi } from '../../api/accounts'
import { categoriesApi } from '../../api/categories'
import { transactionsApi } from '../../api/transactions'
import type {
  Account,
  Category,
  ID,
  TransactionType,
  TransactionsListResponse,
} from '../../api/types'
import { formatDate } from '../../lib/dates'
import { formatMoney } from '../../lib/money'

interface FilterState {
  type: TransactionType | ''
  account_id: ID | ''
  category_id: ID | ''
  q: string
  uncategorized: boolean
  cursor_id?: ID
  cursor_at?: string
}

const PAGE_SIZE = 25

export function TransactionsList() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState<FilterState>({
    type: '',
    account_id: '',
    category_id: '',
    q: '',
    uncategorized: false,
  })

  const accounts = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(true),
  })

  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const accountById = useMemo(() => {
    const map = new Map<ID, Account>()
    for (const a of accounts.data ?? []) map.set(a.id, a)
    return map
  }, [accounts.data])

  const categoryById = useMemo(() => {
    const map = new Map<ID, Category>()
    for (const c of categories.data ?? []) map.set(c.id, c)
    return map
  }, [categories.data])

  const queryKey = ['transactions', filters] as const
  const list = useQuery<TransactionsListResponse>({
    queryKey,
    queryFn: () =>
      transactionsApi.list({
        limit: PAGE_SIZE,
        type: filters.type || undefined,
        account_id: filters.account_id || undefined,
        category_id: filters.category_id || undefined,
        q: filters.q || undefined,
        uncategorized: filters.uncategorized || undefined,
        cursor_id: filters.cursor_id,
        cursor_at: filters.cursor_at,
      }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: ID) => transactionsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
    },
  })

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      cursor_id: undefined,
      cursor_at: undefined,
    }))
  }

  function nextPage() {
    if (!list.data?.next_cursor) return
    setFilters((prev) => ({
      ...prev,
      cursor_id: list.data!.next_cursor!.id,
      cursor_at: list.data!.next_cursor!.occurred_at,
    }))
  }

  function resetCursor() {
    setFilters((prev) => ({ ...prev, cursor_id: undefined, cursor_at: undefined }))
  }

  async function onDelete(id: ID) {
    if (!confirm('Soft-delete this transaction? It will disappear from analytics and lists.')) {
      return
    }
    await deleteMutation.mutateAsync(id)
  }

  const rows = list.data?.transactions ?? []
  const hasMore = Boolean(list.data?.next_cursor)
  const onFirstPage = !filters.cursor_id

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex gap-2">
          <Link
            to="/transactions/transfer"
            className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-white"
          >
            Transfer
          </Link>
          <Link
            to="/transactions/new"
            className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
          >
            Add transaction
          </Link>
        </div>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Field label="Search">
            <input
              type="text"
              value={filters.q}
              onChange={(e) => update('q', e.target.value)}
              placeholder="merchant or description"
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="Type">
            <select
              value={filters.type}
              onChange={(e) => update('type', e.target.value as TransactionType | '')}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Any</option>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
              <option value="transfer">Transfer</option>
              <option value="adjustment">Adjustment</option>
            </select>
          </Field>
          <Field label="Account">
            <select
              value={filters.account_id}
              onChange={(e) => update('account_id', e.target.value as ID | '')}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Any</option>
              {(accounts.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.status === 'archived' ? ' (archived)' : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category">
            <select
              value={filters.category_id}
              onChange={(e) => update('category_id', e.target.value as ID | '')}
              disabled={filters.uncategorized}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm disabled:bg-slate-50"
            >
              <option value="">Any</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Uncategorized only">
            <label className="flex items-center gap-2 h-9 px-2">
              <input
                type="checkbox"
                checked={filters.uncategorized}
                onChange={(e) => update('uncategorized', e.target.checked)}
              />
              <span className="text-sm text-slate-700">Show only</span>
            </label>
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2 font-medium">Description</th>
              <th className="px-4 py-2 font-medium">Account</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.isPending && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!list.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No transactions match these filters.
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const account = accountById.get(t.account_id)
              const category = t.category_id ? categoryById.get(t.category_id) : null
              return (
                <tr key={t.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                    {formatDate(t.occurred_at)}
                  </td>
                  <td className="px-4 py-2 min-w-0">
                    <div className="flex flex-col">
                      <span className="text-slate-800">
                        {t.description || t.merchant || '(unnamed)'}
                      </span>
                      <span className="text-xs text-slate-500">{t.type}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{account?.name ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {category?.name ?? <span className="text-slate-400">—</span>}
                  </td>
                  <td
                    className={
                      'px-4 py-2 text-right font-medium tabular-nums ' +
                      (t.type === 'expense'
                        ? 'text-red-600'
                        : t.type === 'income'
                          ? 'text-green-700'
                          : 'text-slate-700')
                    }
                  >
                    {t.type === 'expense' ? '−' : t.type === 'income' ? '+' : ''}
                    {formatMoney(t.amount, t.currency)}
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Link
                      to={`/transactions/${t.id}/edit`}
                      className="text-xs text-slate-600 hover:underline mr-3"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => onDelete(t.id)}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="flex items-center justify-between p-3 border-t border-slate-100 text-sm">
          <button
            type="button"
            onClick={resetCursor}
            disabled={onFirstPage}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50 hover:bg-slate-50"
          >
            ← First page
          </button>
          <button
            type="button"
            onClick={nextPage}
            disabled={!hasMore}
            className="rounded-md border border-slate-300 px-3 py-1 disabled:opacity-50 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      </section>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  )
}
