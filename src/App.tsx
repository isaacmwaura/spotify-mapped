import { useCallback, useEffect, useMemo, useState } from 'react'
import { decodeDataset, type Dataset, type RawDataset } from './lib/data'
import { Import } from './views/Import'
import { years as yearsOf } from './lib/stats'
import { viewFromHash, type View } from './lib/route'
import { hours, num } from './lib/format'
import { Overview } from './views/Overview'
import { History } from './views/History'
import { Top } from './views/Top'
import { Patterns } from './views/Patterns'
import { Years } from './views/Years'
import { EntityDrawer, type Selection } from './components/EntityDrawer'


const VIEWS: {
  id: View
  label: string
  title: string
  sub: string
  icon: JSX.Element
}[] = [
  {
    id: 'overview',
    label: 'Overview',
    title: 'Overview',
    sub: 'Everything you have listened to, in one page.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    id: 'history',
    label: 'All-time history',
    title: 'All-time history',
    sub: 'Every single play, in order, searchable. Nothing summarised away.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    id: 'top',
    label: 'Top charts',
    title: 'Top charts',
    sub: 'Artists, tracks, albums, shows and episodes ranked by time listened.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </svg>
    ),
  },
  {
    id: 'patterns',
    label: 'Habits',
    title: 'Listening habits',
    sub: 'When you listen, on what, and how you behave once it starts.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    id: 'years',
    label: 'By year',
    title: 'Year by year',
    sub: 'Your own Wrapped — for every year you have had the account.',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 11h18" />
      </svg>
    ),
  },
]

export default function App() {
  const [data, setData] = useState<Dataset | null>(null)
  const [view, setView] = useState<View>(() => viewFromHash(location.hash))

  // The browser's Back and Forward buttons change the hash; follow them.
  useEffect(() => {
    const onHash = () => setView(viewFromHash(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const [selection, setSelection] = useState<Selection | null>(null)
  // The light/dark choice is the only thing remembered between visits.
  // Listening data never is: it lives in this tab's memory and nowhere else.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })

  // Earlier versions kept the import in browser storage. Wipe anything they
  // left behind, so nothing from before this version lingers on the device.
  useEffect(() => {
    try {
      indexedDB?.deleteDatabase('spotify-mapped')
    } catch {
      /* storage blocked: nothing to wipe */
    }
  }, [])

  const accept = useCallback((raw: RawDataset) => {
    setData(decodeDataset(raw))
    setView('overview')
  }, [])

  const startOver = useCallback(() => {
    setSelection(null)
    setData(null)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('theme', theme)
    } catch {
      /* private mode: the choice just isn't remembered */
    }
  }, [theme])

  useEffect(() => {
    location.hash = view
    document.querySelector('.main')?.scrollTo({ top: 0 })
  }, [view])

  const plays = data?.plays ?? []
  const years = useMemo(() => yearsOf(plays), [plays])
  const totalMs = useMemo(() => plays.reduce((a, p) => a + p.ms, 0), [plays])

  const select = useCallback((name: string, kind: 'artist' | 'show') => {
    setSelection({ name, kind })
  }, [])

  if (!data) return <Import onReady={accept} />

  const meta = VIEWS.find((v) => v.id === view) ?? VIEWS[0]

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="11" fill="var(--accent)" />
            <path
              d="M7 9.4c3.2-.9 6.6-.6 9.4.9M7.6 12.4c2.7-.7 5.5-.5 7.9.8M8.2 15.3c2.2-.5 4.4-.3 6.3.7"
              stroke="var(--accent-ink)"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          <div>
            <div className="brand-name">Spotify Mapped</div>
            <div className="brand-sub">{data.profile.displayName}</div>
          </div>
        </div>

        <div className="nav">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className="nav-item"
              aria-current={v.id === view}
              onClick={() => setView(v.id)}
            >
              {v.icon}
              {v.label}
              {v.id === 'history' && <span className="nav-count">{num(plays.length)}</span>}
            </button>
          ))}
        </div>

        <div className="sidebar-foot">
          <div className="meta" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.4 }}>
            {hours(totalMs)} listened
            <br />
            {years[0]}–{years[years.length - 1]}
          </div>
          {/* Outside .meta, which phones hide, so it is reachable everywhere. */}
          <button
            className="icon-btn"
            onClick={startOver}
            title="Clear this analysis and choose another file"
          >
            Start over
          </button>
          <button
            className="icon-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="4.5" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <main className="main">
        <div className="main-inner">
          <header className="page-head">
            <h1 className="page-title">{meta.title}</h1>
            <p className="page-sub">{meta.sub}</p>
          </header>

          {view === 'overview' && (
            <Overview
              data={data}
              plays={plays}
              onSelect={select}
              onGoto={(v) => setView(v as View)}
            />
          )}
          {view === 'history' && (
            <History plays={plays} years={years} onSelect={select} />
          )}
          {view === 'top' && <Top plays={plays} years={years} onSelect={select} />}
          {view === 'patterns' && <Patterns plays={plays} />}
          {view === 'years' && (
            <Years plays={plays} years={years} onSelect={select} />
          )}
        </div>
      </main>

      {selection && (
        <EntityDrawer
          selection={selection}
          plays={plays}
          onClose={() => setSelection(null)}
        />
      )}
    </div>
  )
}
