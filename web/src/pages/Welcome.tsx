import { useQuery } from '@tanstack/react-query'

interface HealthResponse {
  status: string
}

async function fetchHealth(): Promise<HealthResponse> {
  const res = await fetch('/healthz', { credentials: 'include' })
  if (!res.ok) {
    throw new Error(`healthz returned ${res.status}`)
  }
  return (await res.json()) as HealthResponse
}

export function Welcome() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: ['healthz'],
    queryFn: fetchHealth,
    refetchOnWindowFocus: false,
  })

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow border border-slate-200 p-8 space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">hz_zachem</h1>
          <p className="text-slate-600">Phase 1 budget app — frontend bootstrap.</p>
        </div>

        <div className="text-sm">
          <p className="font-medium text-slate-700 mb-1">Backend status</p>
          {isPending && <p className="text-slate-500">checking /healthz…</p>}
          {isError && (
            <p className="text-red-600">unreachable: {(error as Error).message}</p>
          )}
          {data && <p className="text-green-700">{data.status}</p>}
        </div>

        <p className="text-xs text-slate-400 pt-2 border-t border-slate-100">
          Phase W2 will add auth, dashboard, transactions.
        </p>
      </div>
    </main>
  )
}
