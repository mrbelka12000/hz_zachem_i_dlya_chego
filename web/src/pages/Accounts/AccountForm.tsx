import { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { ApiError } from '../../api/client'
import type { AccountType } from '../../api/types'

const schema = z.object({
  name: z.string().min(1, 'Required').max(100),
  type: z.enum(['cash', 'card', 'bank', 'other', 'debt']),
  currency: z
    .string()
    .length(3, 'ISO 4217 currency code (3 letters)')
    .regex(/^[A-Za-z]{3}$/, 'Letters only'),
  // Negative values are allowed: debt accounts start negative when the
  // household owes money; any cash/card account could also be overdrawn.
  initial_balance: z
    .string()
    .min(1, 'Required')
    .regex(/^-?[0-9]+(\.[0-9]{1,2})?$/, 'Use up to 2 decimals'),
})

export type AccountFormValues = z.infer<typeof schema>

interface Props {
  mode: 'create' | 'edit'
  initial?: Partial<AccountFormValues>
  onSubmit: (payload: AccountFormValues) => Promise<unknown>
  submitLabel?: string
}

export function AccountForm({ mode, initial, onSubmit, submitLabel }: Props) {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AccountFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      type: (initial?.type as AccountType) ?? 'cash',
      currency: initial?.currency ?? 'KZT',
      initial_balance: initial?.initial_balance ?? '0',
    },
  })

  const handle: SubmitHandler<AccountFormValues> = async (values) => {
    setSubmitError(null)
    try {
      await onSubmit({
        ...values,
        currency: values.currency.toUpperCase(),
      })
      navigate('/accounts', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message)
        return
      }
      setSubmitError('Failed to save account')
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handle)}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-xl"
    >
      <h1 className="text-xl font-semibold">
        {mode === 'create' ? 'New account' : 'Edit account'}
      </h1>

      <Field label="Name" error={errors.name?.message}>
        <input
          {...register('name')}
          placeholder="e.g. Cash, Visa, Savings"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" error={errors.type?.message}>
          <select
            {...register('type')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="bank">Bank</option>
            <option value="debt">Debt (can be negative)</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Currency" error={errors.currency?.message}>
          <input
            {...register('currency')}
            maxLength={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase"
          />
        </Field>
      </div>

      <Field label="Initial balance" error={errors.initial_balance?.message}>
        <input
          inputMode="decimal"
          {...register('initial_balance')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
        />
      </Field>

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
          {isSubmitting ? 'Saving…' : (submitLabel ?? 'Save')}
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
