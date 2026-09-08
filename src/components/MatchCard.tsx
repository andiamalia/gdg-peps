import type { CircleMatch } from '../lib/firebase'

type Props = {
  match: CircleMatch
}

export function MatchCard({ match }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, match.score)) * 100)

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{match.display_name}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{match.reason}</p>
        </div>
        <span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
          {pct}% match
        </span>
      </div>
      <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:bg-slate-950 dark:text-slate-200">
        <span className="font-semibold text-slate-900 dark:text-slate-50">Icebreaker: </span>
        {match.icebreaker}
      </p>
      <button
        type="button"
        className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
        onClick={() => void navigator.clipboard.writeText(`Say hi to ${match.display_name}: ${match.icebreaker}`)}
      >
        Copy intro line
      </button>
    </article>
  )
}
