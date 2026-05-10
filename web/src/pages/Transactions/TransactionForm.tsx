import { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { accountsApi } from '../../api/accounts'
import { categoriesApi } from '../../api/categories'
import { ApiError } from '../../api/client'
import type { Account, Category, ID, TransactionType } from '../../api/types'
import { isoToLocalInput, localInputToIso, nowIso } from '../../lib/dates'

const schema = z.object({
  account_id: z.string().uuid('Pick an account'),
  type: z.enum(['expense', 'income', 'adjustment']),
  amount: z
    .string()
    .min(1, 'Required')
    .regex(/^[0-9]+(\.[0-9]{1,2})?$/, 'Use up to 2 decimals'),
  occurred_at: z.string().min(1),
  description: z.string().max(500).optional().or(z.literal('')),
  merchant: z.string().max(200).optional().or(z.literal('')),
  category_id: z.string().uuid().optional().or(z.literal('')),
})

export type TransactionFormValues = z.infer<typeof schema>

export interface TransactionFormSubmit {
  account_id: ID
  type: TransactionType
  amount: string
  occurred_at: string
  description?: string
  merchant?: string
  category_id?: ID | null
}

interface Props {
  mode: 'create' | 'edit'
  initial?: Partial<TransactionFormValues>
  onSubmit: (payload: TransactionFormSubmit) => Promise<unknown>
  submitLabel?: string
}

export function TransactionForm({ mode, initial, onSubmit, submitLabel }: Props) {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const accounts = useQuery<Account[]>({
    queryKey: ['accounts'],
    queryFn: () => accountsApi.list(true),
  })
  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      account_id: initial?.account_id ?? '',
      type: (initial?.type as TransactionFormValues['type']) ?? 'expense',
      amount: initial?.amount ?? '',
      occurred_at: initial?.occurred_at ?? isoToLocalInput(nowIso()),
      description: initial?.description ?? '',
      merchant: initial?.merchant ?? '',
      category_id: initial?.category_id ?? '',
    },
  })

  const handle: SubmitHandler<TransactionFormValues> = async (values) => {
    setSubmitError(null)
    try {
      await onSubmit({
        account_id: values.account_id,
        type: values.type as TransactionType,
        amount: values.amount,
        occurred_at: localInputToIso(values.occurred_at),
        description: values.description?.trim() || undefined,
        merchant: values.merchant?.trim() || undefined,
        category_id: values.category_id ? values.category_id : null,
      })
      navigate('/transactions', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message)
        return
      }
      setSubmitError('Failed to save transaction')
    }
  }

  const activeAccounts = (accounts.data ?? []).filter(
    (a) => a.status === 'active' || a.id === initial?.account_id,
  )

  return (
    <form
      onSubmit={handleSubmit(handle)}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-xl"
    >
      <h1 className="text-xl font-semibold">
        {mode === 'create' ? 'New transaction' : 'Edit transaction'}
      </h1>

      <Field label="Account" error={errors.account_id?.message}>
        <select
          {...register('account_id')}
          disabled={mode === 'edit'}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
        >
          <option value="">Select…</option>
          {activeAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Type" error={errors.type?.message}>
          <select
            {...register('type')}
            disabled={mode === 'edit'}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          >
            <option value="expense">Expense</option>
            <option value="income">Income</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </Field>
        <Field label="Amount" error={errors.amount?.message}>
          <input
            inputMode="decimal"
            placeholder="0.00"
            {...register('amount')}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
        </Field>
      </div>

      <Field label="Occurred at" error={errors.occurred_at?.message}>
        <input
          type="datetime-local"
          {...register('occurred_at')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Description">
        <input
          {...register('description')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Merchant">
        <input
          {...register('merchant')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Category">
        <select
          {...register('category_id')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— Uncategorized —</option>
          {(categories.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
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
