import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { accountsApi } from '../../api/accounts'
import type { Account, ID } from '../../api/types'
import { ConvertedHint } from '../../components/ConvertedHint'
import { formatMoney } from '../../lib/money'

export function AccountsList() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const accounts = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(true),
  })

  const archive = useMutation({
    mutationFn: (id: ID) => accountsApi.archive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const unarchive = useMutation({
    mutationFn: (id: ID) => accountsApi.unarchive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  const remove = useMutation({
    mutationFn: (id: ID) => accountsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['accounts'] }),
  })

  async function onDelete(a: Account) {
    if (
      !confirm(
        `Soft-delete account "${a.name}"? Existing transactions stay in the database.`,
      )
    ) {
      return
    }
    await remove.mutateAsync(a.id)
  }

  const rows = accounts.data ?? []

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
        <Link
          to="/accounts/new"
          className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800"
        >
          New account
        </Link>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Currency</th>
              <th className="px-4 py-2 font-medium text-right">Initial balance</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.isPending && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!accounts.isPending && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center text-slate-500">
                  No accounts yet — create one to start tracking.
                </td>
              </tr>
            )}
            {rows.map((a) => {
              const archived = a.status === 'archived'
              return (
                <tr
                  key={a.id}
                  onClick={() => navigate(`/accounts/${a.id}`)}
                  className={
                    'cursor-pointer hover:bg-slate-50 ' +
                    (archived ? 'bg-slate-50/60' : '')
                  }
                >
                  <td className="px-4 py-2 text-slate-800">{a.name}</td>
                  <td className="px-4 py-2 text-slate-600 capitalize">{a.type}</td>
                  <td className="px-4 py-2 text-slate-600">{a.currency}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatMoney(a.initial_balance, a.currency)}
                    <ConvertedHint amount={a.initial_balance} currency={a.currency} />
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={
                        'inline-flex rounded-full px-2 py-0.5 text-xs ' +
                        (archived
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800')
                      }
                    >
                      {archived ? 'archived' : 'active'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    <Link
                      to={`/accounts/${a.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-slate-600 hover:underline mr-3"
                    >
                      Edit
                    </Link>
                    {archived ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          unarchive.mutate(a.id)
                        }}
                        className="text-xs text-slate-600 hover:underline mr-3"
                      >
                        Unarchive
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          archive.mutate(a.id)
                        }}
                        className="text-xs text-slate-600 hover:underline mr-3"
                      >
                        Archive
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(a)
                      }}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}
