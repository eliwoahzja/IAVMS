'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const WEEKDAY_INITIALS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const ARROW_STEP: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }

function split(value: string) {
  const [y, m, d] = value.split('-').map(Number)
  return { y, m: m - 1, d }
}

function addDays(value: string, days: number) {
  const { y, m, d } = split(value)
  const next = new Date(Date.UTC(y, m, d + days))
  return toIso(next.getUTCFullYear(), next.getUTCMonth(), next.getUTCDate())
}

function addMonths(value: string, months: number) {
  const { y, m, d } = split(value)
  const next = new Date(Date.UTC(y, m + months, 1))
  const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate()
  return toIso(next.getUTCFullYear(), next.getUTCMonth(), Math.min(d, lastDay))
}

const isWeekend = (value: string) => {
  const weekday = new Date(`${value}T00:00:00Z`).getUTCDay()
  return weekday === 0 || weekday === 6
}

const weekdayOffset = (value: string) => (new Date(`${value}T00:00:00Z`).getUTCDay() + 6) % 7

const todayInManila = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })

const formatDay = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString('en-PH', {
    timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

const formatMonth = (y: number, m: number) =>
  new Date(Date.UTC(y, m, 1)).toLocaleDateString('en-PH', { timeZone: 'UTC', month: 'long', year: 'numeric' })

function monthWeeks(y: number, m: number) {
  const lead = weekdayOffset(toIso(y, m, 1))
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d += 1) cells.push(toIso(y, m, d))
  while (cells.length % 7) cells.push(null)
  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function DatePicker({ id, label, value, onChange, min }: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  min?: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const grid = useRef<HTMLTableElement>(null)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState('')
  const monthId = useId()

  const blocked = (day: string) => (min ? day < min : false) || isWeekend(day)

  function show() {
    const start = value || (min && !blocked(min) ? min : todayInManila())
    setCursor(blocked(start) ? seek(start, 1) : start)
    setOpen(true)
  }

  function hide(refocus = true) {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }

  function seek(from: string, step: number) {
    let day = from
    for (let i = 0; i < 14 && blocked(day); i += 1) day = addDays(day, step)
    return day
  }

  function choose(day: string) {
    onChange(day)
    hide()
  }

  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) hide(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      grid.current?.querySelector<HTMLButtonElement>(`[data-date="${cursor}"]`)?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, cursor])

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      hide()
      return
    }
    let next: string | null = null
    if (e.key in ARROW_STEP) next = addDays(cursor, ARROW_STEP[e.key])
    else if (e.key === 'Home') next = addDays(cursor, -weekdayOffset(cursor))
    else if (e.key === 'End') next = addDays(cursor, 6 - weekdayOffset(cursor))
    else if (e.key === 'PageUp') next = addMonths(cursor, -1)
    else if (e.key === 'PageDown') next = addMonths(cursor, 1)
    if (!next) return
    e.preventDefault()
    const step = ARROW_STEP[e.key] ?? (next < cursor ? -1 : 1)
    setCursor(blocked(next) ? seek(next, step) : next)
  }

  const { y, m } = useMemo(() => (cursor ? split(cursor) : { y: 0, m: 0 }), [cursor])
  const weeks = useMemo(() => (cursor ? monthWeeks(y, m) : []), [cursor, y, m])
  const today = todayInManila()

  return (
    <div className="date-field" ref={root} onKeyDown={onKeyDown}>
      <label className="field-label" htmlFor={id}>{label}</label>
      <button type="button" id={id} ref={trigger} className="date-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? hide() : show())}>
        <span className={value ? 'date-trigger-value' : 'date-trigger-empty'}>{value ? formatDay(value) : 'Select a date'}</span>
        <CalendarDays className="date-trigger-icon" aria-hidden="true" />
      </button>
      {open && (
        <div className="date-popover" role="dialog" aria-label="Choose a date">
          <div className="date-popover-head">
            <button type="button" className="date-nav" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft /></button>
            <span id={monthId} className="date-month">{formatMonth(y, m)}</span>
            <button type="button" className="date-nav" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight /></button>
          </div>
          <table className="date-grid" ref={grid} role="grid" aria-labelledby={monthId}>
            <thead>
              <tr>{WEEKDAY_INITIALS.map((name) => <th key={name} scope="col">{name}</th>)}</tr>
            </thead>
            <tbody>
              {weeks.map((week, index) => (
                <tr key={index}>
                  {week.map((day, cell) => day ? (
                    <td key={cell} aria-selected={day === value}>
                      <button
                        type="button"
                        data-date={day}
                        data-today={day === today || undefined}
                        disabled={blocked(day)}
                        tabIndex={day === cursor ? 0 : -1}
                        aria-label={formatDay(day)}
                        onClick={() => choose(day)}
                      >
                        {Number(day.slice(8))}
                      </button>
                    </td>
                  ) : <td key={cell} aria-hidden="true" />)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="date-note">Weekends are closed.</p>
        </div>
      )}
    </div>
  )
}
