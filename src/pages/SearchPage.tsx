import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MatchCard } from '../components/MatchCard'
import { searchCircle } from '../lib/ai'
import { normalizeEventCode } from '../lib/events'
import { getDb, type CircleMatch, type MemberDoc, type UserDoc } from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
}

export function SearchPage({ user, profile }: Props) {
  const { eventId: rawId } = useParams()
  const eventId = normalizeEventCode(rawId ?? '')
  const [ready, setReady] = useState(false)
  const [query, setQuery] = useState('')
  const [matches, setMatches] = useState<CircleMatch[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!eventId) return
    return onSnapshot(doc(getDb(), 'events', eventId, 'members', user.uid), (snap) => {
      const data = snap.exists() ? (snap.data() as MemberDoc) : null
      setReady(data?.interview_status === 'ready')
    })
  }, [eventId, user.uid])

  async function onSearch(e: FormEvent) {
    e.preventDefault()
    if (!eventId || !ready) return
    setBusy(true)
    setError(null)
    try {
      const result = await searchCircle({ eventId, query })
      setMatches(result.matches)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
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
            {profile.display_name}
          </p>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Search by vibe</h1>
        </div>
        <Link to={`/e/${eventId}`} className="text-sm font-medium text-[var(--peps-primary)]">
          Back to room
        </Link>
      </div>

      {!ready ? (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
          Complete the interview first.{' '}
          <Link to={`/e/${eventId}/interview`} className="font-semibold underline">
            Start interview
          </Link>
        </p>
      ) : (
        <form
          onSubmit={(e) => void onSearch(e)}
          className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          <label htmlFor="query" className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Who are you looking for?
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-slate-900 outline-none ring-[var(--peps-primary)] focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            placeholder="fintech + hiking + Flutter, or students into AI from Makassar"
          />
          <button
            type="submit"
            disabled={busy || !query.trim()}
            className="mt-3 w-full rounded-xl bg-[var(--peps-primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--peps-primary-hover)] disabled:opacity-60"
          >
            {busy ? 'Searching…' : 'Search circle'}
          </button>
        </form>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="space-y-3">
        {matches.map((m) => (
          <MatchCard key={m.uid} match={m} />
        ))}
      </div>
    </div>
  )
}
