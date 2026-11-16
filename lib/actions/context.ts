import { redirect } from 'next/navigation'
import { SLOTS } from '@/lib/constants'
import { admin } from '@/lib/supabase/admin'
import { supabase } from '@/lib/supabase/server'
import type { Profile, SlotInfo } from '@/lib/types'

export const DATE = /^\d{4}-\d{2}-\d{2}$/
export const MAX_NAME = 120
export const MAX_TEXT = 500
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
export const slotPassed = (date: string, time: string) => {
  const dateParts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const p = Object.fromEntries(dateParts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]))
  const localDate = `${p.year}-${p.month}-${p.day}`
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time)
  if (!match) return true
  const hour = Number(match[1]) % 12 + (match[3] === 'PM' ? 12 : 0)
  const minutes = hour * 60 + Number(match[2])
  return date < localDate || (date === localDate && minutes <= Number(p.hour) * 60 + Number(p.minute))
}
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

export async function me(): Promise<Profile> {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single()
  if (!data) redirect('/login')
  if (!data.authorized) redirect('/access-pending')
  return data as Profile
}
export const isStaff = (p: Profile) => p.role === 'admin' || p.role === 'approver'
export const ownsOffice = (p: Profile, department: string) => p.role === 'admin' || (p.role === 'approver' && p.department === department)

export async function offices(): Promise<string[]> {
  const { data, error } = await admin().from('departments').select('name').eq('active', true)
  if (error) throw new Error('Could not load office availability.')
  return (data ?? []).map((d: { name: string }) => d.name)
}

export async function states(department: string, date: string, teacherName?: string | null): Promise<SlotInfo[]> {
  const db = admin()
  const teacher = department === 'College of IT' ? teacherName?.trim() || null : null
  const [active, open, taken, blocked, teacherOpen, teacherBlocked] = await Promise.all([
    db.from('departments').select('active').eq('name', department).maybeSingle(),
    db.from('availability').select('time').eq('department', department).eq('weekday', weekday(date)),
    db.from('appointments').select('time,status,teacher_name').eq('department', department).eq('date', date).in('status', ['Pending', 'Approved', 'Rescheduled']),
    db.from('blocked_slots').select('time').eq('department', department).eq('date', date),
    teacher ? db.from('teacher_availability').select('time').eq('department', department).eq('teacher_name', teacher).eq('weekday', weekday(date)) : Promise.resolve({ data: null, error: null }),
    teacher ? db.from('teacher_blocked_slots').select('time').eq('department', department).eq('teacher_name', teacher).eq('date', date) : Promise.resolve({ data: null, error: null }),
  ])
  if (active.error || open.error || taken.error || blocked.error || teacherOpen.error || teacherBlocked.error) {
    throw new Error('Could not load appointment availability. Please retry.')
  }
  const officeOpen = new Set((open.data ?? []).map((r: { time: string }) => r.time))
  const teacherOpenTimes = teacher ? new Set((teacherOpen.data ?? []).map((r: { time: string }) => r.time)) : null
  const appointments = (taken.data ?? []) as { time: string; status: string; teacher_name: string | null }[]
  const related = teacher
    ? appointments.filter((a) => a.teacher_name === teacher || a.teacher_name === null)
    : appointments
  const departmentBlocks = (blocked.data ?? []) as { time: string | null }[]
  const teacherBlocks = (teacherBlocked.data ?? []) as { time: string | null }[]
  const closed = (blocks: { time: string | null }[], time: string) =>
    blocks.some((b) => b.time === null || b.time === time)
  return SLOTS.map((time) => {
    const hit = related.filter((a) => a.time === time)
    const state = !active.data?.active || slotPassed(date, time) || !officeOpen.has(time)
      || (teacherOpenTimes !== null && !teacherOpenTimes.has(time))
      || closed(departmentBlocks, time) || closed(teacherBlocks, time)
      ? 'closed'
      : hit.some((a) => a.status !== 'Pending') ? 'booked' : hit.length ? 'held' : 'open'
    return { time, state }
  })
}
