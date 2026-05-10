import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { accountsApi } from '../../api/accounts'
import { ApiError } from '../../api/client'
import { importsApi, type ImportSummary } from '../../api/imports'
import type { Account, ID } from '../../api/types'

export function CsvImport() {
  const qc = useQueryClient()

  const accounts = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(false),
  })

  const [accountId, setAccountId] = useState<ID | ''>('')
  const [file, setFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setSummary(null)
    if (!accountId || !file) {
      setError('Pick an account and a CSV file')
      return
    }
    setSubmitting(true)
    try {
      const result = await importsApi.uploadCsv(accountId, file)
      setSummary(result)
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold">Import transactions</h1>
        <p className="text-sm text-slate-600 mt-1">
          Upload a CSV with header{' '}
          <code className="bg-slate-100 px-1 rounded">Date,Amount,Name,Type</code>. Date{' '}
          <code className="bg-slate-100 px-1 rounded">dd/mm/yyyy</code>; signed Amount
          (− = expense, + = income); Name → merchant; Type → description. Re-uploads
          dedupe by content hash, so it's safe to retry.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-xl"
      >
        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">
            Destination account
          </span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value as ID | '')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Select…</option>
            {(accounts.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-sm font-medium text-slate-700 mb-1">CSV file</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm hover:file:bg-slate-100"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? 'Uploading…' : 'Import'}
          </button>
        </div>
      </form>

      {summary && <ImportResult summary={summary} />}
    </div>
  )
}

function ImportResult({ summary }: { summary: ImportSummary }) {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-3 max-w-xl">
      <h2 className="text-sm font-semibold text-slate-700">Result</h2>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
        <Stat label="Inserted" value={summary.inserted} accent="text-green-700" />
        <Stat label="Duplicates" value={summary.duplicates} accent="text-slate-600" />
        <Stat label="Paired" value={summary.paired} accent="text-slate-900" />
        <Stat
          label="Errors"
          value={summary.errors?.length ?? 0}
          accent="text-red-600"
        />
      </dl>
      {summary.errors && summary.errors.length > 0 && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2 max-h-40 overflow-y-auto">
          <ul className="space-y-1">
            {summary.errors.map((e) => (
              <li key={`${e.line}:${e.message}`}>
                line {e.line}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string
  value: number
  accent: string
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className={'text-2xl font-semibold tabular-nums ' + accent}>{value}</dd>
    </div>
  )
}
