import { useNavigate } from 'react-router-dom'

import { authApi } from '../api/auth'
import { useAuth } from '../auth/AuthProvider'

export function Dashboard() {
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
    <main className="min-h-screen p-8 bg-slate-50">
      <div className="max-w-3xl mx-auto space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <button
            type="button"
            onClick={onLogout}
            className="text-sm rounded-md border border-slate-300 px-3 py-1.5 hover:bg-white"
          >
            Sign out
          </button>
        </header>

        <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-2">
          <p className="text-sm text-slate-500">Signed in as</p>
          <p className="font-mono text-sm text-slate-800 break-all">{me?.user_id}</p>
          <p className="text-sm text-slate-500 mt-3">Household</p>
          <p className="font-mono text-sm text-slate-800 break-all">
            {me?.household_ids[0] ?? 'no household'}
          </p>
        </section>

        <p className="text-sm text-slate-400">
          Phase W3 will replace this stub with real spending charts and recent transactions.
        </p>
      </div>
    </main>
  )
}
