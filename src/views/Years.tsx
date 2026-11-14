/** Year-by-year comparison — your own Wrapped, for every year at once. */
import { useMemo } from 'react'
import type { Play } from '../lib/data'
import { duration, hours, num } from '../lib/format'
import { rankArtists, rankShows, rankTracks, summarise } from '../lib/stats'
import { Card } from '../components/ui'

export function Years({
  plays,
  years,
  onSelect,
}: {
  plays: Play[]
  years: number[]
  onSelect: (name: string, kind: 'artist' | 'show') => void
}) {
  const byYear = useMemo(
    () =>
      [...years].reverse().map((year) => {
        const scoped = plays.filter((p) => p.year === year)
        return {
          year,
          scoped,
          s: summarise(scoped),
          artists: rankArtists(scoped).slice(0, 5),
          shows: rankShows(scoped).slice(0, 5),
          // Ranked by play count, not time — the heading promises "most played".
          tracks: rankTracks(scoped)
            .sort((a, b) => b.plays - a.plays || b.ms - a.ms)
            .slice(0, 5),
        }
      }),
    [plays, years],
  )

  const maxMs = Math.max(...byYear.map((y) => y.s.ms), 1)

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card title="Year on year" note="Total listening time, all types">
        <div className="stack" style={{ gap: 12 }}>
          {byYear.map((y) => {
            const musicPct = y.s.ms ? (y.s.music.ms / y.s.ms) * 100 : 0
            return (
              <div key={y.year}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: 5,
                  }}
                >
                  <b style={{ fontSize: 15 }}>{y.year}</b>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                    <b style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                      {hours(y.s.ms)}
                    </b>{' '}
                    · {num(y.s.plays)} plays · {num(y.s.activeDays)} active days
                  </span>
                </div>
                {/* Stacked proportion bar: podcasts then music, 2px surface gap. */}
                <div
                  style={{
                    display: 'flex',
                    gap: 2,
                    height: 10,
                    width: `${Math.max((y.s.ms / maxMs) * 100, 2)}%`,
                  }}
                  title={`${hours(y.s.podcast.ms)} podcasts, ${hours(y.s.music.ms)} music`}
                >
                  <span
                    style={{
                      flex: `0 0 ${100 - musicPct}%`,
                      background: 'var(--series-2)',
                      borderRadius: '4px 0 0 4px',
                    }}
                  />
                  <span
                    style={{
                      flex: `0 0 calc(${musicPct}% - 2px)`,
                      background: 'var(--series-1)',
                      borderRadius: '0 4px 4px 0',
                    }}
                  />
                </div>
              </div>
            )
          })}
        </div>
        <div className="legend" style={{ marginTop: 14 }}>
          <span className="legend-item">
            <span className="dot" style={{ background: 'var(--series-2)' }} />
            Podcasts
          </span>
          <span className="legend-item">
            <span className="dot" style={{ background: 'var(--series-1)' }} />
            Music
          </span>
        </div>
      </Card>

      {byYear.map((y) => (
        <Card
          key={y.year}
          title={String(y.year)}
          note={`${hours(y.s.ms)} · ${num(y.s.plays)} plays · ${num(y.s.artists)} artists · ${num(y.s.shows)} shows`}
        >
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 18 }}>
            <YearList
              label="Top artists"
              items={y.artists.map((a) => ({ name: a.name, value: duration(a.ms) }))}
              onSelect={(n) => onSelect(n, 'artist')}
            />
            <YearList
              label="Top shows"
              items={y.shows.map((a) => ({ name: a.name, value: duration(a.ms) }))}
              onSelect={(n) => onSelect(n, 'show')}
            />
            <YearList
              label="Most played tracks"
              items={y.tracks.map((t) => ({
                name: t.name,
                sub: t.artist,
                value: `${num(t.plays)}×`,
              }))}
            />
          </div>

          <div
            style={{
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px 26px',
              color: 'var(--text-secondary)',
              fontSize: 13,
            }}
          >
            <span>
              First play: <b>{y.s.first?.title}</b>
            </span>
            <span>
              Skip rate: <b>{(y.s.skipRate * 100).toFixed(0)}%</b>
            </span>
            <span>
              Music vs podcasts:{' '}
              <b>
                {hours(y.s.music.ms)} / {hours(y.s.podcast.ms)}
              </b>
            </span>
            <span>
              Longest play:{' '}
              <b>{duration(Math.max(...y.scoped.map((p) => p.ms), 0))}</b>
            </span>
          </div>
        </Card>
      ))}
    </div>
  )
}

function YearList({
  label,
  items,
  onSelect,
}: {
  label: string
  items: { name: string; sub?: string; value: string }[]
  onSelect?: (name: string) => void
}) {
  return (
    <div>
      <div className="stat-label" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.length === 0 && (
          <li style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nothing this year</li>
        )}
        {items.map((it, i) => (
          <li
            key={it.name + i}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'baseline',
              padding: '5px 0',
              borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            }}
          >
            <span style={{ color: 'var(--text-muted)', fontSize: 12, width: 12, flex: 'none' }}>
              {i + 1}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span
                style={{
                  display: 'block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 550,
                  cursor: onSelect ? 'pointer' : 'default',
                }}
                onClick={() => onSelect?.(it.name)}
                title={it.name}
              >
                {it.name}
              </span>
              {it.sub && (
                <span
                  style={{
                    display: 'block',
                    fontSize: 12,
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {it.sub}
                </span>
              )}
            </span>
            <span
              style={{
                fontVariantNumeric: 'tabular-nums',
                fontSize: 13,
                fontWeight: 600,
                flex: 'none',
              }}
            >
              {it.value}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}
