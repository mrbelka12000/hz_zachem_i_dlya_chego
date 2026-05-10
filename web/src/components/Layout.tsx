import { type ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

import { authApi } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
] as const

export function Layout({ children }: LayoutProps) {
  const { me, invalidate } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    try {
      await authApi.logout()
    } finally {
      await invalidate()
      navigate('/login', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200">
          <p className="text-sm font-semibold tracking-tight">hz_zachem</p>
          <p className="text-xs text-slate-500 mt-0.5">budget</p>
        </div>
        <nav className="flex-1 p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                [
                  'block rounded-md px-3 py-2 text-sm font-medium transition',
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100',
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-200 space-y-2">
          <p className="text-xs text-slate-500 truncate" title={me?.user_id}>
            {me?.user_id?.slice(0, 8)}…
          </p>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-sm rounded-md border border-slate-300 px-3 py-1.5 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-8">
        <div className="max-w-6xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
