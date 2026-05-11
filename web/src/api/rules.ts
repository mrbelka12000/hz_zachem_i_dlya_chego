import { apiFetch } from './client'
import type { ID } from './types'

export interface CategorizationRule {
  id: ID
  household_id: ID
  name: string
  match_patterns: string[]
  category_id: ID
  priority: number
  enabled: boolean
  created_by: ID
  created_at: string
  updated_at: string
  deleted_at?: string | null
  deleted_by?: ID | null
}

export interface RulePayload {
  name: string
  match_patterns: string[]
  category_id: ID
  priority: number
  enabled: boolean
}

interface ListResponse {
  rules: CategorizationRule[]
}

interface ApplyResponse {
  updated: number
}

export const rulesApi = {
  list: () =>
    apiFetch<ListResponse>('GET', '/v1/categorization-rules').then((r) => r.rules),

  get: (id: ID) =>
    apiFetch<CategorizationRule>('GET', `/v1/categorization-rules/${id}`),

  create: (payload: RulePayload) =>
    apiFetch<CategorizationRule>('POST', '/v1/categorization-rules', {
      body: payload,
    }),

  update: (id: ID, payload: RulePayload) =>
    apiFetch<CategorizationRule>('PUT', `/v1/categorization-rules/${id}`, {
      body: payload,
    }),

  remove: (id: ID) =>
    apiFetch<void>('DELETE', `/v1/categorization-rules/${id}`),

  applyToUncategorized: () =>
    apiFetch<ApplyResponse>('POST', '/v1/categorization-rules/apply'),
}
