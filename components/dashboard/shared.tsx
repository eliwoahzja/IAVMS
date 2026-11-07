'use client'

import { useEffect, useRef, useState } from 'react'
import { springTo } from '@/lib/spring'
import { TYPE_LABEL, code, day, initials, tone } from '@/lib/constants'
import type { Appt, R } from '@/lib/types'

export type Run = (fn: () => Promise<R>, ok: string) => void
const SPIN_MS = 2000

export function BusyButton({ label, className = 'secondary-button', disabled, onClick, children }: {
  label: string
  className?: string
  disabled?: boolean
  onClick: () => void
  children?: React.ReactNode
}) {
  const [working, setWorking] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])
  function fire() {
    if (working) return
    setWorking(true)
    onClick()
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setWorking(false), SPIN_MS)
  }
  return <button type="button" className={`${className}${working ? ' is-working' : ''}`} disabled={disabled || working} aria-busy={working || undefined} aria-label={label} onClick={fire}>
    <span className="btn-body">{children}</span>
    {working && <i className="spin" aria-hidden="true" />}
  </button>
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(value)
  const seen = useRef(value)
  useEffect(() => {
    if (seen.current === value) return
    const from = seen.current
    seen.current = value
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
    return springTo(from, value, 0, 0.45, (v) => setN(Math.round(v)))
  }, [value])
  return <>{n}</>
}

export function Metric({ label, value, tone: t }: { label: string; value: number; tone: string }) {
  return <div className={`metric-card metric-${t}`}><strong className="metric-value"><CountUp value={value} /></strong><span className="metric-label">{label}</span></div>
}

export function ApptRow({ a, i = 0, actions }: { a: Appt; i?: number; actions?: React.ReactNode }) {
  return <div className="request-row" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}><span className={`avatar avatar-${tone(a.id)}`}>{initials(a.requester_name)}</span>
    <span className="request-person"><strong>{a.requester_name}</strong><span>{TYPE_LABEL[a.requester_type] ?? a.requester_type} · {code(a.id)}</span><span className="request-meta">{day(a.date)} · {a.time} · {a.department}</span></span>
    <span className="request-detail"><strong>{a.department}</strong><span>{day(a.date)} · {a.time}</span><span>{a.purpose}</span></span>
    <span className={`status-pill status-${a.status.toLowerCase()}`}><span />{a.status}</span>
    {actions && <span className="row-actions">{actions}</span>}</div>
}

export function ConfirmButton({ label, confirmLabel, disabled, onConfirm }: { label: string; confirmLabel: string; disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  const [working, setWorking] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  useEffect(() => () => window.clearTimeout(timer.current), [])
  function fire() {
    setArmed(false)
    setWorking(true)
    onConfirm()
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setWorking(false), SPIN_MS)
  }
  return <button className={`secondary-button${armed ? ' danger' : ''}${working ? ' is-working' : ''}`} disabled={disabled || working} aria-busy={working || undefined} aria-label={armed ? confirmLabel : label} onClick={() => { if (armed) fire(); else setArmed(true) }}>
    <span className="btn-body">{armed ? confirmLabel : label}</span>
    {working && <i className="spin" aria-hidden="true" />}
  </button>
}
