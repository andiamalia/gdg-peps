import type { User } from 'firebase/auth'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { createEvent, normalizeEventCode, isValidEventCode } from '../lib/events'
import type { UserDoc } from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
}

export function HomePage({ user, profile }: Props) {
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [city, setCity] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const eventId = await createEvent({
        title,
        organizerUid: user.uid,
        displayName: profile.display_name,
        city,
      })
      navigate(`/e/${eventId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create event')
    } finally {
      setBusy(false)
    }
  }

  function onJoin(e: FormEvent) {
    e.preventDefault()
    const code = normalizeEventCode(joinCode)
    if (!isValidEventCode(code) || code.length !== 4) {
      setError('Enter a 4-character event code')
      return
    }
    navigate(`/e/${code}`)
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-4 py-10">
      <section className="peps-fade-up space-y-4 text-center sm:text-left">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--peps-primary)]">
          People · Events · Proximity · Social
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-slate-50">
          PEPS
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">
          Find your circle at GDG Makassar events. Gemini interviews your vibe, then shake your phone
          to meet people who share hobbies, stack, city, and goals.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Signed in as{' '}
          <span className="font-medium text-slate-800 dark:text-slate-200">{profile.display_name}</span>
        </p>
      </section>

      <section className="peps-fade-up space-y-4" style={{ animationDelay: '80ms' }}>
        <form
          onSubmit={onJoin}
          className="rounded-2xl border-2 border-[var(--peps-primary)]/30 bg-[var(--peps-card)] p-5 shadow-md"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Join with event code</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">4 characters · letters & numbers</p>
          <input
            value={joinCode}
            onChange={(e) => setJoinCode(normalizeEventCode(e.target.value))}
            maxLength={4}
            className="mt-3 w-full rounded-xl border border-[var(--peps-border)] bg-white px-3 py-2.5 font-mono text-2xl uppercase tracking-[0.35em] text-slate-900 outline-none ring-[var(--peps-primary)] focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            placeholder="GDGX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-[var(--peps-primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--peps-primary-hover)]"
          >
            Join room
          </button>
        </form>

        <form
          onSubmit={(e) => void onCreate(e)}
          className="rounded-2xl border border-[var(--peps-border)] bg-[var(--peps-card)] p-5 shadow-sm"
        >
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">Create event room</h2>
          <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="title">
            Event title
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="mt-1 w-full rounded-xl border border-[var(--peps-border)] bg-white px-3 py-2.5 text-slate-900 outline-none ring-[var(--peps-primary)] focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            placeholder="GDG Makassar Meetup #12"
          />
          <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300" htmlFor="city">
            City (optional)
          </label>
          <input
            id="city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="mt-1 w-full rounded-xl border border-[var(--peps-border)] bg-white px-3 py-2.5 text-slate-900 outline-none ring-[var(--peps-primary)] focus:ring-2 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
            placeholder="Makassar"
          />
          <button
            type="submit"
            disabled={busy}
            className="mt-4 w-full rounded-xl bg-[var(--peps-primary)] px-4 py-2.5 font-semibold text-white hover:bg-[var(--peps-primary-hover)] disabled:opacity-60"
          >
            {busy ? 'Creating…' : 'Create room + QR'}
          </button>
        </form>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </section>
    </div>
  )
}
