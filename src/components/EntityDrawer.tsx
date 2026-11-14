/** Drill-down panel for one artist or show. */
import { useEffect, useMemo } from 'react'
import { KIND, type Play } from '../lib/data'
import { duration, fmtDate, hours, num, relativeDays } from '../lib/format'
import { rankEntities, summarise } from '../lib/stats'
import { Card, Stat } from './ui'
import { RankedBars } from './Charts'

export interface Selection {
  name: string
  kind: 'artist' | 'show'
}

export function EntityDrawer({
  selection,
  plays,
  onClose,
}: {
  selection: Selection
  plays: Play[]
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const mine = useMemo(
    () =>
      plays.filter(
        (p) =>
          p.parent === selection.name &&
          (selection.kind === 'artist'
            ? p.kind === KIND.MUSIC
            : p.kind !== KIND.MUSIC),
      ),
    [plays, selection],
  )

  const s = useMemo(() => summarise(mine), [mine])
  const children = useMemo(
    () => rankEntities(mine, (p) => p.title, () => ''),
    [mine],
  )

  const childLabel = selection.kind === 'artist' ? 'Tracks' : 'Episodes'
  const totalMs = plays.reduce((a, p) => a + p.ms, 0)
  const share = totalMs ? (s.ms / totalMs) * 100 : 0

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={selection.name}>
        <header className="drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', fontWeight: 600 }}>
              {selection.kind === 'artist' ? 'Artist' : 'Show'}
            </div>
            <h2 style={{ margin: '2px 0 0', fontSize: 22, letterSpacing: '-0.02em', fontWeight: 680 }}>
              {selection.name}
            </h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className="drawer-body">
          <div className="grid grid-2">
            <Stat label="Time" value={hours(s.ms)} sub={`${share.toFixed(1)}% of all listening`} />
            <Stat label="Plays" value={num(s.plays)} sub={`${num(children.length)} ${childLabel.toLowerCase()}`} />
          </div>

          <Card title="Your history with them">
            <div className="stack" style={{ gap: 10 }}>
              <Row label="First played" value={s.first ? fmtDate(s.first.date) : '—'} note={s.first?.title} />
              <Row label="Last played" value={s.last ? fmtDate(s.last.date) : '—'} note={s.last ? relativeDays(s.last.date, new Date()) : undefined} />
              <Row label="Longest single play" value={duration(Math.max(...mine.map((p) => p.ms), 0))} />
              {selection.kind === 'artist' && (
                <Row label="Skipped" value={`${Math.round(s.skipRate * 100)}% of plays`} />
              )}
            </div>
          </Card>

          <Card title={`Top ${childLabel.toLowerCase()}`} note={`${num(children.length)} in total`}>
            <RankedBars
              max={children[0]?.ms ?? 1}
              items={children.slice(0, 15).map((c) => ({
                name: c.name,
                sub: `${num(c.plays)} play${c.plays === 1 ? '' : 's'}`,
                value: c.ms,
                display: duration(c.ms),
              }))}
            />
          </Card>
        </div>
      </aside>
    </>
  )
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'baseline' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ textAlign: 'right', minWidth: 0 }}>
        <b style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</b>
        {note && (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
            {note}
          </div>
        )}
      </span>
    </div>
  )
}
