/**
 * The app keeps only what it shows, and saves nothing between visits.
 * Decided 14 Nov 2026: every visit starts at the import screen.
 */
import { describe, expect, it } from 'vitest'
import { isRelevant } from '../src/lib/ingest'
import { ACCT, EXT, analyse, record, scenarios } from './scenarios'

describe('only what is shown is kept', () => {
  it('drops email, birth date, gender, username, IP address and searches', () => {
    const { raw } = analyse(scenarios.oldYears())
    const kept = JSON.stringify(raw)
    for (const secret of ['synthetic@example.com', '1990-01-01', 'synthetic-user', '203.0.113.7', 'private search']) {
      expect(kept).not.toContain(secret)
    }
    expect(Object.keys(raw.profile).sort()).toEqual(['created', 'displayName'])
  })

  it('never opens search history, playlists, payments or other account files', () => {
    for (const name of ['SearchQueries.json', 'Playlist1.json', 'Marquee.json', 'Payments.json', 'Inferences.json', 'Wrapped2025.json']) {
      expect(isRelevant(`${ACCT}/${name}`)).toBe(false)
    }
    expect(isRelevant(`${ACCT}/Identity.json`)).toBe(true)
  })

  it('keeps library counts, never the items themselves', () => {
    const library = JSON.stringify({
      tracks: [{ track: 'Secret Song' }],
      shows: [{ name: 'Show A' }, { name: 'Show B' }],
      artists: [{ name: 'Artist A' }],
      episodes: [{ name: 'Ep' }, { name: 'Ep2' }, { name: 'Ep3' }],
    })
    const { raw } = analyse([
      ...scenarios.singlePlay(),
      { path: `${ACCT}/YourLibrary.json`, text: library },
    ])
    expect(raw.library).toEqual({ episodes: 3, shows: 2, artists: 1 })
    expect(JSON.stringify(raw)).not.toContain('Secret Song')
  })

  it('without a display name it says "You", never the account username', () => {
    const files = [
      { path: `${EXT}/Streaming_History_Audio_2020.json`,
        text: JSON.stringify([record({ stop: '2020-01-01T10:00:00Z', ms: 1000, kind: 'music', title: 'A', parent: 'B' })]) },
      { path: `${ACCT}/UserAttributes.json`, text: JSON.stringify({ username: 'secret-handle' }) },
    ]
    expect(analyse(files).raw.profile.displayName).toBe('You')
  })
})

describe('nothing is saved between visits', () => {
  // Reads the app's own source, so adding saving back makes this fail loudly.
  const sources = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

  it('found the source files to check', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
  })

  it('never opens browser storage for listening data', () => {
    for (const [file, code] of Object.entries(sources)) {
      expect(code, file).not.toMatch(/indexedDB\.open|sessionStorage|caches\.open|document\.cookie/)
    }
  })

  it('uses localStorage only for the light/dark theme', () => {
    for (const [file, code] of Object.entries(sources)) {
      for (const m of code.matchAll(/localStorage\.setItem\(([^,]+),/g)) {
        expect(m[1].trim(), file).toBe("'theme'")
      }
    }
  })

  it('wipes the database older versions left behind', () => {
    expect(sources['../src/App.tsx']).toMatch(/indexedDB\?\.deleteDatabase\('spotify-mapped'\)/)
  })
})
