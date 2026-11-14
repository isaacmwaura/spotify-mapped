/** When and how you listen — habits rather than favourites. */
import { useMemo } from 'react'
import type { Play } from '../lib/data'
import { WEEKDAYS, duration, hourLabel, hours, num } from '../lib/format'
import { byHour, byWeekday, countBy, heatmap, sessions, summarise } from '../lib/stats'
import { Card, Stat } from '../components/ui'
import { HeatLegend, Heatmap, HourChart, RankedBars } from '../components/Charts'

export function Patterns({ plays }: { plays: Play[] }) {
  const s = useMemo(() => summarise(plays), [plays])
  const hm = useMemo(() => heatmap(plays), [plays])
  const hourly = useMemo(() => byHour(plays), [plays])
  const sess = useMemo(() => sessions(plays), [plays])

  // Spread over the hours each play covered, the same way as the heat map.
  const weekdayTotals = useMemo(() => byWeekday(plays), [plays])

  const platforms = useMemo(
    () => countBy(plays, (p) => p.platform, (p) => p.ms),
    [plays],
  )
  const countries = useMemo(
    () => countBy(plays, (p) => p.country, (p) => p.ms),
    [plays],
  )
  const endReasons = useMemo(
    () => countBy(plays, (p) => p.reasonEnd, () => 1),
    [plays],
  )
  const startReasons = useMemo(
    () => countBy(plays, (p) => p.reasonStart, () => 1),
    [plays],
  )

  const peakHour = hourly.indexOf(Math.max(...hourly))
  const peakDay = weekdayTotals.indexOf(Math.max(...weekdayTotals))
  const avgSession = sess.length ? sess.reduce((a, x) => a + x.ms, 0) / sess.length : 0

  // Night owl vs early bird: 10pm–4am against 5am–11am.
  const night = hourly.slice(22).concat(hourly.slice(0, 5)).reduce((a, b) => a + b, 0)
  const morning = hourly.slice(5, 12).reduce((a, b) => a + b, 0)

  const REASONS: Record<string, string> = {
    trackdone: 'Played to the end',
    endplay: 'Stopped playback',
    fwdbtn: 'Skipped forward',
    backbtn: 'Went back',
    logout: 'Logged out / app closed',
    clickrow: 'Tapped it in a list',
    playbtn: 'Hit play',
    appload: 'Resumed on app open',
    remote: 'Controlled remotely',
    trackerror: 'Playback error',
    'unexpected-exit': 'App crashed',
    'unexpected-exit-while-paused': 'App closed while paused',
    unknown: 'Unknown',
    unplayed: 'Never started',
  }
  const label = (r: string) => REASONS[r] ?? r

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid grid-4">
        <Stat
          label="Peak hour"
          value={hourLabel(peakHour)}
          sub={`${hours(hourly[peakHour])} lifetime`}
        />
        <Stat
          label="Busiest day"
          value={WEEKDAYS[peakDay]}
          sub={`${hours(weekdayTotals[peakDay])} lifetime`}
        />
        <Stat
          label="Typical session"
          value={duration(avgSession)}
          sub={`${num(sess.length)} sessions, 30-min gap rule`}
        />
        <Stat
          label="Skip rate"
          value={`${(s.skipRate * 100).toFixed(1)}%`}
          sub={`${(s.shuffleShare * 100).toFixed(0)}% shuffled · ${(s.offlineShare * 100).toFixed(0)}% offline`}
        />
      </div>

      <Card
        title="When you listen"
        note="Each cell is one weekday-hour, shaded by total time. Times are local."
        action={<HeatLegend />}
      >
        <Heatmap grid={hm.grid} max={hm.max} />
      </Card>

      <Card
        title="Hour of day"
        note={
          night > morning
            ? `Night owl — ${hours(night)} between 10pm and 5am, against ${hours(morning)} in the morning.`
            : `Morning listener — ${hours(morning)} between 5am and noon, against ${hours(night)} late at night.`
        }
      >
        <HourChart data={hourly} />
      </Card>

      <div className="grid grid-2">
        <Card title="Where you play it" note="By time listened">
          <RankedBars
            max={platforms[0]?.[1] ?? 1}
            items={platforms.map(([name, ms]) => ({
              name,
              value: ms,
              display: duration(ms),
            }))}
          />
        </Card>

        <Card title="Days of the week" note="By time listened">
          <RankedBars
            max={Math.max(...weekdayTotals, 1)}
            items={WEEKDAYS.map((d, i) => ({
              name: d,
              value: weekdayTotals[i],
              display: duration(weekdayTotals[i]),
            })).sort((a, b) => b.value - a.value)}
          />
        </Card>

        <Card title="How plays start" note="Share of all plays">
          <RankedBars
            max={startReasons[0]?.[1] ?? 1}
            items={startReasons.slice(0, 7).map(([r, n]) => ({
              name: label(r),
              value: n,
              display: `${((n / plays.length) * 100).toFixed(0)}%`,
            }))}
          />
        </Card>

        <Card title="How plays end" note="Share of all plays">
          <RankedBars
            max={endReasons[0]?.[1] ?? 1}
            items={endReasons.slice(0, 7).map(([r, n]) => ({
              name: label(r),
              value: n,
              display: `${((n / plays.length) * 100).toFixed(0)}%`,
            }))}
          />
        </Card>
      </div>

      {countries.length > 1 && (
        <Card
          title="Where in the world"
          note="Connection country recorded with each play — a rough travel log"
        >
          <RankedBars
            max={countries[0][1]}
            items={countries.map(([c, ms]) => ({
              name: c,
              value: ms,
              display: duration(ms),
            }))}
          />
        </Card>
      )}
    </div>
  )
}
