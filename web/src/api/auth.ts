import { apiFetch } from './client'
import type { AuthResponse, MeResponse } from './types'

export interface RegisterPayload {
  email: string
  password: string
  household_name?: string
}

export interface LoginPayload {
  email: string
  password: string
}

export const authApi = {
  register: (payload: RegisterPayload) =>
    apiFetch<AuthResponse>('POST', '/v1/auth/register', { body: payload }),

  login: (payload: LoginPayload) =>
    apiFetch<AuthResponse>('POST', '/v1/auth/login', { body: payload }),

  logout: () => apiFetch<void>('POST', '/v1/auth/logout'),

  me: () => apiFetch<MeResponse>('GET', '/v1/me'),
}
