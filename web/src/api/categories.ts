import { apiFetch } from './client'
import type { Category, ID } from './types'

export interface CategoryPayload {
  name: string
  parent_id?: ID | null
  icon?: string
  color?: string
}

interface ListCategoriesResponse {
  categories: Category[]
}

export const categoriesApi = {
  list: () =>
    apiFetch<ListCategoriesResponse>('GET', '/v1/categories').then((r) => r.categories),

  get: (id: ID) => apiFetch<Category>('GET', `/v1/categories/${id}`),

  create: (payload: CategoryPayload) =>
    apiFetch<Category>('POST', '/v1/categories', { body: payload }),

  update: (id: ID, payload: CategoryPayload) =>
    apiFetch<Category>('PUT', `/v1/categories/${id}`, { body: payload }),

  remove: (id: ID) => apiFetch<void>('DELETE', `/v1/categories/${id}`),
}
