import type { Role, Status } from './types'

export const SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM']
export const WEEKDAYS = [{ n: 1, label: 'Mon' }, { n: 2, label: 'Tue' }, { n: 3, label: 'Wed' }, { n: 4, label: 'Thu' }, { n: 5, label: 'Fri' }]
export const STATUSES: Status[] = ['Pending', 'Approved', 'Rescheduled', 'Rejected', 'Cancelled']
export const ROLES: Role[] = ['student', 'faculty', 'visitor', 'approver', 'admin']
export const isRequester = (r: Role) => r === 'student' || r === 'faculty' || r === 'visitor'

export const code = (id: number) => `APT-${String(id).padStart(4, '0')}`
export const bySchedule = <T extends { date: string; time: string }>(a: T, b: T) =>
  a.date.localeCompare(b.date) || SLOTS.indexOf(a.time) - SLOTS.indexOf(b.time)
export const initials = (name: string) => name.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '?'
export const tone = (id: number) => (['coral', 'sage', 'lavender', 'sand'] as const)[id % 4]
export const day = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
export const TYPE_LABEL: Record<string, string> = { student: 'Student', faculty: 'Faculty member', visitor: 'External visitor', approver: 'Department approver', admin: 'Administrator' }

export const personLabel = (name: string) => {
  const trimmed = name.trim()
  if (trimmed.includes(',')) return trimmed
  const w = trimmed.split(/\s+/).filter(Boolean)
  if (w.length <= 1) return trimmed
  const last = w[w.length - 1]
  const first = w[0]
  const middle = w.slice(1, -1).map((m) => `${m[0]}.`).join(' ')
  return `${last}, ${first}${middle ? ` ${middle}` : ''}`
}
