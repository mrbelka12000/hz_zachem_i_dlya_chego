import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Decimal from 'decimal.js'

import { budgetsApi, type Budget, type BudgetStatus } from '../../api/budgets'
import { categoriesApi } from '../../api/categories'
import type { Category, ID } from '../../api/types'
import { formatMoney } from '../../lib/money'

interface BudgetDraft {
  id?: ID
  name: string
  category_id: ID | ''
  amount: string
  currency: string
  enabled: boolean
}

const emptyDraft: BudgetDraft = {
  name: '',
  category_id: '',
  amount: '',
  currency: 'KZT',
  enabled: true,
}

function budgetToDraft(b: Budget): BudgetDraft {
  return {
    id: b.id,
    name: b.name,
    category_id: b.category_id ?? '',
    amount: b.amount,
    currency: b.currency,
    enabled: b.enabled,
  }
}

function payloadFromDraft(d: BudgetDraft) {
  return {
    name: d.name.trim(),
    category_id: (d.category_id || null) as ID | null,
    amount: d.amount.trim(),
    currency: d.currency.toUpperCase(),
    enabled: d.enabled,
  }
}

export function BudgetsList() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<BudgetDraft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)

  const statuses = useQuery<BudgetStatus[]>({
    queryKey: ['budgets', 'status'],
    queryFn: () => budgetsApi.status(),
  })

  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categoryName = useMemo(() => {
    const m = new Map<ID, string>()
    for (const c of categories.data ?? []) m.set(c.id, c.name)
    return m
  }, [categories.data])

  const create = useMutation({
    mutationFn: budgetsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      setDraft(emptyDraft)
      setFormError(null)
    },
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: ID; payload: ReturnType<typeof payloadFromDraft> }) =>
      budgetsApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      setDraft(emptyDraft)
      setFormError(null)
    },
  })

  const remove = useMutation({
    mutationFn: (id: ID) => budgetsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['budgets'] }),
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!draft.amount || !/^[0-9]+(\.[0-9]{1,2})?$/.test(draft.amount.trim())) {
      setFormError('Amount must be a positive number with up to 2 decimals.')
      return
    }
    if (draft.currency.length !== 3) {
      setFormError('Currency must be a 3-letter ISO code.')
      return
    }
    setFormError(null)
    const payload = payloadFromDraft(draft)
    if (draft.id) update.mutate({ id: draft.id, payload })
    else create.mutate(payload)
  }

  async function onDelete(b: Budget) {
    if (!confirm(`Delete budget "${b.name || labelFor(b, categoryName)}"?`)) return
    await remove.mutateAsync(b.id)
  }

  const editing = draft.id != null
  const submitting = create.isPending || update.isPending

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets</h1>
      </header>

      <section className="space-y-3">
        {statuses.isPending && <p className="text-slate-500 text-sm">Loading…</p>}
        {statuses.data && statuses.data.length === 0 && (
          <p className="text-slate-500 text-sm">
            No budgets yet — add one below to start tracking monthly spending.
          </p>
        )}
        {(statuses.data ?? []).map((s) => (
          <BudgetCard
            key={s.budget.id}
            status={s}
            categoryName={categoryName}
            onEdit={() => setDraft(budgetToDraft(s.budget))}
            onDelete={() => onDelete(s.budget)}
          />
        ))}
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-xl">
        <h2 className="text-lg font-semibold">
          {editing ? 'Edit budget' : 'New budget'}
        </h2>
        <p className="text-sm text-slate-500">
          A monthly spending cap, either overall (no category) or scoped to
          one category. You'll get a Telegram message when 50%, 80% and 100%
          of the cap are reached in the current calendar month. Link your chat
          in Settings.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Name (optional)">
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="e.g. Eating out"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>

          <Field label="Category">
            <select
              value={draft.category_id}
              onChange={(e) => setDraft({ ...draft, category_id: e.target.value as ID | '' })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Overall (all expenses)</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <input
                inputMode="decimal"
                value={draft.amount}
                onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                placeholder="100000"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </Field>
            <Field label="Currency">
              <input
                value={draft.currency}
                maxLength={3}
                onChange={(e) => setDraft({ ...draft, currency: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
            />
            Enabled
          </label>

          {formError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            {editing && (
              <button
                type="button"
                onClick={() => setDraft(emptyDraft)}
                className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create budget'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function BudgetCard({
  status,
  categoryName,
  onEdit,
  onDelete,
}: {
  status: BudgetStatus
  categoryName: Map<ID, string>
  onEdit: () => void
  onDelete: () => void
}) {
  const b = status.budget
  const label = labelFor(b, categoryName)
  const pct = Math.min(100, status.percent)
  const overflowPct = status.percent > 100 ? Math.min(40, status.percent - 100) : 0
  const accent =
    status.percent >= 100
      ? 'bg-red-600'
      : status.percent >= 80
        ? 'bg-amber-500'
        : 'bg-slate-900'
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{label}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {b.enabled ? 'monthly' : 'disabled'} · {b.currency}
          </p>
        </div>
        <div className="text-right whitespace-nowrap">
          <p className="text-sm tabular-nums text-slate-800">
            {formatMoney(status.spent, b.currency)} / {formatMoney(b.amount, b.currency)}
          </p>
          <p className={'text-xs tabular-nums ' + remainingTone(status.remaining)}>
            {formatMoney(status.remaining, b.currency)} left
          </p>
        </div>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
        <div className={'h-full ' + accent} style={{ width: `${pct}%` }} />
        {overflowPct > 0 && (
          <div className="h-full bg-red-800" style={{ width: `${overflowPct}%` }} />
        )}
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <span className={'tabular-nums ' + pctTone(status.percent)}>
          {status.percent}%
        </span>
        <span className="text-right whitespace-nowrap">
          <button
            type="button"
            onClick={onEdit}
            className="text-slate-600 hover:underline mr-3"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="text-red-600 hover:underline"
          >
            Delete
          </button>
        </span>
      </div>
    </div>
  )
}

function labelFor(b: Budget, names: Map<ID, string>): string {
  if (b.name) return b.name
  if (b.category_id) return names.get(b.category_id) ?? 'Category budget'
  return 'Overall'
}

function remainingTone(remaining: string): string {
  try {
    const d = new Decimal(remaining)
    if (d.isNegative()) return 'text-red-600'
    if (d.isZero()) return 'text-amber-700'
    return 'text-slate-500'
  } catch {
    return 'text-slate-500'
  }
}

function pctTone(pct: number): string {
  if (pct >= 100) return 'text-red-600'
  if (pct >= 80) return 'text-amber-700'
  return 'text-slate-500'
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  )
}
