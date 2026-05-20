import React, { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
import { ConvertedHint } from '../../components/ConvertedHint'
import { formatMoney } from '../../lib/money'
import {
  amountClassName,
  amountPrefix,
  groupTransactionsByDay,
  type DayGroup,
} from '../../lib/transactions'

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
  const navigate = useNavigate()
  // URL = single source of truth for filters + pagination cursor.
  // Back/forward, refresh, and bookmarks all just work because the
  // page derives state from searchParams every render.
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useMemo<FilterState>(
    () => ({
      type: (searchParams.get('type') ?? '') as TransactionType | '',
      account_id: (searchParams.get('account_id') ?? '') as ID | '',
      category_id: (searchParams.get('category_id') ?? '') as ID | '',
      q: searchParams.get('q') ?? '',
      uncategorized: searchParams.get('uncategorized') === 'true',
      cursor_id: (searchParams.get('cursor_id') ?? undefined) as ID | undefined,
      cursor_at: searchParams.get('cursor_at') ?? undefined,
    }),
    [searchParams],
  )

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

  // Filter-change keys that should _replace_ the current history entry
  // instead of pushing a new one. Typing in the search box would
  // otherwise create one history entry per keystroke and make Back
  // useless — replace lets a whole word feel like a single step.
  const REPLACE_KEYS: ReadonlyArray<keyof FilterState> = ['q']

  function update<K extends keyof FilterState>(key: K, value: FilterState[K]) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        const stringified =
          typeof value === 'boolean' ? (value ? 'true' : '') : (value ?? '').toString()
        if (!stringified) {
          next.delete(key)
        } else {
          next.set(key, stringified)
        }
        // Any filter change resets pagination — keep the URL consistent.
        next.delete('cursor_id')
        next.delete('cursor_at')
        return next
      },
      { replace: REPLACE_KEYS.includes(key) },
    )
  }

  function nextPage() {
    const cursor = list.data?.next_cursor
    if (!cursor) return
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('cursor_id', cursor.id)
      next.set('cursor_at', cursor.occurred_at)
      return next
    })
  }

  function resetCursor() {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('cursor_id')
      next.delete('cursor_at')
      return next
    })
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

  // Transactions arrive sorted by occurred_at DESC, so a single linear
  // pass produces day-groups in DESC order. Recompute when the page
  // of rows changes.
  const groupedRows = useMemo<DayGroup[]>(
    () => groupTransactionsByDay(rows),
    [rows],
  )

  const pair = useMutation({
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

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => pair.mutate()}
            disabled={pair.isPending}
            className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-white disabled:opacity-60"
            title="Find income/expense pairs with same day, amount, currency on different accounts"
          >
            {pair.isPending ? 'Detecting…' : 'Detect transfers'}
          </button>
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

      {/* Mobile card list (below md) — grouped by day. The wide table
        below stays available on md+. */}
      <section className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {list.isPending && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">Loading…</p>
        )}
        {!list.isPending && rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-slate-500">
            No transactions match these filters.
          </p>
        )}
        {groupedRows.map((group) => (
          <div key={group.dayKey}>
            <div className="sticky top-12 z-10 px-4 py-2.5 bg-slate-100 border-y-2 border-slate-200 flex items-center justify-between shadow-sm">
              <span className="text-sm font-semibold text-slate-800 uppercase tracking-wide">
                {group.label}
              </span>
              <span className="text-xs font-medium text-slate-600 bg-white rounded-full px-2 py-0.5 tabular-nums">
                {group.items.length}
              </span>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.items.map((t) => {
                const account = accountById.get(t.account_id)
                const category = t.category_id
                  ? categoryById.get(t.category_id)
                  : null
                return (
                  <li
                    key={t.id}
                    onClick={() => navigate(`/transactions/${t.id}`)}
                    className="cursor-pointer hover:bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-800 truncate">
                          {t.description || t.merchant || '(unnamed)'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {account?.name ?? '—'}
                          {' · '}
                          {category?.name ?? 'Uncategorized'}
                        </p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p
                          className={
                            'text-sm font-medium tabular-nums ' +
                            amountClassName(t)
                          }
                        >
                          {amountPrefix(t)}
                          {formatMoney(t.amount, t.currency)}
                        </p>
                        <ConvertedHint amount={t.amount} currency={t.currency} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}

        <div className="flex items-center justify-between gap-2 p-3 border-t border-slate-100 text-sm">
          <button
            type="button"
            onClick={resetCursor}
            disabled={onFirstPage}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50 hover:bg-slate-50"
          >
            ← First
          </button>
          <button
            type="button"
            onClick={nextPage}
            disabled={!hasMore}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      </section>

      <section className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
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
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!list.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  No transactions match these filters.
                </td>
              </tr>
            )}
            {groupedRows.map((group) => (
              <React.Fragment key={group.dayKey}>
                <tr className="bg-slate-100 border-y-2 border-slate-200">
                  <td colSpan={5} className="px-4 py-2.5">
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
                  const account = accountById.get(t.account_id)
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
                        {account?.name ?? '—'}
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
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <Link
                          to={`/transactions/${t.id}/edit`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-slate-600 hover:underline mr-3"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(t.id)
                          }}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </React.Fragment>
            ))}
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
