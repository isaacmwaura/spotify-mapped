/**
 * Clicking a title opens it on Spotify. Different songs often share a title
 * ("Intro", "ATM", "3005"), so each play must keep its own link rather than
 * one link per title.
 */
import { describe, expect, it } from 'vitest'
import { webUrl } from '../src/lib/data'
import { EXT, analyse, record } from './scenarios'

function playsFrom(records: Record<string, unknown>[]) {
  return analyse([{ path: `${EXT}/Streaming_History_Audio_2024.json`, text: JSON.stringify(records) }]).data.plays
}

describe('each play keeps its own Spotify link', () => {
  it('two different songs with the same title open different songs', () => {
    const plays = playsFrom([
      record({ stop: '2024-01-01T10:00:00Z', ms: 60_000, kind: 'music', title: 'ATM', parent: 'Artist One', uri: 'spotify:track:AAAAAAAAAAAAAAAAAAAAAA' }),
      record({ stop: '2024-01-01T11:00:00Z', ms: 60_000, kind: 'music', title: 'ATM', parent: 'Artist Two', uri: 'spotify:track:BBBBBBBBBBBBBBBBBBBBBB' }),
    ])
    const byArtist = Object.fromEntries(plays.map((p) => [p.parent, p.uri]))
    expect(byArtist['Artist One']).toBe('spotify:track:AAAAAAAAAAAAAAAAAAAAAA')
    expect(byArtist['Artist Two']).toBe('spotify:track:BBBBBBBBBBBBBBBBBBBBBB')
  })

  it('two different episodes with the same name open different episodes', () => {
    const plays = playsFrom([
      record({ stop: '2024-01-01T10:00:00Z', ms: 60_000, kind: 'podcast', title: 'Trailer', parent: 'Show A', uri: 'spotify:episode:CCCCCCCCCCCCCCCCCCCCCC' }),
      record({ stop: '2024-01-01T11:00:00Z', ms: 60_000, kind: 'podcast', title: 'Trailer', parent: 'Show B', uri: 'spotify:episode:DDDDDDDDDDDDDDDDDDDDDD' }),
    ])
    const byShow = Object.fromEntries(plays.map((p) => [p.parent, p.uri]))
    expect(byShow['Show A']).toBe('spotify:episode:CCCCCCCCCCCCCCCCCCCCCC')
    expect(byShow['Show B']).toBe('spotify:episode:DDDDDDDDDDDDDDDDDDDDDD')
  })

  it('the same song played twice is stored once and links correctly both times', () => {
    const uri = 'spotify:track:EEEEEEEEEEEEEEEEEEEEEE'
    const { raw, data } = analyse([{
      path: `${EXT}/Streaming_History_Audio_2024.json`,
      text: JSON.stringify([
        record({ stop: '2024-01-01T10:00:00Z', ms: 60_000, kind: 'music', title: 'Loop', parent: 'X', uri }),
        record({ stop: '2024-01-02T10:00:00Z', ms: 60_000, kind: 'music', title: 'Loop', parent: 'X', uri }),
      ]),
    }])
    expect(data.plays.every((p) => p.uri === uri)).toBe(true)
    expect(raw.pools.uri.filter((u) => u === uri)).toHaveLength(1)
  })

  it('becomes an open.spotify.com address, and nothing else', () => {
    expect(webUrl('spotify:track:EEEEEEEEEEEEEEEEEEEEEE')).toBe('https://open.spotify.com/track/EEEEEEEEEEEEEEEEEEEEEE')
    expect(webUrl('')).toBeNull()
    expect(webUrl('javascript:alert(1)')).toBeNull()
  })
})
