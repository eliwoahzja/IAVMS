import { redirect } from 'next/navigation'
import { SLOTS } from '@/lib/constants'
import { admin } from '@/lib/supabase/admin'
import { supabase } from '@/lib/supabase/server'
import type { Profile, SlotInfo } from '@/lib/types'

export const DATE = /^\d{4}-\d{2}-\d{2}$/
export const MAX_NAME = 120
export const MAX_TEXT = 500
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

export async function me(): Promise<Profile> {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single()
  if (!data) redirect('/login')
  return data as Profile
}
export const isStaff = (p: Profile) => p.role === 'admin' || p.role === 'approver'
export const ownsOffice = (p: Profile, department: string) => p.role === 'admin' || (p.role === 'approver' && p.department === department)

export async function offices(): Promise<string[]> {
  const { data } = await admin().from('departments').select('name').eq('active', true)
  return (data ?? []).map((d: { name: string }) => d.name)
}

export async function states(department: string, date: string): Promise<SlotInfo[]> {
  const db = admin()
  const [open, taken, blocked] = await Promise.all([
    db.from('availability').select('time').eq('department', department).eq('weekday', weekday(date)),
    db.from('appointments').select('time,status').eq('department', department).eq('date', date).in('status', ['Pending', 'Approved', 'Rescheduled']),
    db.from('blocked_slots').select('time').eq('department', department).eq('date', date),
  ])
  const enabled = new Set((open.data ?? []).map((r: { time: string }) => r.time))
  const list = (taken.data ?? []) as { time: string; status: string }[]
  const shut = (blocked.data ?? []) as { time: string | null }[]
  const allDay = shut.some((b) => b.time === null)
  const closed = new Set(shut.map((b) => b.time))
  return SLOTS.map((time) => {
    const hit = list.filter((t) => t.time === time)
    const state = !enabled.has(time) || allDay || closed.has(time) ? 'closed' : hit.some((t) => t.status !== 'Pending') ? 'booked' : hit.length ? 'held' : 'open'
    return { time, state }
  })
}

