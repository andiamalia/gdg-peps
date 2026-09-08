import type { User } from 'firebase/auth'
import { collection, doc, onSnapshot } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QrJoin } from '../components/QrJoin'
import { joinEvent, normalizeEventCode } from '../lib/events'
import { getDb, type EventDoc, type MemberDoc, type UserDoc } from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
}

export function EventPage({ user, profile }: Props) {
  const { eventId: rawId } = useParams()
  const eventId = normalizeEventCode(rawId ?? '')
  const [event, setEvent] = useState<EventDoc | null>(null)
  const [member, setMember] = useState<MemberDoc | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [readyCount, setReadyCount] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState(true)

  useEffect(() => {
    if (!eventId) return
    let cancelled = false

    async function bootstrap() {
      setJoining(true)
      setError(null)
      try {
        await joinEvent({
          eventId,
          uid: user.uid,
          displayName: profile.display_name,
        })
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to join event')
      } finally {
        if (!cancelled) setJoining(false)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [eventId, user.uid, profile.display_name])

  useEffect(() => {
    if (!eventId) return
    const unsubEvent = onSnapshot(doc(getDb(), 'events', eventId), (snap) => {
      setEvent(snap.exists() ? (snap.data() as EventDoc) : null)
    })
    const unsubMe = onSnapshot(doc(getDb(), 'events', eventId, 'members', user.uid), (snap) => {
      setMember(snap.exists() ? (snap.data() as MemberDoc) : null)
    })
    const unsubMembers = onSnapshot(collection(getDb(), 'events', eventId, 'members'), (snap) => {
      setMemberCount(snap.size)
      setReadyCount(snap.docs.filter((d) => (d.data() as MemberDoc).interview_status === 'ready').length)
    })
    return () => {
      unsubEvent()
      unsubMe()
      unsubMembers()
    }
  }, [eventId, user.uid])

  if (!eventId) {
    return <p className="px-4 py-10 text-center text-red-600">Invalid event code</p>
  }

  if (joining) {
    return <p className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">Joining room…</p>
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Link to="/" className="mt-4 inline-block text-[var(--peps-primary)]">
          Back home
        </Link>
      </div>
    )
  }

  if (!event) {
    return <p className="px-4 py-10 text-center text-slate-600 dark:text-slate-400">Loading event…</p>
  }

  const ready = member?.interview_status === 'ready'
  const isOrganizer = event.organizer_uid === user.uid

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-[var(--peps-primary)]">
          Event room
        </p>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">{event.title}</h1>
        {event.city && (
          <p className="text-sm text-slate-500 dark:text-slate-400">{event.city}</p>
        )}
        <p className="text-slate-600 dark:text-slate-300">
          {memberCount} people here · {readyCount} profiles ready
          {isOrganizer ? ' · you are the organizer' : ''}
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to={`/e/${eventId}/interview`}
            className="rounded-2xl bg-[var(--peps-primary)] px-4 py-3 text-center font-semibold text-white hover:bg-[var(--peps-primary-hover)]"
          >
            {ready ? 'Review / redo interview' : 'Start Gemini interview'}
          </Link>
          <Link
            to={`/e/${eventId}/match`}
            className={`rounded-2xl px-4 py-3 text-center font-semibold ${
              ready
                ? 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900'
                : 'pointer-events-none bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-500'
            }`}
            aria-disabled={!ready}
          >
            Find my circle
          </Link>
          <Link
            to={`/e/${eventId}/search`}
            className={`rounded-2xl border px-4 py-3 text-center font-semibold sm:col-span-2 ${
              ready
                ? 'border-slate-200 text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800'
                : 'pointer-events-none border-slate-200 text-slate-400 dark:border-slate-700'
            }`}
          >
            Search by vibe (natural language)
          </Link>
        </div>

        {!ready && (
          <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Complete the short Gemini interview first so we can match you with people in this room.
          </p>
        )}
      </section>

      <QrJoin eventId={eventId} title={event.title} />
    </div>
  )
}
