import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { categoriesApi } from '../../api/categories'
import type { Category, ID } from '../../api/types'

interface Node extends Category {
  depth: number
}

function flattenTree(rows: Category[]): Node[] {
  const byParent = new Map<ID | null, Category[]>()
  for (const c of rows) {
    const key = c.parent_id ?? null
    const list = byParent.get(key) ?? []
    list.push(c)
    byParent.set(key, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name))
  }
  const out: Node[] = []
  function walk(parentId: ID | null, depth: number) {
    const list = byParent.get(parentId) ?? []
    for (const c of list) {
      out.push({ ...c, depth })
      walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
}

export function CategoriesList() {
  const qc = useQueryClient()

  const list = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const remove = useMutation({
    mutationFn: (id: ID) => categoriesApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const tree = useMemo(() => flattenTree(list.data ?? []), [list.data])

  async function onDelete(c: Category) {
    if (
      !confirm(
        `Soft-delete category "${c.name}"? Existing transactions become Uncategorized.`,
      )
    ) {
      return
    }
    await remove.mutateAsync(c.id)
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Categories</h1>
        <Link
          to="/categories/new"
          className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
        >
          New category
        </Link>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {list.isPending && (
            <li className="px-4 py-6 text-center text-slate-500">Loading…</li>
          )}
          {!list.isPending && tree.length === 0 && (
            <li className="px-4 py-6 text-center text-slate-500">
              No categories yet — add one to start grouping spend.
            </li>
          )}
          {tree.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between px-4 py-2 text-sm"
            >
              <div
                className="flex items-center gap-2 min-w-0"
                style={{ paddingLeft: `${c.depth * 1.25}rem` }}
              >
                {c.icon && <span aria-hidden>{c.icon}</span>}
                <span
                  className="inline-block w-2 h-2 rounded-full"
                  style={{
                    background: c.color || (c.depth === 0 ? '#0f172a' : '#94a3b8'),
                  }}
                />
                <span className="text-slate-800 truncate">{c.name}</span>
              </div>
              <div className="whitespace-nowrap">
                <Link
                  to={`/categories/${c.id}/edit`}
                  className="text-xs text-slate-600 hover:underline mr-3"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(c)}
                  className="text-xs text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
