const nf = new Intl.NumberFormat('en-US')

export const num = (n: number) => nf.format(Math.round(n))

/** Compact spoken duration: "412 h", "3h 20m", "4m 12s", "48s". */
export function duration(ms: number): string {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ${s % 60}s`
  const h = Math.floor(m / 60)
  if (h < 100) return `${h}h ${m % 60}m`
  return `${num(h)} h`
}

/** Just the hours figure, for axes and dense columns. */
export function hours(ms: number, digits = 1): string {
  const h = ms / 3_600_000
  if (h < 1) return `${Math.round(ms / 60_000)}m`
  return `${h.toFixed(h >= 100 ? 0 : digits)}h`
}

export const toHours = (ms: number) => ms / 3_600_000

const dtDate = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
const dtTime = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
})

export const fmtDate = (d: Date) => dtDate.format(d)
export const fmtTime = (d: Date) => dtTime.format(d)

export const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "3pm", "12am" — hour-of-day axis labels. */
export function hourLabel(h: number): string {
  if (h === 0) return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}

export function relativeDays(from: Date, to: Date): string {
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.round(days / 30.44)
  if (months < 24) return `${months} month${months === 1 ? '' : 's'} ago`
  return `${(days / 365.25).toFixed(1)} years ago`
}
