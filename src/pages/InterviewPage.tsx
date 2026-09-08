import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { InterviewChat, type ChatMessage } from '../components/InterviewChat'
import { interviewTurn } from '../lib/ai'
import { markInterviewInProgress, normalizeEventCode } from '../lib/events'
import { getDb, type MemberDoc, type UserDoc } from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
}

export function InterviewPage({ user, profile }: Props) {
  const { eventId: rawId } = useParams()
  const eventId = normalizeEventCode(rawId ?? '')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [completeness, setCompleteness] = useState(0)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  useEffect(() => {
    if (!eventId) return
    return onSnapshot(doc(getDb(), 'events', eventId, 'members', user.uid), (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as MemberDoc
      setCompleteness(Number(data.completeness ?? 0))
      setDone(data.interview_status === 'ready')
    })
  }, [eventId, user.uid])

  useEffect(() => {
    if (!eventId || started) return
    let cancelled = false

    async function boot() {
      setBusy(true)
      setError(null)
      try {
        await markInterviewInProgress({ eventId, uid: user.uid })
        const result = await interviewTurn({ eventId })
        if (cancelled) return
        setMessages([
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            text: result.assistant_message,
          },
        ])
        setCompleteness(result.completeness)
        setDone(result.done)
        setStarted(true)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Interview failed to start')
      } finally {
        if (!cancelled) setBusy(false)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [eventId, user.uid, started])

  async function onSend(message: string) {
    setBusy(true)
    setError(null)
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: message }])
    try {
      const result = await interviewTurn({ eventId, message })
      setMessages((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: result.assistant_message },
      ])
      setCompleteness(result.completeness)
      setDone(result.done)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setBusy(false)
    }
  }

  async function onRestart() {
    setBusy(true)
    setError(null)
    try {
      const result = await interviewTurn({ eventId, restart: true })
      setMessages([{ id: `a-${Date.now()}`, role: 'assistant', text: result.assistant_message }])
      setCompleteness(result.completeness)
      setDone(result.done)
      setStarted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restart')
    } finally {
      setBusy(false)
    }
  }

  if (!eventId) {
    return <p className="px-4 py-10 text-center text-red-600">Invalid event</p>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--peps-primary)]">
            Hi {profile.display_name}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Introduce yourself</h1>
        </div>
        <Link to={`/e/${eventId}`} className="text-sm font-medium text-[var(--peps-primary)]">
          Back to room
        </Link>
      </div>

      <InterviewChat
        messages={messages}
        completeness={completeness}
        busy={busy}
        done={done}
        onSend={onSend}
      />

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onRestart()}
          disabled={busy}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          Restart interview
        </button>
        {done && (
          <Link
            to={`/e/${eventId}/match`}
            className="rounded-xl bg-[var(--peps-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--peps-primary-hover)]"
          >
            Find my circle
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  )
}
