/**
 * The app's mark: a tiny listening heat map, a 3 x 3 grid that is brighter where
 * there is more listening. index.html carries the same drawing as the tab icon.
 */
const CELLS: [number, number, number][] = [
  [0, 0, 0.35], [1, 0, 0.6], [2, 0, 1],
  [0, 1, 0.6], [1, 1, 1], [2, 1, 0.6],
  [0, 2, 1], [1, 2, 0.6], [2, 2, 0.35],
]

export function Logo({ size, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" />
      {CELLS.map(([col, row, opacity]) => (
        <rect
          key={`${col}-${row}`}
          x={4.4 + col * 5.5}
          y={4.4 + row * 5.5}
          width="4.2"
          height="4.2"
          rx="1.1"
          fill="var(--accent-ink)"
          opacity={opacity}
        />
      ))}
    </svg>
  )
}
