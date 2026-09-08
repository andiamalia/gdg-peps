import type { User } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { MatchCard } from '../components/MatchCard'
import { ShakeHint } from '../components/ShakeHint'
import { requestShakePermission, useShake } from '../hooks/useShake'
import { findCircle } from '../lib/ai'
import { normalizeEventCode } from '../lib/events'
import { getDb, type CircleMatch, type MemberDoc, type UserDoc } from '../lib/firebase'

type Props = {
  user: User
  profile: UserDoc
}

export function MatchPage({ user, profile }: Props) {
  const { eventId: rawId } = useParams()
  const eventId = normalizeEventCode(rawId ?? '')
  const [ready, setReady] = useState(false)
  const [matches, setMatches] = useState<CircleMatch[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [permissionNeeded, setPermissionNeeded] = useState(false)

  useEffect(() => {
    if (!eventId) return
    return onSnapshot(doc(getDb(), 'events', eventId, 'members', user.uid), (snap) => {
      const data = snap.exists() ? (snap.data() as MemberDoc) : null
      setReady(data?.interview_status === 'ready')
    })
  }, [eventId, user.uid])

  const runFind = useCallback(
    async (source: 'shake' | 'button') => {
      if (!eventId || !ready || busy) return
      setBusy(true)
      setError(null)
      if (source === 'shake') {
        setShaking(true)
        window.setTimeout(() => setShaking(false), 600)
      }
      try {
        const result = await findCircle({ eventId, source })
        setMatches(result.matches)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Find circle failed')
      } finally {
        setBusy(false)
      }
    },
    [eventId, ready, busy],
  )

  useShake({
    enabled: ready && !busy,
    onShake: () => void runFind('shake'),
  })

  async function enableMotion() {
    const ok = await requestShakePermission()
    setPermissionNeeded(!ok)
  }

  useEffect(() => {
    const Motion = DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }
    setPermissionNeeded(typeof Motion.requestPermission === 'function')
  }, [])

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">Find your circle</h1>
        </div>
        <Link to={`/e/${eventId}`} className="text-sm font-medium text-[var(--peps-primary)]">
          Back to room
        </Link>
      </div>

      {!ready ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Finish the Gemini interview before matching.
          </p>
          <Link
            to={`/e/${eventId}/interview`}
            className="mt-3 inline-block rounded-xl bg-[var(--peps-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            Go to interview
          </Link>
        </div>
      ) : (
        <>
          <ShakeHint
            shaking={shaking}
            permissionNeeded={permissionNeeded}
            onEnableMotion={() => void enableMotion()}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void runFind('button')}
            className="w-full rounded-2xl bg-[var(--peps-primary)] px-4 py-3.5 text-lg font-semibold text-white hover:bg-[var(--peps-primary-hover)] disabled:opacity-60"
          >
            {busy ? 'Finding circle…' : 'Find my circle'}
          </button>
          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            Button always works — shake is optional for in-person energy.
          </p>
        </>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="space-y-3">
        {matches.map((m) => (
          <MatchCard key={m.uid} match={m} />
        ))}
        {ready && !busy && matches.length === 0 && (
          <p className="text-center text-sm text-slate-500 dark:text-slate-400">
            No matches yet — ask a few more people to complete their interview.
          </p>
        )}
      </div>
    </div>
  )
}
