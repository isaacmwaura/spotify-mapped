import { useMemo } from 'react'
import type { Dataset, Play } from '../lib/data'
import { duration, fmtDate, hours, num, relativeDays, toHours } from '../lib/format'
import {
  byDay,
  byMonth,
  longestStreak,
  rankArtists,
  rankShows,
  rankTracks,
  sessions,
  summarise,
} from '../lib/stats'
import { Card, Legend, Stat } from '../components/ui'
import { MonthlyChart, RankedBars } from '../components/Charts'

export function Overview({
  data,
  plays,
  onSelect,
  onGoto,
}: {
  data: Dataset
  plays: Play[]
  onSelect: (name: string, kind: 'artist' | 'show') => void
  onGoto: (view: string) => void
}) {
  const s = useMemo(() => summarise(plays), [plays])
  const months = useMemo(() => byMonth(plays), [plays])
  const artists = useMemo(() => rankArtists(plays), [plays])
  const shows = useMemo(() => rankShows(plays), [plays])
  const tracks = useMemo(() => rankTracks(plays), [plays])
  const streak = useMemo(() => longestStreak(plays), [plays])
  const days = useMemo(() => byDay(plays), [plays])

  const biggestDay = useMemo(() => {
    let best: { key: string; date: Date; ms: number; plays: number } | null = null
    for (const d of days.values()) if (!best || d.ms > best.ms) best = d
    return best
  }, [days])

  const longestSession = useMemo(() => {
    const all = sessions(plays)
    return all.reduce<(typeof all)[number] | null>(
      (best, x) => (!best || x.ms > best.ms ? x : best),
      null,
    )
  }, [plays])

  if (!s.first || !s.last) return null

  const totalHours = toHours(s.ms)
  // Audiobooks are spoken word too. Folding them in keeps the two headline
  // cards adding up to the hero figure for people who listen to books.
  const spokenMs = s.podcast.ms + s.book.ms
  const spokenShare = s.ms ? (spokenMs / s.ms) * 100 : 0
  const hasBooks = s.book.plays > 0
  const perActiveDay = s.activeDays ? s.ms / s.activeDays : 0
  const daysOfLife = totalHours / 24

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <div className="hero">
          <div>
            <div className="stat-label">All-time listening</div>
            <div className="hero-figure">
              {num(totalHours)}
              <span className="hero-unit">hours</span>
            </div>
          </div>
          <p className="hero-note" style={{ margin: 0, maxWidth: '38ch' }}>
            That's <b>{daysOfLife.toFixed(1)} full days</b> of audio across{' '}
            <b>{num(s.plays)} plays</b> — every one of them from{' '}
            {fmtDate(s.first.date)} to {fmtDate(s.last.date)}.
          </p>
        </div>
      </Card>

      <div className="grid grid-4">
        <Stat
          label={hasBooks ? 'Podcasts & audiobooks' : 'Podcasts & talk'}
          value={hours(spokenMs)}
          sub={
            hasBooks
              ? `${spokenShare.toFixed(0)}% of your time · ${num(s.shows)} shows · ${num(s.books)} books`
              : `${spokenShare.toFixed(0)}% of your time · ${num(s.shows)} shows`
          }
        />
        <Stat
          label="Music"
          value={hours(s.music.ms)}
          sub={`${num(s.artists)} artists · ${num(s.tracks)} tracks`}
        />
        <Stat
          label="Days with listening"
          value={num(s.activeDays)}
          sub={`of ${num(s.spanDays)} days (${Math.round((s.activeDays / s.spanDays) * 100)}%)`}
        />
        <Stat
          label="On an active day"
          value={duration(perActiveDay)}
          sub="average across those days"
        />
      </div>

      <Card
        title="Listening over time"
        note="Stacked by type, one column per month, local time"
        action={
          <Legend
            items={[
              { color: 'var(--series-2)', label: 'Podcasts' },
              { color: 'var(--series-1)', label: 'Music' },
            ]}
          />
        }
      >
        <MonthlyChart data={months} height={220} />
      </Card>

      <div className="grid grid-2">
        <Card
          title="Top artists"
          note="By time listened, all time"
          action={
            <button className="icon-btn" onClick={() => onGoto('top')}>
              See all
            </button>
          }
        >
          <RankedBars
            max={artists[0]?.ms ?? 1}
            onSelect={(name) => onSelect(name, 'artist')}
            items={artists.slice(0, 8).map((a) => ({
              name: a.name,
              sub: `${num(a.plays)} plays · ${num(a.children)} tracks`,
              value: a.ms,
              display: duration(a.ms),
            }))}
          />
        </Card>

        <Card
          title="Top shows"
          note="By time listened, all time"
          action={
            <button className="icon-btn" onClick={() => onGoto('top')}>
              See all
            </button>
          }
        >
          <RankedBars
            max={shows[0]?.ms ?? 1}
            onSelect={(name) => onSelect(name, 'show')}
            items={shows.slice(0, 8).map((a) => ({
              name: a.name,
              sub: `${num(a.plays)} plays · ${num(a.children)} episodes`,
              value: a.ms,
              display: duration(a.ms),
            }))}
          />
        </Card>
      </div>

      <Card title="Moments worth remembering" note="Pulled from the full play log">
        <div className="grid grid-2" style={{ gap: 12 }}>
          <Moment
            label="The very first thing you played"
            headline={s.first.title}
            detail={`${s.first.parent} — ${fmtDate(s.first.date)}, ${relativeDays(s.first.date, new Date())}`}
          />
          <Moment
            label="Most recent play"
            headline={s.last.title}
            detail={`${s.last.parent} — ${fmtDate(s.last.date)}, ${relativeDays(s.last.date, new Date())}`}
          />
          {biggestDay && (
            <Moment
              label="Heaviest listening day"
              headline={duration(biggestDay.ms)}
              detail={`${fmtDate(biggestDay.date)} — ${num(biggestDay.plays)} plays in one day`}
            />
          )}
          {longestSession && (
            <Moment
              label="Longest unbroken session"
              headline={duration(longestSession.ms)}
              detail={`${fmtDate(longestSession.start.date)} — ${num(longestSession.count)} items back to back, starting with "${longestSession.start.title}"`}
            />
          )}
          {streak && (
            <Moment
              label="Longest daily streak"
              headline={`${streak.days} days in a row`}
              detail={`${fmtDate(streak.from)} → ${fmtDate(streak.to)}`}
            />
          )}
          {tracks[0] && (
            <Moment
              label="Most played track"
              headline={tracks[0].name}
              detail={`${tracks[0].artist} — ${num(tracks[0].plays)} plays, ${duration(tracks[0].ms)}`}
            />
          )}
        </div>
      </Card>

      <Card title="Your account" note={`Data exported ${fmtDate(new Date(data.generatedAt))}`}>
        <div className="grid grid-4" style={{ gap: 12 }}>
          <Mini label="Profile" value={data.profile.displayName} />
          <Mini
            label="Account created"
            value={data.profile.created ? fmtDate(new Date(data.profile.created)) : '—'}
          />
          <Mini label="Saved to library" value={`${num(data.library.episodes)} episodes`} />
          <Mini
            label="Following"
            value={`${num(data.library.shows)} shows · ${num(data.library.artists)} artists`}
          />
        </div>
      </Card>
    </div>
  )
}

function Moment({
  label,
  headline,
  detail,
}: {
  label: string
  headline: string
  detail: string
}) {
  return (
    <div
      style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '12px 14px',
        background: 'var(--surface-2)',
      }}
    >
      <div className="stat-label">{label}</div>
      <div
        style={{
          fontWeight: 620,
          fontSize: 15,
          marginTop: 4,
          letterSpacing: '-0.01em',
        }}
      >
        {headline}
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginTop: 2 }}>
        {detail}
      </div>
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="stat-label">{label}</div>
      <div style={{ fontWeight: 580, marginTop: 3 }}>{value}</div>
    </div>
  )
}
