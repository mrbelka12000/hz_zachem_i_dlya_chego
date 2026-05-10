import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { categoriesApi } from '../../api/categories'
import type { Category } from '../../api/types'

import { CategoryForm, type CategoryFormValues } from './CategoryForm'

export function EditCategory() {
  const { id = '' } = useParams<{ id: string }>()
  const qc = useQueryClient()

  const catQuery = useQuery<Category>({
    queryKey: ['categories', 'one', id],
    queryFn: () => categoriesApi.get(id),
    enabled: Boolean(id),
  })

  if (catQuery.isPending) {
    return <p className="text-slate-500">Loading…</p>
  }
  if (catQuery.isError || !catQuery.data) {
    return (
      <p className="text-red-600">
        Could not load category:{' '}
        {(catQuery.error as Error | null)?.message ?? 'not found'}
      </p>
    )
  }

  const c = catQuery.data

  async function onSubmit(values: CategoryFormValues) {
    await categoriesApi.update(id, {
      name: values.name,
      parent_id: values.parent_id ? values.parent_id : null,
      icon: values.icon ?? '',
      color: values.color ?? '',
    })
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  return (
    <CategoryForm
      mode="edit"
      selfId={c.id}
      onSubmit={onSubmit}
      submitLabel="Save changes"
      initial={{
        name: c.name,
        parent_id: c.parent_id ?? '',
        icon: c.icon,
        color: c.color,
      }}
    />
  )
}
