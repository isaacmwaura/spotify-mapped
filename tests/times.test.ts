/**
 * Spotify's `ts` is when a play STOPPED (its own readme: "a timestamp indicating
 * when the track stopped playing"). Everything the app shows about *when* you
 * listened must use the start instead: stop time minus time played.
 */
import { describe, expect, it } from 'vitest'
import { byHour, heatmap, rankArtists, sessions, summarise } from '../src/lib/stats'
import { EXT, analyse, record } from './scenarios'

const MIN = 60_000

function playsFrom(records: Record<string, unknown>[]) {
  return analyse([{ path: `${EXT}/Streaming_History_Audio_2024.json`, text: JSON.stringify(records) }]).data.plays
}

/** The real case from the review: a 92-minute episode that ran past midnight. */
const lateEpisode = record({
  stop: '2024-11-17T00:07:00Z', // Sunday 00:07 - all Spotify records
  ms: 92 * MIN,                 // so it began Saturday 22:35
  kind: 'podcast',
  title: '#451',
  parent: 'Long Show',
})

describe('start time, not stop time', () => {
  it('shows when you pressed play', () => {
    const [p] = playsFrom([lateEpisode])
    expect(p.date.toISOString()).toBe('2024-11-16T22:35:00.000Z')
    expect(p.hour).toBe(22)
  })

  it('files a play that ran past midnight under the day it started', () => {
    const [p] = playsFrom([lateEpisode])
    expect(p.dayKey).toBe('2024-11-16')
    expect(p.weekday).toBe(6) // Saturday
  })

  it('keeps the stop time available as well', () => {
    const [p] = playsFrom([lateEpisode])
    expect(p.end - p.start).toBe(92 * 60)
  })

  it('orders plays by when they started', () => {
    // A long play that stopped later but started earlier comes first.
    const short = record({ stop: '2024-03-01T10:00:00Z', ms: 5 * MIN, kind: 'music', title: 'Short', parent: 'A' })
    const long = record({ stop: '2024-03-01T10:30:00Z', ms: 60 * MIN, kind: 'podcast', title: 'Long', parent: 'B' })
    const plays = playsFrom([short, long])
    expect(plays.map((p) => p.title)).toEqual(['Long', 'Short'])
    expect(summarise(plays).first?.title).toBe('Long')
  })

  it('an artist\'s "first played" uses start times', () => {
    const a = record({ stop: '2024-03-01T10:00:00Z', ms: 2 * MIN, kind: 'music', title: 'One', parent: 'Band', uri: 'spotify:track:1' })
    const b = record({ stop: '2024-03-01T10:20:00Z', ms: 40 * MIN, kind: 'music', title: 'Two', parent: 'Band', uri: 'spotify:track:2' })
    const [band] = rankArtists(playsFrom([a, b]))
    expect(band.first.title).toBe('Two')
  })
})

describe('the heat map and hour chart count every hour a play covered', () => {
  it('spreads 92 minutes across 10 pm, 11 pm and midnight', () => {
    const { grid } = heatmap(playsFrom([lateEpisode]))
    expect(grid[6][22]).toBe(25 * MIN) // Saturday 22:35 to 23:00
    expect(grid[6][23]).toBe(60 * MIN) // Saturday 23:00 to 00:00
    expect(grid[0][0]).toBe(7 * MIN)   // Sunday 00:00 to 00:07
  })

  it('loses no listening time in the spreading', () => {
    const plays = playsFrom([lateEpisode])
    const total = heatmap(plays).grid.flat().reduce((a, b) => a + b, 0)
    expect(total).toBe(92 * MIN)
    expect(byHour(plays).reduce((a, b) => a + b, 0)).toBe(92 * MIN)
  })

  it('the hour chart agrees with the heat map', () => {
    const hours = byHour(playsFrom([lateEpisode]))
    expect(hours[22]).toBe(25 * MIN)
    expect(hours[23]).toBe(60 * MIN)
    expect(hours[0]).toBe(7 * MIN)
  })
})

describe('sessions measure silence from one stop to the next start', () => {
  it('a long episode started 5 minutes after a song is the same session', () => {
    const song = record({ stop: '2024-03-01T10:00:00Z', ms: 5 * MIN, kind: 'music', title: 'Song', parent: 'A' })
    const episode = record({ stop: '2024-03-01T11:20:00Z', ms: 75 * MIN, kind: 'podcast', title: 'Ep', parent: 'S' })
    const all = sessions(playsFrom([song, episode]))
    expect(all).toHaveLength(1)
    expect(all[0].ms).toBe(80 * MIN)
  })

  it('45 minutes of silence starts a new session', () => {
    const a = record({ stop: '2024-03-01T10:00:00Z', ms: 5 * MIN, kind: 'music', title: 'A', parent: 'X' })
    const b = record({ stop: '2024-03-01T10:50:00Z', ms: 5 * MIN, kind: 'music', title: 'B', parent: 'X' })
    expect(sessions(playsFrom([a, b]))).toHaveLength(2)
  })

  it('exactly 30 minutes of silence still counts as one session', () => {
    const a = record({ stop: '2024-03-01T10:00:00Z', ms: 5 * MIN, kind: 'music', title: 'A', parent: 'X' })
    const b = record({ stop: '2024-03-01T10:35:00Z', ms: 5 * MIN, kind: 'music', title: 'B', parent: 'X' })
    expect(sessions(playsFrom([a, b]))).toHaveLength(1)
  })
})
