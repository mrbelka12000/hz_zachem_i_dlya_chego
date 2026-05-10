import { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { accountsApi } from '../../api/accounts'
import { ApiError } from '../../api/client'
import { transactionsApi } from '../../api/transactions'
import type { Account } from '../../api/types'
import { isoToLocalInput, localInputToIso, nowIso } from '../../lib/dates'

const schema = z
  .object({
    from_account_id: z.string().uuid('Pick a source account'),
    to_account_id: z.string().uuid('Pick a destination account'),
    amount: z
      .string()
      .min(1, 'Required')
      .regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Use up to 2 decimals'),
    occurred_at: z.string().min(1),
    description: z.string().max(500).optional().or(z.literal('')),
  })
  .refine((v) => v.from_account_id !== v.to_account_id, {
    message: 'Source and destination must differ',
    path: ['to_account_id'],
  })

type FormValues = z.infer<typeof schema>

export function CreateTransfer() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const accounts = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(false),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      from_account_id: '',
      to_account_id: '',
      amount: '',
      occurred_at: isoToLocalInput(nowIso()),
      description: 'Transfer',
    },
  })

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    setSubmitError(null)
    try {
      await transactionsApi.transfer({
        from_account_id: values.from_account_id,
        to_account_id: values.to_account_id,
        amount: values.amount,
        occurred_at: localInputToIso(values.occurred_at),
        description: values.description?.trim() || undefined,
      })
      qc.invalidateQueries({ queryKey: ['transactions'] })
      qc.invalidateQueries({ queryKey: ['analytics'] })
      navigate('/transactions', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message)
        return
      }
      setSubmitError('Transfer failed')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-xl"
    >
      <h1 className="text-xl font-semibold">Transfer between accounts</h1>

      <Field label="From" error={errors.from_account_id?.message}>
        <select
          {...register('from_account_id')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {(accounts.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </Field>

      <Field label="To" error={errors.to_account_id?.message}>
        <select
          {...register('to_account_id')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select…</option>
          {(accounts.data ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" error={errors.amount?.message}>
          <input
            inputMode="decimal"
            placeholder="0.00"
            {...register('amount')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
        </Field>
        <Field label="Occurred at" error={errors.occurred_at?.message}>
          <input
            type="datetime-local"
            {...register('occurred_at')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <Field label="Description">
        <input
          {...register('description')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <p className="text-xs text-slate-500">
        Both accounts must use the same currency. Two paired transactions will be created.
      </p>

      {submitError && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {submitError}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? 'Saving…' : 'Create transfer'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
      {error && <span className="block text-xs text-red-600 mt-1">{error}</span>}
    </label>
  )
}
