import type { CSSProperties } from 'react'

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

export function SkeletonTableRows({ rows = 4, cols = 7 }: { rows?: number; cols?: number }) {
  return <>{Array.from({ length: rows }, (_, r) => (
    <tr key={r} aria-hidden="true">{Array.from({ length: cols }, (_, c) => <td key={c}><span className="skeleton skeleton-cell" /></td>)}</tr>
  ))}</>
}
