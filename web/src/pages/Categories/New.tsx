import { useQueryClient } from '@tanstack/react-query'

import { categoriesApi } from '../../api/categories'

import { CategoryForm, type CategoryFormValues } from './CategoryForm'

export function NewCategory() {
  const qc = useQueryClient()

  async function onSubmit(values: CategoryFormValues) {
    await categoriesApi.create({
      name: values.name,
      parent_id: values.parent_id ? values.parent_id : null,
      icon: values.icon ?? '',
      color: values.color ?? '',
    })
    qc.invalidateQueries({ queryKey: ['categories'] })
  }

  return <CategoryForm mode="create" onSubmit={onSubmit} submitLabel="Create" />
}
