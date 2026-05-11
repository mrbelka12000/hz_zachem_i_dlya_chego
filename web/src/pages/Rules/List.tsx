import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { categoriesApi } from '../../api/categories'
import { rulesApi, type CategorizationRule } from '../../api/rules'
import type { Category, ID } from '../../api/types'

interface RuleDraft {
  id?: ID
  name: string
  patterns: string
  category_id: ID | ''
  priority: number
  enabled: boolean
}

const emptyDraft: RuleDraft = {
  name: '',
  patterns: '',
  category_id: '',
  priority: 100,
  enabled: true,
}

function parsePatterns(input: string): string[] {
  return input
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
}

function ruleToDraft(r: CategorizationRule): RuleDraft {
  return {
    id: r.id,
    name: r.name,
    patterns: r.match_patterns.join(', '),
    category_id: r.category_id,
    priority: r.priority,
    enabled: r.enabled,
  }
}

export function RulesList() {
  const qc = useQueryClient()
  const [draft, setDraft] = useState<RuleDraft>(emptyDraft)
  const [formError, setFormError] = useState<string | null>(null)

  const rules = useQuery<CategorizationRule[]>({
    queryKey: ['rules'],
    queryFn: () => rulesApi.list(),
  })

  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const categoryName = useMemo(() => {
    const map = new Map<ID, string>()
    for (const c of categories.data ?? []) map.set(c.id, c.name)
    return map
  }, [categories.data])

  const create = useMutation({
    mutationFn: (payload: ReturnType<typeof draftToPayload>) => rulesApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      setDraft(emptyDraft)
      setFormError(null)
    },
  })

  const update = useMutation({
    mutationFn: ({ id, payload }: { id: ID; payload: ReturnType<typeof draftToPayload> }) =>
      rulesApi.update(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      setDraft(emptyDraft)
      setFormError(null)
    },
  })

  const remove = useMutation({
    mutationFn: (id: ID) => rulesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rules'] }),
  })

  const applyAll = useMutation({
    mutationFn: () => rulesApi.applyToUncategorized(),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['rules'] })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      alert(
        res.updated === 0
          ? 'No uncategorized transactions matched any rule.'
          : `Categorized ${res.updated} transaction${res.updated === 1 ? '' : 's'}.`,
      )
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const patterns = parsePatterns(draft.patterns)
    if (patterns.length === 0) {
      setFormError('At least one pattern is required (comma-separated).')
      return
    }
    if (!draft.category_id) {
      setFormError('Pick a category.')
      return
    }
    setFormError(null)
    const payload = draftToPayload({ ...draft, patterns: patterns.join(', ') })
    if (draft.id) {
      update.mutate({ id: draft.id, payload })
    } else {
      create.mutate(payload)
    }
  }

  async function onDelete(r: CategorizationRule) {
    if (!confirm(`Delete rule "${ruleLabel(r)}"?`)) return
    await remove.mutateAsync(r.id)
  }

  const submitting = create.isPending || update.isPending
  const editing = draft.id != null

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categorization rules</h1>
        <button
          type="button"
          onClick={() => applyAll.mutate()}
          disabled={applyAll.isPending}
          className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-white disabled:opacity-60"
          title="Re-run every rule against transactions that don't yet have a category"
        >
          {applyAll.isPending ? 'Applying…' : 'Apply to uncategorized'}
        </button>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Patterns (any)</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium text-right">Priority</th>
              <th className="px-4 py-2 font-medium">Enabled</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.isPending && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!rules.isPending && (rules.data ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No rules yet — add one below.
                </td>
              </tr>
            )}
            {(rules.data ?? []).map((r) => (
              <tr key={r.id} className={r.enabled ? '' : 'bg-slate-50/60'}>
                <td className="px-4 py-2 text-slate-800">
                  {r.name || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-2 text-slate-700">
                  <span className="flex flex-wrap gap-1">
                    {r.match_patterns.map((p) => (
                      <code
                        key={p}
                        className="bg-slate-100 text-slate-700 rounded px-1.5 py-0.5 text-xs"
                      >
                        {p}
                      </code>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {categoryName.get(r.category_id) ?? (
                    <span className="text-slate-400">deleted</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-slate-600">
                  {r.priority}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={
                      'inline-flex rounded-full px-2 py-0.5 text-xs ' +
                      (r.enabled
                        ? 'bg-green-100 text-green-800'
                        : 'bg-amber-100 text-amber-800')
                    }
                  >
                    {r.enabled ? 'on' : 'off'}
                  </span>
                </td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => setDraft(ruleToDraft(r))}
                    className="text-xs text-slate-600 hover:underline mr-3"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(r)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-xl">
        <h2 className="text-lg font-semibold">
          {editing ? 'Edit rule' : 'New rule'}
        </h2>
        <p className="text-sm text-slate-500">
          When a transaction has no category, the highest-priority enabled rule
          whose patterns appear (case-insensitive) in its merchant or
          description wins. Lower priority numbers win first.
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

          <Field label="Patterns (comma-separated)">
            <input
              value={draft.patterns}
              onChange={(e) => setDraft({ ...draft, patterns: e.target.value })}
              placeholder="restaurant, cafe, pizza"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">
              Matches substrings of merchant or description, case-insensitive.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={draft.category_id}
                onChange={(e) =>
                  setDraft({ ...draft, category_id: e.target.value as ID | '' })
                }
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">— pick —</option>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <input
                type="number"
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: Number(e.target.value) })
                }
                min={0}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
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
              {submitting ? 'Saving…' : editing ? 'Save changes' : 'Create rule'}
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

function draftToPayload(d: RuleDraft) {
  return {
    name: d.name.trim(),
    match_patterns: parsePatterns(d.patterns),
    category_id: d.category_id as ID,
    priority: d.priority,
    enabled: d.enabled,
  }
}

function ruleLabel(r: CategorizationRule): string {
  return r.name || r.match_patterns.join(', ')
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
