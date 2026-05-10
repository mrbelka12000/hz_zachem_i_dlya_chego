import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { authApi } from '../api/auth'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

type FormValues = z.infer<typeof schema>

interface LocationState {
  from?: string
}

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { invalidate } = useAuth()
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  async function onSubmit(values: FormValues) {
    setSubmitError(null)
    try {
      await authApi.login(values)
      await invalidate()
      const target = (location.state as LocationState | null)?.from ?? '/'
      navigate(target, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message)
        return
      }
      setSubmitError('Login failed')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm bg-white rounded-2xl shadow border border-slate-200 p-8 space-y-5"
      >
        <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>

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
            autoComplete="current-password"
            {...register('password')}
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-500"
          />
          {errors.password && (
            <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
          )}
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
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="text-sm text-slate-500 text-center">
          New here?{' '}
          <Link to="/register" className="text-slate-900 font-medium hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </main>
  )
}
