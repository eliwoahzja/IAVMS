import type { CSSProperties } from 'react'

/** Static loading placeholders. Deliberately dumb and hook-free so the same
    markup can be rendered from a server component (the route fallback) and
    from the client dashboard (while an action refreshes).

    The rows reuse .request-row's grid, so swapping them for real rows never
    shifts the layout underneath the user's cursor. */

export function SkeletonRows({ rows = 3, label }: { rows?: number; label: string }) {
  return <div className="skeleton-list" role="status" aria-label={label}>
    {Array.from({ length: rows }, (_, i) => (
      <div className="skeleton-row" key={i} style={{ '--i': Math.min(i, 8) } as CSSProperties} aria-hidden="true">
        <span className="skeleton skeleton-avatar" />
        <span className="skeleton skeleton-line" />
        <span className="skeleton skeleton-line skeleton-line-short" />
        <span className="skeleton skeleton-pill" />
      </div>
    ))}
  </div>
}

/** Table-body placeholder. Returns rows rather than a whole table so it drops
    into an existing <tbody> and keeps the real column headers visible. */
export function SkeletonTableRows({ rows = 4, cols = 7 }: { rows?: number; cols?: number }) {
  return <>{Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden="true">{Array.from({ length: cols }, (_, c) => <td key={c}><span className="skeleton skeleton-cell" /></td>)}</tr>
  ))}</>
}
