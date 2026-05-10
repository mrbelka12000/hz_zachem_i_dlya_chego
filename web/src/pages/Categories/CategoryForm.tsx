import { useState } from 'react'
import { useForm, type SubmitHandler } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { categoriesApi } from '../../api/categories'
import { ApiError } from '../../api/client'
import type { Category, ID } from '../../api/types'

const schema = z.object({
  name: z.string().min(1, 'Required').max(100),
  parent_id: z.string().uuid().optional().or(z.literal('')),
  icon: z.string().max(50).optional().or(z.literal('')),
  color: z
    .string()
    .max(20)
    .regex(/^(|#?[A-Fa-f0-9]{3,8})$/, 'Use hex like #aabbcc')
    .optional()
    .or(z.literal('')),
})

export type CategoryFormValues = z.infer<typeof schema>

interface Props {
  mode: 'create' | 'edit'
  /** When editing, exclude this id (and its descendants) from parent picker. */
  selfId?: ID
  initial?: Partial<CategoryFormValues>
  onSubmit: (payload: CategoryFormValues) => Promise<unknown>
  submitLabel?: string
}

export function CategoryForm({ mode, selfId, initial, onSubmit, submitLabel }: Props) {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const categories = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list(),
  })

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? '',
      parent_id: initial?.parent_id ?? '',
      icon: initial?.icon ?? '',
      color: initial?.color ?? '',
    },
  })

  const handle: SubmitHandler<CategoryFormValues> = async (values) => {
    setSubmitError(null)
    try {
      await onSubmit({
        ...values,
        parent_id: values.parent_id || '',
      })
      navigate('/categories', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message)
        return
      }
      setSubmitError('Failed to save category')
    }
  }

  // Forbid choosing self or any descendant as parent.
  const childrenOf = (parentId: ID) =>
    (categories.data ?? []).filter((c) => c.parent_id === parentId)
  const forbidden = new Set<ID>()
  if (selfId) {
    const stack = [selfId]
    while (stack.length) {
      const id = stack.pop()!
      forbidden.add(id)
      for (const child of childrenOf(id)) stack.push(child.id)
    }
  }
  const parentOptions = (categories.data ?? []).filter((c) => !forbidden.has(c.id))

  return (
    <form
      onSubmit={handleSubmit(handle)}
      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4 max-w-xl"
    >
      <h1 className="text-xl font-semibold">
        {mode === 'create' ? 'New category' : 'Edit category'}
      </h1>

      <Field label="Name" error={errors.name?.message}>
        <input
          {...register('name')}
          placeholder="e.g. Groceries"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Parent (optional)">
        <select
          {...register('parent_id')}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">— None (top level) —</option>
          {parentOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Icon">
          <input
            {...register('icon')}
            placeholder="emoji or short label"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Color" error={errors.color?.message}>
          <input
            {...register('color')}
            placeholder="#aabbcc"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
          />
        </Field>
      </div>

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
