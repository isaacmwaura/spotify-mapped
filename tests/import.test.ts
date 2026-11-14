/**
 * Behaviour that already works and must keep working: any years, any mix of
 * music / podcasts / audiobooks, the old basic format, duplicates, and the zip path.
 */
import { describe, expect, it } from 'vitest'
import { ImportError, buildRawDataset } from '../src/lib/ingest'
import { unzipExport } from '../src/lib/unpack'
import {
  byDay, byMonth, heatmap, longestStreak, rankAlbums, rankArtists,
  rankEpisodes, rankShows, rankTracks, sessions, summarise, years,
} from '../src/lib/stats'
import { EXT, accountFiles, analyse, byYearFiles, range, record, scenarios, spread, zipOf } from './scenarios'

/** Every number the app shows must survive a scenario without throwing. */
function runEveryStat(plays: ReturnType<typeof analyse>['data']['plays']) {
  summarise(plays); years(plays); byMonth(plays); byDay(plays); heatmap(plays)
  longestStreak(plays); sessions(plays); rankArtists(plays); rankShows(plays)
  rankTracks(plays); rankAlbums(plays); rankEpisodes(plays)
}

/** Music + spoken word must add up to the headline total. */
function cardsAddUp(s: ReturnType<typeof analyse>['s']) {
  return Math.abs(s.music.ms + s.podcast.ms + s.book.ms - s.ms) < 1
}

describe('test environment', () => {
  it('runs in UTC so hour and day checks are the same on every computer', () => {
    expect(new Date('2024-01-01T00:30:00Z').getHours()).toBe(0)
  })
})

describe('works for any years', () => {
  it('reads 2018 to 2021, before any real data in this project', () => {
    const { s, data } = analyse(scenarios.oldYears())
    expect(years(data.plays)).toEqual([2018, 2019, 2020, 2021])
    expect(s.plays).toBe(640)
    expect(byMonth(data.plays)).toHaveLength(48)
  })

  it('reads a future year (2027)', () => {
    const { data } = analyse(scenarios.future2027())
    expect(years(data.plays)).toEqual([2027])
  })

  it('handles a heavy listener: 59,800 plays across 13 years', () => {
    const t0 = performance.now()
    const { s, data } = analyse(scenarios.heavyListener())
    runEveryStat(data.plays)
    expect(s.plays).toBe(59_800)
    expect(years(data.plays)).toEqual(range(2015, 2027))
    expect(cardsAddUp(s)).toBe(true)
    expect(performance.now() - t0).toBeLessThan(10_000)
  })
})

describe('works for any listening mix', () => {
  it('music only: no shows, nothing crashes', () => {
    const { s, data } = analyse(scenarios.musicOnly())
    runEveryStat(data.plays)
    expect(s.podcast.plays).toBe(0)
    expect(rankShows(data.plays)).toHaveLength(0)
    expect(cardsAddUp(s)).toBe(true)
  })

  it('podcasts only: no artists, nothing crashes', () => {
    const { s, data } = analyse(scenarios.podcastOnly())
    runEveryStat(data.plays)
    expect(s.music.plays).toBe(0)
    expect(rankArtists(data.plays)).toHaveLength(0)
    expect(cardsAddUp(s)).toBe(true)
  })

  it('audiobooks are counted, ranked, and included in the totals', () => {
    const { s, data } = analyse(scenarios.withAudiobooks())
    expect(s.book.plays).toBeGreaterThan(0)
    expect(s.books).toBe(2)
    const chapters = rankEpisodes(data.plays).filter((e) => e.name.startsWith('Chapter'))
    expect(chapters.length).toBeGreaterThan(0)
    expect(cardsAddUp(s)).toBe(true)
  })

  it('a single play does not break any statistic', () => {
    const { s, data } = analyse(scenarios.singlePlay())
    runEveryStat(data.plays)
    expect(s.plays).toBe(1)
    expect(longestStreak(data.plays)?.days).toBe(1)
  })
})

describe('reads both export formats', () => {
  it('falls back to the old basic format and says so', () => {
    const { report, s } = analyse(scenarios.basicFormat())
    expect(report.source).toBe('basic')
    expect(s.plays).toBe(420)
    expect(report.warnings.join(' ')).toMatch(/basic streaming history/i)
  })

  it('prefers the extended history when both are present', () => {
    const files = [...scenarios.basicFormat(), ...byYearFiles(spread([2020], ['music'], 50))]
    expect(analyse(files).report.source).toBe('extended')
  })
})

describe('duplicates', () => {
  it('a second full copy of the history (the "Combined data" folder) changes nothing', () => {
    const once = scenarios.oldYears()
    const copy = once
      .filter((f) => f.path.startsWith(EXT))
      .map((f) => ({ ...f, path: f.path.replace(EXT, 'my_spotify_data/Combined data') }))
    const single = analyse(once)
    const doubled = analyse([...once, ...copy])
    expect(doubled.s.plays).toBe(single.s.plays)
    expect(doubled.s.ms).toBe(single.s.ms)
    expect(doubled.report.duplicates).toBe(single.s.plays)
  })
})

describe('the zip path', () => {
  it('unzips only the files it needs and gives the same answer as loose files', () => {
    const files = scenarios.oldYears()
    const unzipped = unzipExport(zipOf(files))
    expect(unzipped.some((f) => /AdRequestServiceEvent|\.pdf$/.test(f.path))).toBe(false)
    expect(analyse(unzipped).s.ms).toBe(analyse(files).s.ms)
  })

  it('a damaged zip gives a plain-English error', () => {
    expect(() => unzipExport(new Uint8Array([1, 2, 3, 4]))).toThrow(ImportError)
  })
})

describe('bad input', () => {
  it('no streaming history: explains what to look for', () => {
    expect(() => buildRawDataset(accountFiles())).toThrow(/No streaming history found/)
  })

  it('a corrupt file: names the file', () => {
    expect(() =>
      buildRawDataset([{ path: `${EXT}/Streaming_History_Audio_2020.json`, text: '{not json' }]),
    ).toThrow(/Streaming_History_Audio_2020\.json is not valid JSON/)
  })

  it('records with no title and no timestamp are dropped, with a warning', () => {
    const good = record({ stop: '2020-01-01T10:00:00Z', ms: 1000, kind: 'music', title: 'A', parent: 'B' })
    const files = [{ path: `${EXT}/Streaming_History_Audio_2020.json`, text: JSON.stringify([good, { ts: '', ms_played: 5 }]) }]
    const { report } = analyse(files)
    expect(report.plays).toBe(1)
    expect(report.warnings.join(' ')).toMatch(/left out/)
  })
})
