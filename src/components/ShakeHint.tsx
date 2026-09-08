type Props = {
  shaking?: boolean
  permissionNeeded?: boolean
  onEnableMotion?: () => void
}

export function ShakeHint({ shaking = false, permissionNeeded = false, onEnableMotion }: Props) {
  return (
    <div
      className={`rounded-2xl border border-dashed p-6 text-center transition ${
        shaking
          ? 'border-[var(--peps-primary)] bg-blue-50 dark:bg-blue-950/40'
          : 'border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-900'
      }`}
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-[var(--peps-primary)]">
        Proximity
      </p>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-50">Shake your phone</p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Find people in this room who share your circle — hobbies, stack, city, and more.
      </p>
      {permissionNeeded && onEnableMotion && (
        <button
          type="button"
          onClick={onEnableMotion}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Enable motion access
        </button>
      )}
    </div>
  )
}
