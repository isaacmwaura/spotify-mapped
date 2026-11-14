/** A mistyped or outdated address must never produce a blank page. */
import { describe, expect, it } from 'vitest'
import { VIEW_IDS, viewFromHash } from '../src/lib/route'

describe('reading the screen from the address', () => {
  it('opens each real screen by name', () => {
    for (const id of VIEW_IDS) expect(viewFromHash(`#${id}`)).toBe(id)
  })

  it('falls back to the Overview for a typo, an old link or nothing at all', () => {
    expect(viewFromHash('#statistics')).toBe('overview')
    expect(viewFromHash('#')).toBe('overview')
    expect(viewFromHash('')).toBe('overview')
    expect(viewFromHash('#__proto__')).toBe('overview')
  })
})
