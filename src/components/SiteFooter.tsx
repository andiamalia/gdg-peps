import { Link } from 'react-router-dom'
import { useTheme } from '../hooks/useTheme'

export function SiteFooter() {
  const { theme } = useTheme()
  const logo =
    theme === 'dark'
      ? '/brand/gdg-makassar-horizontal-dark.png'
      : '/brand/gdg-makassar-horizontal-light.png'

  return (
    <footer className="mt-auto border-t border-[var(--peps-border)]/80 bg-white/70 py-6 backdrop-blur dark:bg-slate-950/70">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4">
        <Link to="/" aria-label="GDG Makassar home">
          <img src={logo} alt="GDG Makassar" className="h-7 w-auto opacity-90" />
        </Link>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          PEPS · People · Events · Proximity · Social — built for GDG Makassar
        </p>
      </div>
    </footer>
  )
}
