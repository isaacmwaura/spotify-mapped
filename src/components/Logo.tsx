/**
 * The app's mark: a map pin with a play button inside. index.html carries the
 * same drawing as the tab icon.
 */
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
      <path
        d="M12 1.5c-4.7 0-8.5 3.7-8.5 8.4 0 6 8.5 12.6 8.5 12.6s8.5-6.6 8.5-12.6c0-4.7-3.8-8.4-8.5-8.4z"
        fill="var(--accent)"
      />
      <path d="M10.1 6.6v6.4l5.2-3.2z" fill="var(--accent-ink)" />
    </svg>
  )
}
