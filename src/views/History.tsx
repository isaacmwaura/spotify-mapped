/** The all-time play log — search, filter, and scroll through every play. */
import { useDeferredValue, useMemo, useState } from 'react'
import { KIND, type Kind, type Play } from '../lib/data'
import { duration, hours, num } from '../lib/format'
import { normalise } from '../lib/stats'
import { HistoryList } from '../components/HistoryList'
import { Empty, SearchInput, Segmented } from '../components/ui'

type KindFilter = 'all' | 'music' | 'podcast'
type Order = 'newest' | 'oldest' | 'longest'
type SkipFilter = 'all' | 'hide' | 'only'

export function History({
  plays,
  years,
  onSelect,
}: {
  plays: Play[]
  years: number[]
  onSelect: (name: string, kind: 'artist' | 'show') => void
}) {
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState<KindFilter>('all')
  const [year, setYear] = useState<'all' | number>('all')
  const [order, setOrder] = useState<Order>('newest')
  const [minSeconds, setMinSeconds] = useState(0)
  const [skips, setSkips] = useState<SkipFilter>('all')

  // Typing stays responsive: the list re-filters at a lower priority.
  const deferredQuery = useDeferredValue(query)

  // The searchable text is built once, not on every keystroke.
  const haystacks = useMemo(
    () => plays.map((p) => normalise(`${p.title} ${p.parent} ${p.album}`)),
    [plays],
  )

  const filtered = useMemo(() => {
    const q = normalise(deferredQuery.trim())
    const wantKind: Kind | null =
      kind === 'music' ? KIND.MUSIC : kind === 'podcast' ? KIND.PODCAST : null
    const minMs = minSeconds * 1000

    const out: Play[] = []
    for (let i = 0; i < plays.length; i++) {
      const p = plays[i]
      if (wantKind !== null) {
        if (kind === 'podcast' ? p.kind === KIND.MUSIC : p.kind !== wantKind) continue
      }
      if (year !== 'all' && p.year !== year) continue
      if (skips === 'hide' && p.skipped) continue
      if (skips === 'only' && !p.skipped) continue
      if (p.ms < minMs) continue
      if (q && !haystacks[i].includes(q)) continue
      out.push(p)
    }

    if (order === 'newest') out.reverse()
    else if (order === 'longest') out.sort((a, b) => b.ms - a.ms)
    return out
  }, [plays, haystacks, deferredQuery, kind, year, order, minSeconds, skips])

  const totalMs = useMemo(() => filtered.reduce((a, p) => a + p.ms, 0), [filtered])
  const skipped = useMemo(() => plays.reduce((a, p) => a + (p.skipped ? 1 : 0), 0), [plays])
  const isFiltered =
    !!deferredQuery.trim() ||
    kind !== 'all' ||
    year !== 'all' ||
    minSeconds > 0 ||
    skips !== 'all'

  return (
    <div>
      <div className="toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search every track, episode, artist, show or album…"
        />
        <Segmented
          label="Filter by type"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'all', label: 'All' },
            { value: 'music', label: 'Music' },
            { value: 'podcast', label: 'Podcasts' },
          ]}
        />
        <select
          className="control"
          value={String(year)}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          aria-label="Filter by year"
        >
          <option value="all">All years</option>
          {[...years].reverse().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          className="control"
          value={order}
          onChange={(e) => setOrder(e.target.value as Order)}
          aria-label="Sort order"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="longest">Longest played</option>
        </select>
        <select
          className="control"
          value={minSeconds}
          onChange={(e) => setMinSeconds(Number(e.target.value))}
          aria-label="Minimum play length"
        >
          <option value={0}>Any length</option>
          <option value={30}>Over 30s</option>
          <option value={120}>Over 2 min</option>
          <option value={600}>Over 10 min</option>
        </select>
        <button
          className="icon-btn toggle"
          aria-pressed={skips === 'hide'}
          onClick={() => setSkips(skips === 'hide' ? 'all' : 'hide')}
          title={`${num(skipped)} plays are marked skipped`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {skips === 'hide' ? (
              <path d="M3 3l18 18M10.6 5.1A9.6 9.6 0 0 1 12 5c5 0 9 4.5 10 7a15 15 0 0 1-3.3 4.2M6.5 6.8C4.4 8.2 2.7 10.3 2 12c1 2.5 5 7 10 7a10 10 0 0 0 4.2-.9" />
            ) : (
              <>
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </>
            )}
          </svg>
          {skips === 'hide' ? 'Skips hidden' : 'Hide skipped'}
        </button>
        {skips !== 'only' ? (
          <button className="icon-btn" onClick={() => setSkips('only')} title="Show only the plays you skipped">
            Only skips
          </button>
        ) : (
          <button className="icon-btn toggle" aria-pressed onClick={() => setSkips('all')}>
            Showing skips only
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 10,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ color: 'var(--text-secondary)' }}>
          <b style={{ color: 'var(--text-primary)' }}>{num(filtered.length)}</b>{' '}
          {filtered.length === 1 ? 'play' : 'plays'}
          {isFiltered && (
            <>
              {' '}
              of {num(plays.length)}
            </>
          )}{' '}
          · {hours(totalMs)} listened
          {filtered.length > 0 && (
            <> · {duration(totalMs / filtered.length)} average</>
          )}
          {skips === 'hide' && <> · {num(skipped)} skips hidden</>}
        </div>
        {isFiltered && (
          <button
            className="icon-btn"
            onClick={() => {
              setQuery('')
              setKind('all')
              setYear('all')
              setMinSeconds(0)
              setSkips('all')
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty>
          <div style={{ fontSize: 15, fontWeight: 560, color: 'var(--text-secondary)' }}>
            Nothing matches those filters
          </div>
          <div style={{ marginTop: 4 }}>Try a shorter search term or widen the year range.</div>
        </Empty>
      ) : (
        <HistoryList plays={filtered} onSelectEntity={onSelect} />
      )}
    </div>
  )
}
