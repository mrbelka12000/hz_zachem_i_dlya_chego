import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Decimal from 'decimal.js'

import { accountsApi, type AccountBalanceRow } from '../../api/accounts'
import type { Account, ID, Money } from '../../api/types'
import { ConvertedHint } from '../../components/ConvertedHint'
import { formatMoney } from '../../lib/money'

export function AccountsList() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  const accounts = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(true),
  })

  const balances = useQuery<AccountBalanceRow[]>({
    queryKey: ['accounts', 'balances', { archived: true }],
    queryFn: () => accountsApi.balances(true),
  })

  const balanceById = useMemo(() => {
    const m = new Map<ID, Money>()
    for (const r of balances.data ?? []) m.set(r.account_id, r.balance)
    return m
  }, [balances.data])

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

      {/* Mobile card list (below md) — phone-friendly single-column
        layout. The wide table is preserved for md+. */}
      <section className="md:hidden bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <ul className="divide-y divide-slate-100">
          {accounts.isPending && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              Loading…
            </li>
          )}
          {!accounts.isPending && rows.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-slate-500">
              No accounts yet — create one to start tracking.
            </li>
          )}
          {rows.map((a) => {
            const archived = a.status === 'archived'
            const balance = balanceById.get(a.id)
            return (
              <li
                key={a.id}
                onClick={() => navigate(`/accounts/${a.id}`)}
                className={
                  'cursor-pointer hover:bg-slate-50 px-4 py-3 ' +
                  (archived ? 'bg-slate-50/60' : '')
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800 truncate">{a.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate capitalize">
                      {a.type} · {a.currency} ·{' '}
                      <span
                        className={
                          archived ? 'text-amber-700' : 'text-green-700'
                        }
                      >
                        {archived ? 'archived' : 'active'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    {balance != null ? (
                      <p
                        className={
                          'text-sm font-medium tabular-nums ' +
                          currentBalanceAccent(balance)
                        }
                      >
                        {formatMoney(balance, a.currency)}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-400">
                        {balances.isPending ? '…' : '—'}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Currency</th>
              <th className="px-4 py-2 font-medium text-right">Current balance</th>
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
                  <td
                    className={
                      'px-4 py-2 text-right tabular-nums font-medium ' +
                      currentBalanceAccent(balanceById.get(a.id))
                    }
                  >
                    {balances.isPending && !balanceById.has(a.id) ? (
                      <span className="text-slate-400">…</span>
                    ) : balanceById.has(a.id) ? (
                      <>
                        {formatMoney(balanceById.get(a.id)!, a.currency)}
                        <ConvertedHint
                          amount={balanceById.get(a.id)!}
                          currency={a.currency}
                        />
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
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

function currentBalanceAccent(balance: Money | undefined): string {
  if (!balance) return 'text-slate-700'
  const d = new Decimal(balance)
  if (d.isNegative()) return 'text-red-600'
  if (d.isZero()) return 'text-slate-500'
  return 'text-slate-800'
}
