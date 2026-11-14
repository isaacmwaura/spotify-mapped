/** Loading and decoding the dataset emitted by scripts/build-data.mjs. */

export const KIND = { MUSIC: 0, PODCAST: 1, BOOK: 2, OTHER: 3 } as const
export type Kind = 0 | 1 | 2 | 3

export const KIND_LABEL: Record<Kind, string> = {
  0: 'Music',
  1: 'Podcast',
  2: 'Audiobook',
  3: 'Other',
}

export const KIND_CLASS: Record<Kind, string> = {
  0: 'music',
  1: 'podcast',
  2: 'book',
  3: '',
}

export interface Play {
  i: number
  /**
   * When the play STARTED, in Unix seconds. Spotify only records when a play
   * stopped ("ts"), so this is worked out as stop time minus time played.
   */
  start: number
  /** When the play stopped, in Unix seconds: Spotify's own "ts". */
  end: number
  /** The start, as a date. Every date, hour and day below is based on it. */
  date: Date
  ms: number
  kind: Kind
  /** Track name, episode name or chapter title. */
  title: string
  /** Artist for music, show for podcasts and audiobooks. */
  parent: string
  album: string
  platform: string
  country: string
  reasonStart: string
  reasonEnd: string
  skipped: boolean
  shuffle: boolean
  offline: boolean
  incognito: boolean
  uri: string
  /** Local-time parts, precomputed — every pattern view needs these. */
  year: number
  month: number
  day: number
  hour: number
  weekday: number
  /** YYYY-MM-DD in local time. */
  dayKey: string
}

export interface Profile {
  displayName: string
  country: string | null
  created: string | null
  email: string | null
}

export interface LibraryItem {
  name?: string
  track?: string
  artist?: string
  album?: string
  publisher?: string
  show?: string
  uri?: string
}

export interface Dataset {
  generatedAt: string
  profile: Profile
  plays: Play[]
  library: {
    tracks: LibraryItem[]
    albums: LibraryItem[]
    artists: LibraryItem[]
    shows: LibraryItem[]
    episodes: number
  }
  playlists: { name: string; modified: string | null; count: number }[]
  searches: { query: string; time: string }[]
}

/** The packed form: what gets stored, and what the importer produces. */
export interface RawDataset {
  generatedAt: string
  profile: Profile
  pools: Record<string, string[]>
  uris: Record<string, string>
  plays: number[][]
  library: Dataset['library']
  playlists: Dataset['playlists']
  searches: Dataset['searches']
}

const F_SKIPPED = 1
const F_SHUFFLE = 2
const F_OFFLINE = 4
const F_INCOGNITO = 8

const pad = (n: number) => (n < 10 ? '0' + n : String(n))

/** Expands the packed dataset into the play objects every view works against. */
export function decodeDataset(raw: RawDataset): Dataset {
  const p = raw.pools
  const str = (pool: string[], i: number) => (i >= 0 ? pool[i] : '')

  const plays: Play[] = raw.plays.map((r, i) => {
    const kind = r[2] as Kind
    const titleIdx = r[3]
    const end = r[0]
    const start = end - Math.round(r[1] / 1000)
    const date = new Date(start * 1000)
    const uriKey =
      kind === KIND.MUSIC ? `track:${titleIdx}` : `episode:${titleIdx}`

    return {
      i,
      start,
      end,
      date,
      ms: r[1],
      kind,
      title: str(kind === KIND.MUSIC ? p.track : p.episode, titleIdx) || 'Unknown',
      parent: str(kind === KIND.MUSIC ? p.artist : p.show, r[4]) || 'Unknown',
      album: str(p.album, r[5]),
      platform: str(p.platform, r[6]),
      country: str(p.country, r[7]),
      reasonStart: str(p.reason, r[8]),
      reasonEnd: str(p.reason, r[9]),
      skipped: !!(r[10] & F_SKIPPED),
      shuffle: !!(r[10] & F_SHUFFLE),
      offline: !!(r[10] & F_OFFLINE),
      incognito: !!(r[10] & F_INCOGNITO),
      uri: raw.uris[uriKey] || '',
      year: date.getFullYear(),
      month: date.getMonth(),
      day: date.getDate(),
      hour: date.getHours(),
      weekday: date.getDay(),
      dayKey: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    }
  })

  // The file is in stop-time order. Re-sort by start so "oldest first",
  // "first played" and sessions all follow the order things actually began.
  plays.sort((a, b) => a.start - b.start || a.end - b.end)
  plays.forEach((play, idx) => (play.i = idx))

  return {
    generatedAt: raw.generatedAt,
    profile: raw.profile,
    plays,
    library: raw.library,
    playlists: raw.playlists,
    searches: raw.searches,
  }
}

/** spotify: URI -> open.spotify.com link, so rows are clickable. */
export function webUrl(uri: string): string | null {
  const m = /^spotify:(track|episode|album|artist|show):(.+)$/.exec(uri)
  return m ? `https://open.spotify.com/${m[1]}/${m[2]}` : null
}
