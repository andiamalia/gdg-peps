import { useState, type FormEvent } from 'react'

export type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
}

type Props = {
  messages: ChatMessage[]
  completeness: number
  busy: boolean
  done: boolean
  onSend: (message: string) => Promise<void>
}

export function InterviewChat({ messages, completeness, busy, done, onSend }: Props) {
  const [draft, setDraft] = useState('')
  const pct = Math.round(Math.min(1, Math.max(0, completeness)) * 100)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || busy || done) return
    setDraft('')
    await onSend(text)
  }

  return (
    <div className="flex h-full min-h-[28rem] flex-col rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900 dark:text-slate-50">Gemini interview</h2>
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{pct}% complete</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-[var(--peps-primary)] transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
              m.role === 'assistant'
                ? 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
                : 'ml-auto bg-[var(--peps-primary)] text-white'
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <p className="text-sm text-slate-500 dark:text-slate-400">Thinking…</p>
        )}
        {done && (
          <p className="rounded-xl bg-green-50 px-3 py-2 text-sm font-medium text-green-800 dark:bg-green-950 dark:text-green-200">
            Profile ready — you can find your circle now.
          </p>
        )}
      </div>

      <form onSubmit={(e) => void submit(e)} className="border-t border-slate-100 p-3 dark:border-slate-800">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy || done}
            placeholder={done ? 'Interview complete' : 'Type your answer…'}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-[var(--peps-primary)] focus:ring-2 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={busy || done || !draft.trim()}
            className="rounded-xl bg-[var(--peps-primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--peps-primary-hover)] disabled:opacity-60"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  )
}
