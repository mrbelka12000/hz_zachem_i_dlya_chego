import { type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './AuthProvider'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}
