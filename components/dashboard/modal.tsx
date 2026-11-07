'use client'

import { useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { project, rubberband, springTo } from '@/lib/spring'

export function ModalBox({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const card = useRef<HTMLElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const stop = useRef<() => void>(() => {})
  const closeRef = useRef<() => void>(() => {})
  const drag = useRef<{ startY: number; startOffset: number; samples: { t: number; y: number }[] } | null>(null)
  const isSheet = () => window.matchMedia('(max-width: 780px)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function apply(v: number) {
    offset.current = v
    const c = card.current
    if (!c) return
    c.style.transform = `translate3d(0, ${v}px, 0)`
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - (Math.max(0, v) / (c.offsetHeight || 1)) * 0.9))
  }
  function settle(to: number, velocity: number, done?: () => void) {
    stop.current()
    stop.current = springTo(offset.current, to, velocity, 0.4, apply, done)
  }
  closeRef.current = () => { if (isSheet() && card.current) settle(card.current.offsetHeight, 0, onClose); else onClose() }

  useLayoutEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    card.current?.focus({ preventScroll: true })
    if (isSheet() && card.current) { apply(card.current.offsetHeight); settle(0, 0) }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return }
      if (e.key !== 'Tab' || !card.current) return
      const f = Array.from(card.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea'))
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      const at = document.activeElement
      if (e.shiftKey && (at === first || at === card.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; stop.current(); prev?.focus?.() }
  }, [])

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSheet() || (e.target as HTMLElement).closest('button')) return
    stop.current()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startOffset: offset.current, samples: [{ t: e.timeStamp, y: e.clientY }] }
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || !card.current) return
    const raw = e.clientY - d.startY + d.startOffset
    apply(raw >= 0 ? raw : -rubberband(-raw, card.current.offsetHeight))
    d.samples = [...d.samples.slice(-4), { t: e.timeStamp, y: e.clientY }]
  }
  function up() {
    const d = drag.current
    drag.current = null
    if (!d || !card.current) return
    const a = d.samples[0]
    const b = d.samples[d.samples.length - 1]
    const v = b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0
    const h = card.current.offsetHeight
    const dismiss = v > 900 || (v > -900 && offset.current + project(v) > h * 0.5)
    if (dismiss) settle(h, v, onClose)
    else settle(0, v)
  }

  return <div className="modal-backdrop" role="presentation">
    <div ref={scrim} className="modal-scrim" onPointerDown={() => closeRef.current()} />
    <section ref={card} className="modal-card" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="sheet-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={() => closeRef.current()} aria-label="Close dialog"><X /></button></div>
      </div>
      {children}
    </section>
  </div>
}
