import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { meTelegramApi } from '../api/budgets'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

export function Settings() {
  const { me, refresh } = useAuth()
  const qc = useQueryClient()
  const [chatID, setChatID] = useState<string>('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (me?.telegram_user_id != null) setChatID(String(me.telegram_user_id))
    else setChatID('')
  }, [me?.telegram_user_id])

  const save = useMutation({
    mutationFn: (next: number | null) => meTelegramApi.setChatID({ chat_id: next }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['me'] })
      void refresh()
      setSubmitError(null)
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 2000)
    },
    onError: (err) => {
      setSubmitError(err instanceof ApiError ? err.message : 'Save failed')
    },
  })

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = chatID.trim()
    if (trimmed === '') {
      save.mutate(null)
      return
    }
    if (!/^-?\d+$/.test(trimmed)) {
      setSubmitError('Chat ID must be a whole number.')
      return
    }
    save.mutate(Number(trimmed))
  }

  const linked = me?.telegram_user_id != null

  return (
    <div className="space-y-5 max-w-xl">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
      </header>

      <section className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Telegram alerts</h2>
          <p className="text-sm text-slate-500 mt-1">
            Paste your Telegram numeric chat ID below. The app will send you
            budget overflow alerts (50% / 80% / 100% thresholds) when expenses
            in the current month cross those marks.
          </p>
          <p className="text-xs text-slate-500 mt-2">
            Don't know your chat ID? Open Telegram and message{' '}
            <code className="bg-slate-100 rounded px-1">@userinfobot</code>{' '}
            — it replies with your numeric ID. You also need to{' '}
            <code className="bg-slate-100 rounded px-1">/start</code> the
            household's bot once so it can DM you.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">
              Telegram chat ID
            </span>
            <input
              inputMode="numeric"
              value={chatID}
              onChange={(e) => setChatID(e.target.value)}
              placeholder="123456789"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm tabular-nums"
            />
          </label>

          {submitError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {submitError}
            </p>
          )}
          {savedFlash && (
            <p className="text-sm text-green-700 bg-green-100 border border-green-100 rounded px-3 py-2">
              Saved.
            </p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-slate-500">
              {linked
                ? `Currently linked: ${me?.telegram_user_id}`
                : 'Not linked'}
            </span>
            <span className="flex gap-2">
              {linked && (
                <button
                  type="button"
                  onClick={() => save.mutate(null)}
                  disabled={save.isPending}
                  className="rounded-md border border-slate-300 text-sm px-3 py-1.5 hover:bg-slate-50 disabled:opacity-60"
                >
                  Unlink
                </button>
              )}
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded-md bg-slate-900 text-white text-sm px-3 py-1.5 hover:bg-slate-800 disabled:opacity-60"
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
            </span>
          </div>
        </form>
      </section>
    </div>
  )
}
