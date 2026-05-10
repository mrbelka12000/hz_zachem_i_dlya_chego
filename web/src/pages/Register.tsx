import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'At least 8 characters'),
  household_name: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function Register() {
  const navigate = useNavigate()
  const { invalidate } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', household_name: '' },
  })

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    try {
      await authApi.register(values)
      await invalidate()
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message)
        return
      }
      setSubmitError('Registration failed')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm bg-white rounded-2xl shadow border border-slate-200 p-8 space-y-5"
      >
        <h1 className="text-xl font-semibold text-slate-900">Create account</h1>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Email</span>
          <input
            type="email"
            autoComplete="email"
            {...register('email')}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          {errors.email && (
            <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Password</span>
          <input
            type="password"
            autoComplete="new-password"
            {...register('password')}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
        </label>

        <label className="block">
          <span className="text-sm font-medium text-slate-700">Household name</span>
          <input
            type="text"
            placeholder="My household"
            {...register('household_name')}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
        </label>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-slate-900 text-white py-2 font-medium hover:bg-slate-800 disabled:opacity-60"
        >
          {isSubmitting ? 'Creating…' : 'Create account'}
        </button>

        <p className="text-sm text-slate-500 text-center">
          Already have an account?{' '}
          <Link to="/login" className="text-slate-900 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  )
}
