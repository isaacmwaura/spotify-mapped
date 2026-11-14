/** Aggregations over the play log. Everything here is pure and memoisable. */

import { KIND, type Kind, type Play } from './data'

export interface Entity {
  name: string
  ms: number
  plays: number
  /** Distinct tracks for an artist, distinct episodes for a show. */
  children: number
  first: Play
  last: Play
  skips: number
  topChild: { name: string; ms: number; plays: number } | null
}

export interface Summary {
  plays: number
  ms: number
  music: { ms: number; plays: number }
  podcast: { ms: number; plays: number }
  book: { ms: number; plays: number }
  artists: number
  tracks: number
  shows: number
  episodes: number
  /** Distinct audiobook titles. */
  books: number
  first: Play | null
  last: Play | null
  activeDays: number
  spanDays: number
  skipRate: number
  shuffleShare: number
  offlineShare: number
}

export function summarise(plays: Play[]): Summary {
  const s: Summary = {
    plays: plays.length,
    ms: 0,
    music: { ms: 0, plays: 0 },
    podcast: { ms: 0, plays: 0 },
    book: { ms: 0, plays: 0 },
    artists: 0,
    tracks: 0,
    shows: 0,
    episodes: 0,
    books: 0,
    first: null,
    last: null,
    activeDays: 0,
    spanDays: 0,
    skipRate: 0,
    shuffleShare: 0,
    offlineShare: 0,
  }
  if (!plays.length) return s

  const artists = new Set<string>()
  const tracks = new Set<string>()
  const shows = new Set<string>()
  const episodes = new Set<string>()
  const books = new Set<string>()
  const days = new Set<string>()
  let skipped = 0
  let shuffled = 0
  let offline = 0

  for (const p of plays) {
    s.ms += p.ms
    days.add(p.dayKey)
    if (p.skipped) skipped++
    if (p.shuffle) shuffled++
    if (p.offline) offline++

    if (p.kind === KIND.MUSIC) {
      s.music.ms += p.ms
      s.music.plays++
      artists.add(p.parent)
      tracks.add(`${p.parent}${SEP}${p.title}`)
    } else if (p.kind === KIND.PODCAST) {
      s.podcast.ms += p.ms
      s.podcast.plays++
      shows.add(p.parent)
      episodes.add(`${p.parent}${SEP}${p.title}`)
    } else if (p.kind === KIND.BOOK) {
      s.book.ms += p.ms
      s.book.plays++
      books.add(p.parent)
      episodes.add(p.parent + ' ' + p.title)
    }
  }

  s.artists = artists.size
  s.tracks = tracks.size
  s.shows = shows.size
  s.episodes = episodes.size
  s.books = books.size
  s.first = plays[0]
  s.last = plays[plays.length - 1]
  s.activeDays = days.size
  s.spanDays =
    Math.round((s.last.date.getTime() - s.first.date.getTime()) / 86_400_000) + 1
  s.skipRate = skipped / plays.length
  s.shuffleShare = shuffled / plays.length
  s.offlineShare = offline / plays.length
  return s
}

/**
 * Rank artists (music) or shows (podcasts/books) by listening time.
 * `keyOf` picks the grouping field; `childOf` picks what counts as a child.
 */
export function rankEntities(
  plays: Play[],
  keyOf: (p: Play) => string,
  childOf: (p: Play) => string,
): Entity[] {
  const map = new Map<
    string,
    Entity & { childMap: Map<string, { ms: number; plays: number }> }
  >()

  for (const p of plays) {
    const key = keyOf(p)
    if (!key) continue
    let e = map.get(key)
    if (!e) {
      e = {
        name: key,
        ms: 0,
        plays: 0,
        children: 0,
        first: p,
        last: p,
        skips: 0,
        topChild: null,
        childMap: new Map(),
      }
      map.set(key, e)
    }
    e.ms += p.ms
    e.plays++
    if (p.skipped) e.skips++
    if (p.start < e.first.start) e.first = p
    if (p.start > e.last.start) e.last = p

    const child = childOf(p)
    if (child) {
      const c = e.childMap.get(child) || { ms: 0, plays: 0 }
      c.ms += p.ms
      c.plays++
      e.childMap.set(child, c)
    }
  }

  const out: Entity[] = []
  for (const e of map.values()) {
    e.children = e.childMap.size
    let top: Entity['topChild'] = null
    for (const [name, c] of e.childMap) {
      if (!top || c.ms > top.ms) top = { name, ms: c.ms, plays: c.plays }
    }
    e.topChild = top
    const { childMap: _drop, ...rest } = e
    void _drop
    out.push(rest)
  }
  out.sort((a, b) => b.ms - a.ms || b.plays - a.plays)
  return out
}

export const rankArtists = (plays: Play[]) =>
  rankEntities(
    plays.filter((p) => p.kind === KIND.MUSIC),
    (p) => p.parent,
    (p) => p.title,
  )

export const rankShows = (plays: Play[]) =>
  rankEntities(
    plays.filter((p) => p.kind === KIND.PODCAST || p.kind === KIND.BOOK),
    (p) => p.parent,
    (p) => p.title,
  )

/** Names contain spaces, so composite keys join on a delimiter they never do. */
const SEP = '\u0000'

const splitKey = (key: string): [string, string] => {
  const at = key.indexOf(SEP)
  return at === -1 ? [key, ''] : [key.slice(0, at), key.slice(at + 1)]
}

export const rankTracks = (plays: Play[]) =>
  rankEntities(
    plays.filter((p) => p.kind === KIND.MUSIC),
    (p) => `${p.title}${SEP}${p.parent}`,
    (p) => p.album,
  ).map((e) => {
    const [title, artist] = splitKey(e.name)
    return { ...e, name: title, artist }
  })

export const rankAlbums = (plays: Play[]) =>
  rankEntities(
    plays.filter((p) => p.kind === KIND.MUSIC && !!p.album),
    (p) => `${p.album}${SEP}${p.parent}`,
    (p) => p.title,
  ).map((e) => {
    const [album, artist] = splitKey(e.name)
    return { ...e, name: album, artist }
  })

export const rankEpisodes = (plays: Play[]) =>
  rankEntities(
    // Audiobook chapters belong here too — rankShows already counts their books.
    plays.filter((p) => p.kind === KIND.PODCAST || p.kind === KIND.BOOK),
    (p) => `${p.title}${SEP}${p.parent}`,
    () => '',
  ).map((e) => {
    const [title, show] = splitKey(e.name)
    return { ...e, name: title, artist: show }
  })

/* ------------------------------------------------------------ time series */

export interface MonthBucket {
  key: string
  date: Date
  musicMs: number
  podcastMs: number
  otherMs: number
  plays: number
}

/** One bucket per calendar month across the whole span, gaps included. */
export function byMonth(plays: Play[]): MonthBucket[] {
  if (!plays.length) return []
  const map = new Map<string, MonthBucket>()
  const first = plays[0].date
  const last = plays[plays.length - 1].date

  const cursor = new Date(first.getFullYear(), first.getMonth(), 1)
  const end = new Date(last.getFullYear(), last.getMonth(), 1)
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${cursor.getMonth()}`
    map.set(key, {
      key,
      date: new Date(cursor),
      musicMs: 0,
      podcastMs: 0,
      otherMs: 0,
      plays: 0,
    })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const p of plays) {
    const b = map.get(`${p.year}-${p.month}`)
    if (!b) continue
    b.plays++
    if (p.kind === KIND.MUSIC) b.musicMs += p.ms
    else if (p.kind === KIND.PODCAST) b.podcastMs += p.ms
    else b.otherMs += p.ms
  }
  return [...map.values()]
}

/**
 * Calls `add` once for every clock hour a play covered, with the milliseconds
 * spent in that hour. A 92-minute episode from 22:35 gives three slices:
 * 25 minutes at 22:00, 60 at 23:00 and 7 at 00:00 the next day.
 * Uses the device's local clock, so daylight-saving changes are handled.
 */
export function forEachHourSlice(
  p: Play,
  add: (weekday: number, hour: number, ms: number) => void,
): void {
  const endMs = p.start * 1000 + p.ms
  let t = p.start * 1000
  // A guard against corrupt records: no single play spans more than a few days.
  for (let n = 0; t < endMs && n < 200; n++) {
    const d = new Date(t)
    const next = new Date(t)
    next.setMinutes(60, 0, 0) // the next o'clock
    const sliceEnd = Math.min(endMs, next.getTime())
    add(d.getDay(), d.getHours(), sliceEnd - t)
    t = sliceEnd
  }
}

/** 7 x 24 grid of listening time, in local time, each play spread over its hours. */
export function heatmap(plays: Play[]): { grid: number[][]; max: number } {
  const grid = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const p of plays) {
    forEachHourSlice(p, (weekday, hour, ms) => {
      grid[weekday][hour] += ms
    })
  }
  let max = 0
  for (const row of grid) for (const v of row) if (v > max) max = v
  return { grid, max }
}

/** Listening time per hour of day, each play spread over its hours. */
export function byHour(plays: Play[]): number[] {
  const out = new Array(24).fill(0)
  for (const p of plays) {
    forEachHourSlice(p, (_weekday, hour, ms) => {
      out[hour] += ms
    })
  }
  return out
}

/** Listening time per weekday (0 = Sunday), each play spread over its hours. */
export function byWeekday(plays: Play[]): number[] {
  const out = new Array(7).fill(0)
  for (const p of plays) {
    forEachHourSlice(p, (weekday, _hour, ms) => {
      out[weekday] += ms
    })
  }
  return out
}

export interface DayBucket {
  key: string
  date: Date
  ms: number
  plays: number
}

export function byDay(plays: Play[]): Map<string, DayBucket> {
  const map = new Map<string, DayBucket>()
  for (const p of plays) {
    let b = map.get(p.dayKey)
    if (!b) {
      b = {
        key: p.dayKey,
        date: new Date(p.year, p.month, p.day),
        ms: 0,
        plays: 0,
      }
      map.set(p.dayKey, b)
    }
    b.ms += p.ms
    b.plays++
  }
  return map
}

/** Longest run of consecutive calendar days with at least one play. */
export function longestStreak(plays: Play[]): { days: number; from: Date; to: Date } | null {
  const days = [...byDay(plays).values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  )
  if (!days.length) return null

  let best = { days: 1, from: days[0].date, to: days[0].date }
  let runStart = 0
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round(
      (days[i].date.getTime() - days[i - 1].date.getTime()) / 86_400_000,
    )
    if (gap !== 1) runStart = i
    const len = i - runStart + 1
    if (len > best.days) {
      best = { days: len, from: days[runStart].date, to: days[i].date }
    }
  }
  return best
}

/**
 * Group plays into listening sessions — a gap longer than `gapMinutes` between
 * one play starting and the next ends the session.
 */
export function sessions(plays: Play[], gapMinutes = 30) {
  const gap = gapMinutes * 60
  type Session = { start: Play; end: Play; ms: number; count: number; stoppedAt: number }
  const out: Session[] = []
  let cur: Session | null = null

  // Plays arrive in start order. The silence before a play is its start minus
  // the latest moment anything in the current session was still playing.
  for (const p of plays) {
    if (cur && p.start - cur.stoppedAt <= gap) {
      cur.end = p
      cur.ms += p.ms
      cur.count++
      cur.stoppedAt = Math.max(cur.stoppedAt, p.end)
    } else {
      if (cur) out.push(cur)
      cur = { start: p, end: p, ms: p.ms, count: 1, stoppedAt: p.end }
    }
  }
  if (cur) out.push(cur)
  return out
}

export function countBy<T>(items: T[], key: (t: T) => string, weight: (t: T) => number) {
  const map = new Map<string, number>()
  for (const it of items) {
    const k = key(it)
    if (!k) continue
    map.set(k, (map.get(k) || 0) + weight(it))
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
}

export const years = (plays: Play[]): number[] => {
  const set = new Set(plays.map((p) => p.year))
  return [...set].sort((a, b) => a - b)
}

/** Case- and diacritic-insensitive haystack for the history search. */
export function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export const kindLabelOf = (k: Kind) =>
  k === KIND.MUSIC ? 'Music' : k === KIND.PODCAST ? 'Podcast' : k === KIND.BOOK ? 'Audiobook' : 'Other'
