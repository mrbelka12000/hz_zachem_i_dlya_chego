import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import type { MeResponse } from '../api/types'

interface AuthContextValue {
  me: MeResponse | undefined
  isLoading: boolean
  isAuthenticated: boolean
  refresh: () => Promise<unknown>
  invalidate: () => Promise<unknown>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()

  const meQuery = useQuery<MeResponse, ApiError>({
    queryKey: ['me'],
    queryFn: authApi.me,
    retry: (failureCount, error) => {
      if (error instanceof ApiError && error.status === 401) return false
      return failureCount < 1
    },
    staleTime: 60_000,
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      me: meQuery.data,
      isLoading: meQuery.isPending,
      isAuthenticated: meQuery.isSuccess,
      refresh: () => meQuery.refetch(),
      invalidate: () => qc.invalidateQueries({ queryKey: ['me'] }),
    }),
    [meQuery.data, meQuery.isPending, meQuery.isSuccess, meQuery, qc],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
