/**
 * Made-up Spotify exports for situations one person's real data never covers:
 * other years, music-only, podcast-only, audiobooks, the old basic format, a
 * single play, and a very heavy listener.
 *
 * Every value is synthetic. The random generator is seeded, so each scenario
 * is identical on every run and on every computer.
 */
import { zipSync, strToU8 } from 'fflate'
import { buildRawDataset, type ImportFile } from '../src/lib/ingest'
import { decodeDataset } from '../src/lib/data'
import { summarise } from '../src/lib/stats'

export const EXT = 'my_spotify_data/Spotify Extended Streaming History'
export const ACCT = 'my_spotify_data/Spotify Account Data'
export const TECH = 'my_spotify_data/Spotify Technical Log Information'

/** Small, fast, seeded random numbers (mulberry32). */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const ARTISTS = ['Fela Kuti', 'Nina Simone', 'Burna Boy', 'Radiohead', 'Sauti Sol',
  'Miles Davis', 'Bjork', 'A Tribe Called Quest', 'Little Simz', 'Aretha Franklin']
const TRACKS = ['Water No Get Enemy', 'Sinnerman', 'Ye', 'Idioteque', 'Melanin',
  'So What', 'Hyperballad', 'Excursions', 'Venom', 'Respect']
const SHOWS = ['The Daily', 'Radiolab', '99% Invisible', 'Darknet Diaries']
const BOOKS = ['Things Fall Apart', 'Sapiens']

export type Kind = 'music' | 'podcast' | 'book'

const pad = (n: number, w = 2) => String(n).padStart(w, '0')

/**
 * One record in Spotify's extended-history shape. `ts` is the moment the play
 * STOPPED, exactly as Spotify writes it.
 */
export function record(opts: {
  stop: string
  ms: number
  kind: Kind
  title?: string
  parent?: string
  album?: string
  uri?: string
  skipped?: boolean
  platform?: string
  country?: string
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    ts: opts.stop,
    platform: opts.platform ?? 'android',
    ms_played: opts.ms,
    conn_country: opts.country ?? 'KE',
    ip_addr: '203.0.113.7',
    master_metadata_track_name: null,
    master_metadata_album_artist_name: null,
    master_metadata_album_album_name: null,
    spotify_track_uri: null,
    episode_name: null,
    episode_show_name: null,
    spotify_episode_uri: null,
    audiobook_title: null,
    audiobook_uri: null,
    audiobook_chapter_title: null,
    audiobook_chapter_uri: null,
    reason_start: 'clickrow',
    reason_end: 'trackdone',
    shuffle: false,
    skipped: opts.skipped ?? false,
    offline: false,
    offline_timestamp: null,
    incognito_mode: false,
  }
  if (opts.kind === 'music') {
    base.master_metadata_track_name = opts.title ?? 'Song'
    base.master_metadata_album_artist_name = opts.parent ?? 'Artist'
    base.master_metadata_album_album_name = opts.album ?? `${opts.parent ?? 'Artist'} LP`
    base.spotify_track_uri = opts.uri ?? 'spotify:track:0000000000000000000000'
  } else if (opts.kind === 'podcast') {
    base.episode_name = opts.title ?? 'Episode'
    base.episode_show_name = opts.parent ?? 'Show'
    base.spotify_episode_uri = opts.uri ?? 'spotify:episode:0000000000000000000000'
  } else {
    base.audiobook_title = opts.parent ?? 'Book'
    base.audiobook_uri = 'spotify:show:0000000000000000000000'
    base.audiobook_chapter_title = opts.title ?? 'Chapter 1'
    base.audiobook_chapter_uri = opts.uri ?? 'spotify:episode:1111111111111111111111'
  }
  return base
}

/** Plays spread at random through the given years. */
export function spread(years: number[], kinds: Kind[], perYear: number, seed = 7) {
  const rnd = seeded(seed)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rnd() * xs.length)]
  const out: Record<string, unknown>[] = []
  let i = 0
  for (const y of years) {
    for (let n = 0; n < perYear; n++) {
      i++
      const kind = pick(kinds)
      const a = Math.floor(rnd() * ARTISTS.length)
      const stop = `${y}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))}` +
        `T${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}:${pad(i % 60)}Z`
      out.push(record({
        stop,
        ms: 5_000 + Math.floor(rnd() * 2_400_000),
        kind,
        title: kind === 'music' ? TRACKS[a] : kind === 'podcast' ? `Episode #${i}` : `Chapter ${1 + (i % 3)}`,
        parent: kind === 'music' ? ARTISTS[a] : kind === 'podcast' ? pick(SHOWS) : pick(BOOKS),
        uri: kind === 'music'
          ? `spotify:track:${String(a).padStart(22, '0')}`
          : `spotify:episode:${String(i).padStart(22, '0')}`,
        skipped: rnd() < 0.4,
        platform: pick(['android', 'windows', 'ios', 'osx']),
        country: pick(['KE', 'US', 'GB', 'NG']),
      }))
    }
  }
  return out.sort((x, y) => String(x.ts).localeCompare(String(y.ts)))
}

/** Account files a real export carries, with made-up values. */
export function accountFiles(): ImportFile[] {
  return [
    {
      path: `${ACCT}/UserAttributes.json`,
      text: JSON.stringify({
        username: 'synthetic-user',
        email: 'synthetic@example.com',
        country: 'NG',
        birthdate: '1990-01-01',
        gender: 'unknown',
        creationTime: '2015-06-01',
      }),
    },
    { path: `${ACCT}/Identity.json`, text: JSON.stringify({ displayName: 'Test Listener' }) },
    {
      path: `${ACCT}/SearchQueries.json`,
      text: JSON.stringify([
        { platform: 'ANDROID', searchTime: '2025-05-01T10:00:00.000Z[UTC]', searchQuery: 'private search' },
      ]),
    },
  ]
}

/** One streaming-history file per year, the way Spotify splits them. */
export function byYearFiles(rows: Record<string, unknown>[], folder = EXT): ImportFile[] {
  const years = new Map<string, Record<string, unknown>[]>()
  for (const r of rows) {
    const y = String(r.ts).slice(0, 4)
    if (!years.has(y)) years.set(y, [])
    years.get(y)!.push(r)
  }
  return [...years].map(([y, list]) => ({
    path: `${folder}/Streaming_History_Audio_${y}.json`,
    text: JSON.stringify(list),
  }))
}

export const scenarios = {
  oldYears: () => [...byYearFiles(spread([2018, 2019, 2020, 2021], ['music', 'podcast'], 160)), ...accountFiles()],
  future2027: () => [...byYearFiles(spread([2027], ['music', 'podcast'], 120)), ...accountFiles()],
  musicOnly: () => [...byYearFiles(spread([2022, 2023], ['music'], 200)), ...accountFiles()],
  podcastOnly: () => [...byYearFiles(spread([2024], ['podcast'], 200)), ...accountFiles()],
  withAudiobooks: () => [...byYearFiles(spread([2025], ['music', 'podcast', 'book'], 240)), ...accountFiles()],
  singlePlay: () => [
    { path: `${EXT}/Streaming_History_Audio_2016.json`,
      text: JSON.stringify([record({ stop: '2016-04-09T13:00:00Z', ms: 200_000, kind: 'music', title: 'Only', parent: 'One' })]) },
  ],
  heavyListener: () => [...byYearFiles(spread(range(2015, 2027), ['music', 'podcast', 'book'], 4600)), ...accountFiles()],
  basicFormat: () => {
    const rnd = seeded(11)
    const when = (y: number) => `${y}-${pad(1 + Math.floor(rnd() * 12))}-${pad(1 + Math.floor(rnd() * 28))} ` +
      `${pad(Math.floor(rnd() * 24))}:${pad(Math.floor(rnd() * 60))}`
    const music = Array.from({ length: 300 }, (_, i) => ({
      endTime: when(2020), artistName: ARTISTS[i % 10], trackName: TRACKS[i % 10], msPlayed: 5_000 + i * 900,
    }))
    const pods = Array.from({ length: 120 }, (_, i) => ({
      endTime: when(2020), podcastName: SHOWS[i % 4], episodeName: `Basic episode ${i}`, msPlayed: 60_000 + i * 20_000,
    }))
    return [
      { path: `${ACCT}/StreamingHistory_music_0.json`, text: JSON.stringify(music) },
      { path: `${ACCT}/StreamingHistory_podcast_0.json`, text: JSON.stringify(pods) },
      ...accountFiles(),
    ]
  },
}

export function range(from: number, to: number) {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

/** Runs the real pipeline: files -> packed dataset -> plays -> summary. */
export function analyse(files: ImportFile[]) {
  const { raw, report } = buildRawDataset(files)
  const data = decodeDataset(raw)
  return { raw, report, data, s: summarise(data.plays) }
}

/** Packs files into a zip exactly like Spotify's download, plus telemetry noise. */
export function zipOf(files: ImportFile[], withTelemetry = true): Uint8Array {
  const entries: Record<string, Uint8Array> = {}
  for (const f of files) entries[f.path] = strToU8(f.text)
  if (withTelemetry) {
    entries[`${TECH}/AdRequestServiceEvent.json`] = strToU8(JSON.stringify([{ telemetry: 'x'.repeat(5000) }]))
    entries[`${ACCT}/Read_Me_First.pdf`] = strToU8('%PDF-1.4 not really a pdf')
  }
  return zipSync(entries)
}
