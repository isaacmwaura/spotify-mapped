/**
 * Turns the files from a Spotify data export into the packed dataset the app
 * renders. Runs entirely in the browser — nothing is uploaded anywhere.
 *
 * Accepts the extended streaming history (the good one), and falls back to the
 * basic StreamingHistory files if that's all the export contains.
 */
import type { RawDataset } from './data'

export interface ImportFile {
  /** Path as it appeared in the folder or zip, used to identify the file. */
  path: string
  text: string
}

export interface ImportReport {
  plays: number
  duplicates: number
  streamingFiles: string[]
  accountFiles: string[]
  ignored: number
  source: 'extended' | 'basic'
  warnings: string[]
}

export class ImportError extends Error {}

/* ------------------------------------------------------------ file matching */

const baseName = (p: string) => p.split(/[\\/]/).pop() || p

const isExtendedStream = (p: string) =>
  /^Streaming_History_(Audio|Video)_.*\.json$/i.test(baseName(p))

const isBasicStream = (p: string) =>
  /^StreamingHistory_(music|podcast|video)_\d+\.json$/i.test(baseName(p))

const accountFile = (p: string, name: string) =>
  baseName(p).toLowerCase() === name.toLowerCase()

const isPlaylistFile = (p: string) => /^Playlist\d*\.json$/i.test(baseName(p))

/** Files we should never try to parse — huge telemetry logs, PDFs, images. */
export function isRelevant(path: string): boolean {
  const b = baseName(path)
  if (!/\.json$/i.test(b)) return false
  if (isExtendedStream(b) || isBasicStream(b) || isPlaylistFile(b)) return true
  return [
    'UserAttributes.json',
    'Identity.json',
    'YourLibrary.json',
    'SearchQueries.json',
    'Marquee.json',
  ].some((n) => accountFile(b, n))
}

/* ---------------------------------------------------------------- interning */

function makePool() {
  const index = new Map<string, number>()
  const values: string[] = []
  return {
    values,
    id(value: unknown): number {
      if (typeof value !== 'string' || value === '') return -1
      let i = index.get(value)
      if (i === undefined) {
        i = values.length
        values.push(value)
        index.set(value, i)
      }
      return i
    },
  }
}

const F_SKIPPED = 1
const F_SHUFFLE = 2
const F_OFFLINE = 4
const F_INCOGNITO = 8

function normalisePlatform(p: unknown): string {
  if (typeof p !== 'string' || !p) return 'Unknown'
  const s = p.toLowerCase()
  if (s.includes('android')) return 'Android'
  if (s.includes('ios') || s.includes('iphone') || s.includes('ipad')) return 'iOS'
  if (s.includes('windows')) return 'Windows'
  if (s.includes('mac') || s.includes('osx')) return 'Mac'
  if (s.includes('web')) return 'Web player'
  if (s.includes('linux')) return 'Linux'
  if (s.includes('cast') || s.includes('partner')) return 'Cast / device'
  return p
}

/* --------------------------------------------------------------- the record */

interface StreamRow {
  ts?: string
  endTime?: string
  platform?: string
  ms_played?: number
  msPlayed?: number
  conn_country?: string
  master_metadata_track_name?: string | null
  master_metadata_album_artist_name?: string | null
  master_metadata_album_album_name?: string | null
  spotify_track_uri?: string | null
  episode_name?: string | null
  episode_show_name?: string | null
  spotify_episode_uri?: string | null
  audiobook_title?: string | null
  audiobook_uri?: string | null
  audiobook_chapter_title?: string | null
  audiobook_chapter_uri?: string | null
  reason_start?: string
  reason_end?: string
  shuffle?: boolean
  skipped?: boolean
  offline?: boolean
  incognito_mode?: boolean
  // basic export shape
  artistName?: string
  trackName?: string
  podcastName?: string
  episodeName?: string
}

function parseJSON(file: ImportFile): unknown {
  try {
    return JSON.parse(file.text)
  } catch {
    throw new ImportError(`${baseName(file.path)} is not valid JSON.`)
  }
}

export function buildRawDataset(files: ImportFile[]): {
  raw: RawDataset
  report: ImportReport
} {
  const warnings: string[] = []
  const relevant = files.filter((f) => isRelevant(f.path))
  const ignored = files.length - relevant.length

  let streamFiles = relevant.filter((f) => isExtendedStream(f.path))
  let source: ImportReport['source'] = 'extended'

  if (!streamFiles.length) {
    streamFiles = relevant.filter((f) => isBasicStream(f.path))
    source = 'basic'
    if (streamFiles.length) {
      warnings.push(
        'Only the basic streaming history was found. It covers about the last year ' +
          'and has no device, shuffle or skip information. Request the ' +
          '"Extended streaming history" from Spotify for the full picture.',
      )
    }
  }

  if (!streamFiles.length) {
    throw new ImportError(
      'No streaming history found. Look for a folder called ' +
        '"Spotify Extended Streaming History" containing Streaming_History_Audio_*.json ' +
        'and select that (or the whole export folder or zip).',
    )
  }

  const rawRows: StreamRow[] = []
  for (const f of streamFiles) {
    const parsed = parseJSON(f)
    if (!Array.isArray(parsed)) {
      warnings.push(`${baseName(f.path)} was skipped — expected a list of plays.`)
      continue
    }
    rawRows.push(...(parsed as StreamRow[]))
  }

  // The export ships overlapping year files (a 2025 file can contain 2024 rows),
  // so the same play shows up more than once. Identity = time + item + duration.
  const seen = new Set<string>()
  const plays: StreamRow[] = []
  for (const r of rawRows) {
    const when = r.ts ?? r.endTime ?? ''
    const uri =
      r.spotify_track_uri ||
      r.spotify_episode_uri ||
      r.audiobook_chapter_uri ||
      r.trackName ||
      r.episodeName ||
      ''
    const ms = r.ms_played ?? r.msPlayed ?? 0
    const key = `${when}|${uri}|${ms}`
    if (seen.has(key)) continue
    seen.add(key)
    plays.push(r)
  }

  const timeOf = (r: StreamRow) => {
    const s = r.ts ?? r.endTime ?? ''
    // The basic export uses "2025-01-31 20:14" (UTC, no zone marker).
    const t = Date.parse(r.ts ? s : s.replace(' ', 'T') + 'Z')
    return Number.isFinite(t) ? t : 0
  }

  plays.sort((a, b) => timeOf(a) - timeOf(b))

  const trackPool = makePool()
  const artistPool = makePool()
  const albumPool = makePool()
  const episodePool = makePool()
  const showPool = makePool()
  const platformPool = makePool()
  const countryPool = makePool()
  const reasonPool = makePool()

  const uris: Record<string, string> = {}
  const rememberUri = (kind: string, id: number, uri?: string | null) => {
    if (id < 0 || !uri) return
    const k = `${kind}:${id}`
    if (!(k in uris)) uris[k] = uri
  }

  const rows: number[][] = []
  let dropped = 0

  for (const r of plays) {
    const time = timeOf(r)
    if (!time) {
      dropped++
      continue
    }

    const trackName = r.master_metadata_track_name ?? r.trackName ?? null
    const artistName = r.master_metadata_album_artist_name ?? r.artistName ?? null
    const episodeName = r.episode_name ?? r.episodeName ?? null
    const showName = r.episode_show_name ?? r.podcastName ?? null

    const isMusic = !!(r.spotify_track_uri || (trackName && !episodeName))
    const isPodcast = !!(r.spotify_episode_uri || episodeName)
    const isBook = !!(r.audiobook_uri || r.audiobook_chapter_uri)

    // 0 = music, 1 = podcast, 2 = audiobook, 3 = other
    const kind = isMusic ? 0 : isPodcast ? 1 : isBook ? 2 : 3

    const title =
      kind === 0
        ? trackPool.id(trackName)
        : kind === 1
          ? episodePool.id(episodeName)
          : episodePool.id(r.audiobook_chapter_title)

    const parent =
      kind === 0
        ? artistPool.id(artistName)
        : kind === 1
          ? showPool.id(showName)
          : showPool.id(r.audiobook_title)

    if (title < 0 && parent < 0) {
      dropped++
      continue
    }

    if (kind === 0) rememberUri('track', title, r.spotify_track_uri)
    else if (kind === 1) rememberUri('episode', title, r.spotify_episode_uri)

    let flags = 0
    if (r.skipped) flags |= F_SKIPPED
    if (r.shuffle) flags |= F_SHUFFLE
    if (r.offline) flags |= F_OFFLINE
    if (r.incognito_mode) flags |= F_INCOGNITO

    rows.push([
      Math.floor(time / 1000),
      (r.ms_played ?? r.msPlayed ?? 0) | 0,
      kind,
      title,
      parent,
      kind === 0 ? albumPool.id(r.master_metadata_album_album_name) : -1,
      platformPool.id(normalisePlatform(r.platform)),
      countryPool.id(r.conn_country),
      reasonPool.id(r.reason_start),
      reasonPool.id(r.reason_end),
      flags,
    ])
  }

  if (dropped) {
    warnings.push(`${dropped} record${dropped === 1 ? '' : 's'} had no usable timestamp or title and were left out.`)
  }
  if (!rows.length) {
    throw new ImportError('The streaming history files were found but contained no plays.')
  }

  /* ------------------------------------------------------- account extras -- */

  const findFile = (name: string) => relevant.find((f) => accountFile(f.path, name))
  const readObj = (name: string): Record<string, unknown> => {
    const f = findFile(name)
    if (!f) return {}
    const v = parseJSON(f)
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
  }

  const attrs = readObj('UserAttributes.json')
  const identity = readObj('Identity.json')
  const library = readObj('YourLibrary.json')

  const asList = (v: unknown) => (Array.isArray(v) ? v : [])

  const playlists: RawDataset['playlists'] = []
  for (const f of relevant.filter((x) => isPlaylistFile(x.path))) {
    const parsed = parseJSON(f) as { playlists?: unknown }
    for (const p of asList(parsed?.playlists) as Record<string, unknown>[]) {
      playlists.push({
        name: String(p.name ?? 'Untitled'),
        modified: (p.lastModifiedDate as string) ?? null,
        count: asList(p.items).length,
      })
    }
  }

  // Search terms arrive as every keystroke ("c", "co", "cop"), so collapse each
  // prefix chain down to the longest form the user actually typed.
  const searchFile = findFile('SearchQueries.json')
  const searches: RawDataset['searches'] = []
  if (searchFile) {
    const list = asList(parseJSON(searchFile)) as Record<string, string>[]
    const byTime = list
      .filter((s) => s.searchQuery)
      .sort((a, b) => String(a.searchTime).localeCompare(String(b.searchTime)))
    const kept: { q: string; t: string }[] = []
    for (const s of byTime) {
      const q = s.searchQuery.trim()
      if (!q) continue
      const prev = kept[kept.length - 1]
      if (prev && (q.startsWith(prev.q) || prev.q.startsWith(q))) {
        if (q.length > prev.q.length) kept[kept.length - 1] = { q, t: s.searchTime }
        continue
      }
      kept.push({ q, t: s.searchTime })
    }
    searches.push(...kept.reverse().map((k) => ({ query: k.q, time: k.t })))
  }

  const raw: RawDataset = {
    generatedAt: new Date().toISOString(),
    profile: {
      displayName:
        (identity.displayName as string) || (attrs.username as string) || 'You',
      country: (attrs.country as string) ?? null,
      created: (attrs.creationTime as string) ?? null,
      email: (attrs.email as string) ?? null,
    },
    pools: {
      track: trackPool.values,
      artist: artistPool.values,
      album: albumPool.values,
      episode: episodePool.values,
      show: showPool.values,
      platform: platformPool.values,
      country: countryPool.values,
      reason: reasonPool.values,
    },
    uris,
    plays: rows,
    library: {
      tracks: asList(library.tracks),
      albums: asList(library.albums),
      artists: asList(library.artists),
      shows: asList(library.shows),
      episodes: asList(library.episodes).length,
    },
    playlists,
    searches,
  }

  return {
    raw,
    report: {
      plays: rows.length,
      duplicates: rawRows.length - plays.length,
      streamingFiles: streamFiles.map((f) => baseName(f.path)).sort(),
      accountFiles: relevant
        .filter((f) => !isExtendedStream(f.path) && !isBasicStream(f.path))
        .map((f) => baseName(f.path))
        .sort(),
      ignored,
      source,
      warnings,
    },
  }
}
