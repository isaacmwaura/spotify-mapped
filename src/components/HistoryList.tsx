/**
 * The complete play log. Windowed rendering keeps it smooth at any size —
 * only the visible slice of rows is in the DOM.
 */
import { useEffect, useRef, useState } from 'react'
import { KIND, webUrl, type Play } from '../lib/data'
import { duration, fmtDate, fmtTime, num } from '../lib/format'

const ROW_H = 56
const OVERSCAN = 8

export function HistoryList({
  plays,
  onSelectEntity,
}: {
  plays: Play[]
  onSelectEntity: (name: string, kind: 'artist' | 'show') => void
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ start: 0, end: 40 })

  useEffect(() => {
    const el = scroller.current
    if (!el) return

    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_H) - OVERSCAN)
      const visible = Math.ceil(el.clientHeight / ROW_H) + OVERSCAN * 2
      setRange({ start, end: Math.min(plays.length, start + visible) })
    }

    update()
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [plays.length])

  // A new filter should put you back at the top of the results.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 })
    setRange({ start: 0, end: 40 })
  }, [plays])

  const slice = plays.slice(range.start, range.end)

  return (
    <>
      <div className="vhead" aria-hidden="true">
        <span>Started</span>
        <span>What</span>
        <span className="vcol-meta">Context</span>
        <span style={{ textAlign: 'right' }}>Played</span>
      </div>
      <div
        className="vlist"
        ref={scroller}
        role="list"
        aria-label={`${num(plays.length)} plays`}
      >
        <div style={{ height: plays.length * ROW_H, position: 'relative' }}>
          {slice.map((p, idx) => (
            <Row
              key={p.i}
              play={p}
              top={(range.start + idx) * ROW_H}
              onSelectEntity={onSelectEntity}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function Row({
  play: p,
  top,
  onSelectEntity,
}: {
  play: Play
  top: number
  onSelectEntity: (name: string, kind: 'artist' | 'show') => void
}) {
  const url = webUrl(p.uri)
  const isMusic = p.kind === KIND.MUSIC

  return (
    <div className="vrow" style={{ top, height: ROW_H }} role="listitem">
      {/* Every row carries its own full date — rows are sortable and filterable,
          so inheriting the date from the row above would be a lie. */}
      <div className="vtime">
        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
          {fmtDate(p.date)}
        </div>
        <div>{fmtTime(p.date)}</div>
      </div>

      <div className="vtitle">
        <b title={p.title}>
          {url ? (
            <a
              className="link"
              href={url}
              target="_blank"
              rel="noreferrer"
              style={{ color: 'inherit' }}
            >
              {p.title}
            </a>
          ) : (
            p.title
          )}
        </b>
        <span>
          <button
            style={{
              color: 'inherit',
              padding: 0,
              font: 'inherit',
              textDecoration: 'underline',
              textDecorationColor: 'transparent',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.textDecorationColor = 'currentColor')}
            onMouseLeave={(e) => (e.currentTarget.style.textDecorationColor = 'transparent')}
            onClick={() => onSelectEntity(p.parent, isMusic ? 'artist' : 'show')}
            title={`See everything from ${p.parent}`}
          >
            {p.parent}
          </button>
          {isMusic && p.album && p.album !== p.title ? ` · ${p.album}` : ''}
        </span>
      </div>

      <div className="vcol-meta">
        <span className={`chip ${isMusic ? 'music' : p.kind === KIND.PODCAST ? 'podcast' : 'book'}`}>
          {isMusic ? 'Music' : p.kind === KIND.PODCAST ? 'Podcast' : 'Audio'}
        </span>
        {p.skipped && <span className="chip">Skipped</span>}
        {!p.skipped && p.shuffle && <span className="chip">Shuffle</span>}
        {!p.skipped && !p.shuffle && p.offline && <span className="chip">Offline</span>}
      </div>

      <div
        className="rank-value"
        style={{ textAlign: 'right', fontSize: 13 }}
        title={`Started ${p.reasonStart}, ended ${p.reasonEnd}`}
      >
        {duration(p.ms)}
      </div>
    </div>
  )
}
