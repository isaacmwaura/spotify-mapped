/**
 * Hand-rolled SVG charts. Three forms only — a stacked monthly column chart
 * (trend + part-to-whole), a weekday x hour heatmap (magnitude on a grid), and
 * ranked horizontal bars. Each ships a hover tooltip; colours come from the
 * validated palette tokens in index.css.
 */
import { useRef, useState, type ReactNode } from 'react'
import { MONTHS, WEEKDAYS, hourLabel, hours, num } from '../lib/format'
import type { MonthBucket } from '../lib/stats'

interface TipState {
  x: number
  y: number
  content: ReactNode
}

function useTooltip() {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipState | null>(null)

  const show = (e: { clientX: number; clientY: number }, content: ReactNode) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content })
  }
  const hide = () => setTip(null)

  const node = tip ? (
    <div
      className="tooltip"
      style={{
        left: Math.min(Math.max(tip.x, 80), (ref.current?.clientWidth ?? 300) - 80),
        top: tip.y,
      }}
    >
      {tip.content}
    </div>
  ) : null

  return { ref, show, hide, node }
}

export function TipRow({
  color,
  label,
  value,
}: {
  color?: string
  label: string
  value: string
}) {
  return (
    <div className="tooltip-row">
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
        {color && <span className="dot" style={{ background: color }} />}
        {label}
      </span>
      <b>{value}</b>
    </div>
  )
}

/* ----------------------------------------------------- monthly stacked bars */

export function MonthlyChart({
  data,
  height = 200,
}: {
  data: MonthBucket[]
  height?: number
}) {
  const { ref, show, hide, node } = useTooltip()
  if (!data.length) return null

  const W = 1000
  const padL = 40
  const padB = 26
  const padT = 8
  const plotW = W - padL - 8
  const plotH = height - padB - padT

  const max = Math.max(...data.map((d) => d.musicMs + d.podcastMs + d.otherMs), 1)
  const step = plotW / data.length
  const barW = Math.max(3, Math.min(38, step - 4))

  // Round the axis up to a friendly hour value.
  const maxHours = max / 3.6e6
  const tickStep = maxHours > 40 ? 20 : maxHours > 20 ? 10 : maxHours > 8 ? 5 : 2
  const axisMax = Math.ceil(maxHours / tickStep) * tickStep
  const ticks: number[] = []
  for (let t = 0; t <= axisMax; t += tickStep) ticks.push(t)
  const y = (ms: number) => plotH - (ms / 3.6e6 / axisMax) * plotH + padT

  return (
    <div className="chart-wrap" ref={ref} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Listening time per month">
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={padL}
              x2={W - 8}
              y1={y(t * 3.6e6)}
              y2={y(t * 3.6e6)}
              stroke="var(--grid)"
              strokeWidth="1"
            />
            <text className="tick" x={padL - 8} y={y(t * 3.6e6) + 4} textAnchor="end">
              {t}h
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const cx = padL + i * step + step / 2
          const total = d.musicMs + d.podcastMs + d.otherMs
          const podH = (d.podcastMs / 3.6e6 / axisMax) * plotH
          const musH = (d.musicMs / 3.6e6 / axisMax) * plotH
          const othH = (d.otherMs / 3.6e6 / axisMax) * plotH
          const base = padT + plotH
          const showLabel =
            data.length <= 18 || i % Math.ceil(data.length / 14) === 0

          return (
            <g
              key={d.key}
              onMouseMove={(e) =>
                show(e, (
                  <>
                    <div className="tooltip-title">
                      {MONTHS[d.date.getMonth()]} {d.date.getFullYear()}
                    </div>
                    <TipRow color="var(--series-2)" label="Podcasts" value={hours(d.podcastMs)} />
                    <TipRow color="var(--series-1)" label="Music" value={hours(d.musicMs)} />
                    {d.otherMs > 0 && (
                      <TipRow color="var(--series-3)" label="Audiobooks & other" value={hours(d.otherMs)} />
                    )}
                    <TipRow label="Plays" value={num(d.plays)} />
                  </>
                ))
              }
            >
              {/* transparent hit target, wider than the bar */}
              <rect x={cx - step / 2} y={padT} width={step} height={plotH} fill="transparent" />
              {total === 0 ? null : (
                <>
                  {/* podcast sits on the baseline; 2px surface gap between segments */}
                  <rect
                    x={cx - barW / 2}
                    y={base - podH}
                    width={barW}
                    height={Math.max(podH, podH > 0 ? 2 : 0)}
                    rx="3"
                    fill="var(--series-2)"
                  />
                  <rect
                    x={cx - barW / 2}
                    y={base - podH - musH - (podH > 0 && musH > 0 ? 2 : 0)}
                    width={barW}
                    height={Math.max(musH, musH > 0 ? 2 : 0)}
                    rx="3"
                    fill="var(--series-1)"
                  />
                  {othH > 0 && (
                    <rect
                      x={cx - barW / 2}
                      y={base - podH - musH - othH - 4}
                      width={barW}
                      height={Math.max(othH, 2)}
                      rx="3"
                      fill="var(--series-3)"
                    />
                  )}
                </>
              )}
              {showLabel && (
                <text className="tick" x={cx} y={height - 8} textAnchor="middle">
                  {d.date.getMonth() === 0 || i === 0
                    ? `${MONTHS[d.date.getMonth()]} ’${String(d.date.getFullYear()).slice(2)}`
                    : MONTHS[d.date.getMonth()]}
                </text>
              )}
            </g>
          )
        })}

        <line
          x1={padL}
          x2={W - 8}
          y1={padT + plotH}
          y2={padT + plotH}
          stroke="var(--baseline)"
          strokeWidth="1.5"
        />
      </svg>
      {node}
    </div>
  )
}

/* ------------------------------------------------------------- heatmap ---- */

export function Heatmap({ grid, max }: { grid: number[][]; max: number }) {
  const { ref, show, hide, node } = useTooltip()

  const steps = [
    'var(--seq-100)',
    'var(--seq-200)',
    'var(--seq-300)',
    'var(--seq-400)',
    'var(--seq-500)',
    'var(--seq-600)',
    'var(--seq-700)',
  ]
  // sqrt keeps the quiet hours visible — a few peak hours otherwise flatten
  // everything else to the lightest step.
  const colorOf = (v: number) => {
    if (v <= 0) return 'var(--surface-2)'
    const t = Math.sqrt(v / max)
    return steps[Math.min(steps.length - 1, Math.floor(t * steps.length))]
  }

  const W = 1000
  const padL = 34
  const padT = 18
  const cell = (W - padL - 4) / 24
  const cellH = 26
  const H = padT + cellH * 7 + 6

  return (
    <div className="chart-wrap" ref={ref} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Listening by weekday and hour">
        {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
          <text
            key={h}
            className="tick"
            x={padL + h * cell + cell / 2}
            y={12}
            textAnchor="middle"
          >
            {hourLabel(h)}
          </text>
        ))}
        {WEEKDAYS.map((d, r) => (
          <text key={d} className="tick" x={padL - 8} y={padT + r * cellH + cellH / 2 + 4} textAnchor="end">
            {d}
          </text>
        ))}
        {grid.map((row, r) =>
          row.map((v, h) => (
            <rect
              key={`${r}-${h}`}
              x={padL + h * cell + 1}
              y={padT + r * cellH + 1}
              width={cell - 2}
              height={cellH - 2}
              rx="3.5"
              fill={colorOf(v)}
              onMouseMove={(e) =>
                show(e, (
                  <>
                    <div className="tooltip-title">
                      {WEEKDAYS[r]} · {hourLabel(h)}
                    </div>
                    <TipRow label="Listened" value={v ? hours(v) : 'nothing'} />
                  </>
                ))
              }
            />
          )),
        )}
      </svg>
      {node}
    </div>
  )
}

export function HeatLegend() {
  return (
    <div className="legend" style={{ gap: 8 }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Less</span>
      {['var(--surface-2)', 'var(--seq-100)', 'var(--seq-200)', 'var(--seq-300)', 'var(--seq-400)', 'var(--seq-500)', 'var(--seq-600)', 'var(--seq-700)'].map(
        (c) => (
          <span
            key={c}
            style={{ width: 16, height: 12, borderRadius: 3, background: c, display: 'inline-block' }}
          />
        ),
      )}
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>More</span>
    </div>
  )
}

/* --------------------------------------------------------- hour-of-day ---- */

export function HourChart({ data }: { data: number[] }) {
  const { ref, show, hide, node } = useTooltip()
  const W = 1000
  const H = 150
  const padL = 40
  const padB = 24
  const plotH = H - padB - 6
  const max = Math.max(...data, 1)
  const step = (W - padL - 8) / 24
  const barW = step - 6

  return (
    <div className="chart-wrap" ref={ref} onMouseLeave={hide}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Listening time by hour of day">
        {data.map((v, h) => {
          const bh = (v / max) * plotH
          const x = padL + h * step
          return (
            <g
              key={h}
              onMouseMove={(e) =>
                show(e, (
                  <>
                    <div className="tooltip-title">{hourLabel(h)}</div>
                    <TipRow label="Listened" value={hours(v)} />
                  </>
                ))
              }
            >
              <rect x={x} y={6} width={step} height={plotH} fill="transparent" />
              <rect
                x={x + 3}
                y={6 + plotH - bh}
                width={barW}
                height={Math.max(bh, 2)}
                rx="4"
                fill="var(--series-1)"
              />
              {h % 3 === 0 && (
                <text className="tick" x={x + step / 2} y={H - 8} textAnchor="middle">
                  {hourLabel(h)}
                </text>
              )}
            </g>
          )
        })}
        <line x1={padL} x2={W - 8} y1={6 + plotH} y2={6 + plotH} stroke="var(--baseline)" strokeWidth="1.5" />
        <text className="tick" x={padL - 8} y={12} textAnchor="end">
          {hours(max)}
        </text>
      </svg>
      {node}
    </div>
  )
}

/* ------------------------------------------------------------ ranked bars - */

export function RankedBars({
  items,
  max,
  onSelect,
}: {
  items: { name: string; sub?: string; value: number; display: string }[]
  max: number
  onSelect?: (name: string) => void
}) {
  return (
    <div>
      {items.map((it, i) => (
        <button
          key={it.name + i}
          className="rank-row"
          style={{ rowGap: 0 }}
          onClick={() => onSelect?.(it.name)}
          disabled={!onSelect}
        >
          <span className="rank-num">{i + 1}</span>
          <span style={{ minWidth: 0 }}>
            <span className="rank-name">{it.name}</span>
            {it.sub && <span className="rank-sub">{it.sub}</span>}
          </span>
          <span className="rank-value">{it.display}</span>
          <span className="rank-bar">
            <span style={{ width: `${Math.max((it.value / max) * 100, 1.5)}%` }} />
          </span>
        </button>
      ))}
    </div>
  )
}
