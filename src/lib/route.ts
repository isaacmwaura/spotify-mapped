/** Which screen to show, read from the part of the address after "#". */

export const VIEW_IDS = ['overview', 'history', 'top', 'patterns', 'years'] as const
export type View = (typeof VIEW_IDS)[number]

/**
 * Turns an address hash into a screen. Anything unknown — a typo, an old link,
 * an empty hash — falls back to the Overview instead of crashing.
 */
export function viewFromHash(hash: string): View {
  const id = hash.replace(/^#/, '')
  return (VIEW_IDS as readonly string[]).includes(id) ? (id as View) : 'overview'
}
