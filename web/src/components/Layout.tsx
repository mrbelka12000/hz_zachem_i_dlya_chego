import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'

import { authApi } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/transactions', label: 'Transactions' },
  { to: '/accounts', label: 'Accounts' },
  { to: '/categories', label: 'Categories' },
  { to: '/rules', label: 'Rules' },
  { to: '/budgets', label: 'Budgets' },
  { to: '/imports', label: 'Import' },
  { to: '/settings', label: 'Settings' },
] as const

export function Layout({ children }: LayoutProps) {
  const { me, invalidate } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Auto-close the mobile drawer on route change so the user sees the
  // new page immediately. Also close on Escape.
  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  async function onLogout() {
    try {
      await authApi.logout()
    } finally {
      await invalidate()
      navigate('/login', { replace: true })
    }
  }

  const currentLabel =
    navItems.find((item) =>
      item.to === '/'
        ? location.pathname === '/'
        : location.pathname.startsWith(item.to),
    )?.label ?? 'hz_zachem'

  return (
    <div className="h-screen flex overflow-hidden bg-slate-50 text-slate-900">
      {/* Mobile top bar — visible below md. The hamburger reveals the
        same sidebar content as a slide-in drawer. */}
      <header
        className="md:hidden fixed top-0 inset-x-0 z-30 h-12 bg-white border-b border-slate-200 flex items-center justify-between px-3"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          aria-controls="primary-nav"
          aria-expanded={drawerOpen}
          className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-slate-100 -ml-2"
        >
          <MenuIcon />
        </button>
        <p className="text-sm font-semibold tracking-tight truncate">
          {currentLabel}
        </p>
        <button
          type="button"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          className="h-10 w-10 flex items-center justify-center rounded-md hover:bg-slate-100 -mr-2"
        >
          <ThemeIcon dark={theme === 'dark'} />
        </button>
      </header>

      {/* Drawer scrim — only rendered when open. md:hidden so it never
        appears on desktop. */}
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/40"
        />
      )}

      {/* Sidebar.
          - Below md: positioned fixed; slides in/out via translate-x.
          - md+:     in normal flex flow.
          The same markup serves both — no duplication. */}
      <aside
        id="primary-nav"
        className={
          'w-64 md:w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col ' +
          'fixed md:static inset-y-0 left-0 z-40 h-full transform transition-transform duration-200 ease-out ' +
          (drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0')
        }
      >
        <div
          className="px-5 py-4 border-b border-slate-200 flex items-center justify-between"
          style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">hz_zachem</p>
            <p className="text-xs text-slate-500 mt-0.5">budget</p>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close navigation"
            className="md:hidden h-9 w-9 flex items-center justify-center rounded-md hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto p-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              className={({ isActive }) =>
                [
                  'block rounded-md px-3 py-2.5 text-sm font-medium transition',
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
        <div
          className="p-3 border-t border-slate-200 space-y-2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
        >
          <p className="text-xs text-slate-500 truncate" title={me?.user_id}>
            {me?.user_id?.slice(0, 8)}…
          </p>
          <button
            type="button"
            onClick={toggle}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="w-full flex items-center justify-between text-sm rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100"
          >
            <span>Theme</span>
            <span className="text-slate-500 capitalize">{theme}</span>
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-full text-sm rounded-md border border-slate-300 px-3 py-2 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main
        className="flex-1 min-w-0 h-full overflow-y-auto pt-12 md:pt-0 px-4 sm:px-6 md:px-8 pb-6 md:pb-8"
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)',
        }}
      >
        <div className="max-w-6xl mx-auto pt-4 md:pt-8">{children}</div>
      </main>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function ThemeIcon({ dark }: { dark: boolean }) {
  if (dark) {
    return (
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
      </svg>
    )
  }
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}
