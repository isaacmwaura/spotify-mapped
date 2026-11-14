/** Ranked artists, tracks, albums, shows and episodes — table-first. */
import { useDeferredValue, useMemo, useState } from 'react'
import type { Play } from '../lib/data'
import { duration, fmtDate, num } from '../lib/format'
import {
  normalise,
  rankAlbums,
  rankArtists,
  rankEpisodes,
  rankShows,
  rankTracks,
  type Entity,
} from '../lib/stats'
import { Empty, SearchInput, Segmented } from '../components/ui'

type Tab = 'artists' | 'tracks' | 'albums' | 'shows' | 'episodes'

const TABS: { value: Tab; label: string }[] = [
  { value: 'artists', label: 'Artists' },
  { value: 'tracks', label: 'Tracks' },
  { value: 'albums', label: 'Albums' },
  { value: 'shows', label: 'Shows' },
  { value: 'episodes', label: 'Episodes' },
]

type Row = Entity & { artist?: string }

export function Top({
  plays,
  years,
  onSelect,
}: {
  plays: Play[]
  years: number[]
  onSelect: (name: string, kind: 'artist' | 'show') => void
}) {
  const [tab, setTab] = useState<Tab>('artists')
  const [year, setYear] = useState<'all' | number>('all')
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query)

  const scoped = useMemo(
    () => (year === 'all' ? plays : plays.filter((p) => p.year === year)),
    [plays, year],
  )

  const rows: Row[] = useMemo(() => {
    switch (tab) {
      case 'artists':
        return rankArtists(scoped)
      case 'tracks':
        return rankTracks(scoped)
      case 'albums':
        return rankAlbums(scoped)
      case 'shows':
        return rankShows(scoped)
      case 'episodes':
        return rankEpisodes(scoped)
    }
  }, [tab, scoped])

  const filtered = useMemo(() => {
    const q = normalise(deferred.trim())
    if (!q) return rows
    return rows.filter((r) => normalise(`${r.name} ${r.artist ?? ''}`).includes(q))
  }, [rows, deferred])

  const isEntity = tab === 'artists' || tab === 'shows'
  const secondLabel =
    tab === 'artists' ? 'Top track'
    : tab === 'shows' ? 'Top episode'
    : tab === 'episodes' ? 'Show'
    : 'Artist'
  const countLabel =
    tab === 'artists' ? 'Tracks' : tab === 'shows' ? 'Episodes' : 'Plays'

  const totalMs = useMemo(() => filtered.reduce((a, r) => a + r.ms, 0), [filtered])

  return (
    <div>
      <div className="toolbar">
        <Segmented label="Category" value={tab} onChange={setTab} options={TABS} />
        <select
          className="control"
          value={String(year)}
          onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          aria-label="Filter by year"
        >
          <option value="all">All time</option>
          {[...years].reverse().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <SearchInput value={query} onChange={setQuery} placeholder={`Find in ${tab}…`} />
      </div>

      <div style={{ color: 'var(--text-secondary)', marginBottom: 10 }}>
        <b style={{ color: 'var(--text-primary)' }}>{num(filtered.length)}</b> {tab} ·{' '}
        {duration(totalMs)} listened
        {year !== 'all' && ` in ${year}`}
      </div>

      {filtered.length === 0 ? (
        <Empty>Nothing here for that search.</Empty>
      ) : (
        <div className="card table-card">
          {/* The table is wider than a phone; it scrolls itself rather than the page. */}
          <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 46, textAlign: 'right' }}>#</th>
                <th>Name</th>
                <th>{secondLabel}</th>
                <th className="num" style={{ width: 90 }}>
                  {countLabel}
                </th>
                <th className="num" style={{ width: 90 }}>
                  Plays
                </th>
                <th className="num" style={{ width: 110 }}>
                  Time
                </th>
                <th className="num" style={{ width: 130 }}>
                  Last played
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((r, i) => (
                <tr key={`${r.name}-${r.artist ?? ''}-${i}`}>
                  <td className="num" style={{ color: 'var(--text-muted)', fontWeight: 600 }}>
                    {i + 1}
                  </td>
                  <td style={{ maxWidth: 320 }}>
                    {isEntity ? (
                      <button
                        style={{ fontWeight: 570, textAlign: 'left' }}
                        onClick={() => onSelect(r.name, tab === 'artists' ? 'artist' : 'show')}
                        className="link"
                      >
                        {r.name}
                      </button>
                    ) : (
                      <span style={{ fontWeight: 550 }}>{r.name}</span>
                    )}
                  </td>
                  <td style={{ color: 'var(--text-secondary)', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {isEntity ? (r.topChild?.name ?? '—') : (r.artist || '—')}
                  </td>
                  <td className="num">
                    {isEntity ? num(r.children) : num(r.plays)}
                  </td>
                  <td className="num">{num(r.plays)}</td>
                  <td className="num" style={{ fontWeight: 600 }}>
                    {duration(r.ms)}
                  </td>
                  <td className="num" style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    {fmtDate(r.last.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          {filtered.length > 300 && (
            <div style={{ padding: '12px 14px', color: 'var(--text-muted)', fontSize: 13 }}>
              Showing the top 300 of {num(filtered.length)}. Narrow it with the search box.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
