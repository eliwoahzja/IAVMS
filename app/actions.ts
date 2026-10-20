'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ROLES, SLOTS } from '@/lib/constants'
import { notify, notifyOffice } from '@/lib/email'
import { admin } from '@/lib/supabase/admin'
import { supabase } from '@/lib/supabase/server'
import type { Profile, R, Role, SlotInfo } from '@/lib/types'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' })
const weekday = (date: string) => new Date(`${date}T00:00:00Z`).getUTCDay()

async function me(): Promise<Profile> {
  const sb = await supabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data } = await sb.from('profiles').select('*').eq('id', user.id).single()
  if (!data) redirect('/login')
  return data as Profile
}
const isStaff = (p: Profile) => p.role === 'admin' || p.role === 'approver'
const ownsOffice = (p: Profile, department: string) => p.role === 'admin' || (p.role === 'approver' && p.department === department)

async function offices(): Promise<string[]> {
  const { data } = await admin().from('departments').select('name').eq('active', true)
  return (data ?? []).map((d: { name: string }) => d.name)
}

async function states(department: string, date: string): Promise<SlotInfo[]> {
  const db = admin()
  const [open, taken] = await Promise.all([
    db.from('availability').select('time').eq('department', department).eq('weekday', weekday(date)),
    db.from('appointments').select('time,status').eq('department', department).eq('date', date).in('status', ['Pending', 'Approved', 'Rescheduled']),
  ])
  const enabled = new Set((open.data ?? []).map((r: { time: string }) => r.time))
  const list = (taken.data ?? []) as { time: string; status: string }[]
  return SLOTS.map((time) => {
    const hit = list.filter((t) => t.time === time)
    const state = !enabled.has(time) ? 'closed' : hit.some((t) => t.status !== 'Pending') ? 'booked' : hit.length ? 'held' : 'open'
    return { time, state }
  })
}

export async function slotStates(department: string, date: string): Promise<SlotInfo[]> {
  await me()
  if (!(await offices()).includes(department) || !DATE.test(date)) return []
  return states(department, date)
}

export async function book(input: { department: string; date: string; time: string; purpose: string }): Promise<R> {
  const p = await me()
  if (p.role === 'admin') return { error: 'Administrators do not book appointments.' }
  if (!p.authorized) return { error: 'Your account is waiting for authorization by SPCC staff.' }
  const { department, date, time } = input
  const purpose = input.purpose.trim()
  if (!(await offices()).includes(department) || !SLOTS.includes(time) || !DATE.test(date) || !purpose) return { error: 'Check the form and try again.' }
  if (p.role === 'approver' && p.department === department) return { error: 'Choose a different office.' }
  if (date < today()) return { error: 'Pick a date that has not passed.' }
  const slot = (await states(department, date)).find((s) => s.time === time)
  if (!slot || slot.state === 'closed' || slot.state === 'booked') return { error: 'That slot is not available.' }
  const { data, error } = await admin().from('appointments')
    .insert({ requester_id: p.id, requester_name: p.full_name, requester_email: p.email, requester_type: p.role, department, date, time, purpose })
    .select().single()
  if (error || !data) return { error: 'Could not save the request.' }
  await notify(data, 'pending review')
  await notifyOffice(data)
  revalidatePath('/')
  return {}
}

export async function decide(id: number, action: 'approve' | 'reject' | 'reschedule', to?: { date: string; time: string }): Promise<R> {
  const p = await me()
  if (!isStaff(p)) return { error: 'Not allowed.' }
  const db = admin()
  const { data: a } = await db.from('appointments').select('*').eq('id', id).single()
  if (!a || !['Pending', 'Approved', 'Rescheduled'].includes(a.status)) return { error: 'This appointment is closed.' }
  if (action !== 'reschedule' && a.status !== 'Pending') return { error: 'Only pending requests can be approved or rejected.' }
  if (!ownsOffice(p, a.department)) return { error: 'This request belongs to another office.' }
  let patch: Record<string, string>
  let event: string
  if (action === 'approve') { patch = { status: 'Approved' }; event = 'approved' }
  else if (action === 'reject') { patch = { status: 'Rejected' }; event = 'rejected' }
  else {
    if (!to || !DATE.test(to.date) || !SLOTS.includes(to.time) || to.date < today()) return { error: 'Pick a new date and slot.' }
    const slot = (await states(a.department, to.date)).find((s) => s.time === to.time)
    if (!slot || slot.state === 'closed' || slot.state === 'booked') return { error: 'That slot is not available.' }
    patch = { status: 'Rescheduled', date: to.date, time: to.time }
    event = 'rescheduled'
  }
  const { error } = await db.from('appointments').update(patch).eq('id', id)
  if (error) return { error: error.code === '23505' ? 'That slot already has a confirmed booking.' : 'Could not update the request.' }
  await notify({ ...a, ...patch }, event)
  revalidatePath('/')
  return {}
}

export async function cancel(id: number): Promise<R> {
  const p = await me()
  const db = admin()
  const { data: a } = await db.from('appointments').select('*').eq('id', id).single()
  if (!a || (a.requester_id !== p.id && p.role !== 'admin')) return { error: 'Not allowed.' }
  if (!['Pending', 'Approved', 'Rescheduled'].includes(a.status)) return { error: 'This appointment is already closed.' }
  const { error } = await db.from('appointments').update({ status: 'Cancelled' }).eq('id', id)
  if (error) return { error: 'Could not cancel.' }
  await notify(a, 'cancelled')
  revalidatePath('/')
  return {}
}

export async function registerVisitor(input: { name: string; purpose: string; department: string; appointmentId: number | null }): Promise<R> {
  const p = await me()
  const name = input.name.trim()
  const purpose = input.purpose.trim()
  if (!isStaff(p) || !ownsOffice(p, input.department)) return { error: 'Not allowed.' }
  if (!name || !purpose || !(await offices()).includes(input.department)) return { error: 'Fill in every field.' }
  const db = admin()
  if (input.appointmentId) {
    const { data: a } = await db.from('appointments').select('department').eq('id', input.appointmentId).single()
    if (!a || a.department !== input.department) return { error: 'That appointment belongs to another office.' }
  }
  const { error } = await db.from('visitors').insert({ name, purpose, department: input.department, appointment_id: input.appointmentId, created_by: p.id })
  if (error) return { error: 'Could not save the record.' }
  revalidatePath('/')
  return {}
}

export async function markVisit(id: number, field: 'arrived_at' | 'left_at'): Promise<R> {
  const p = await me()
  const db = admin()
  const { data: v } = await db.from('visitors').select('*').eq('id', id).single()
  if (!v || !isStaff(p) || !ownsOffice(p, v.department)) return { error: 'Not allowed.' }
  if (field === 'left_at' && !v.arrived_at) return { error: 'Record the arrival first.' }
  if (v[field]) return {}
  const { error } = await db.from('visitors').update({ [field]: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'Could not save.' }
  revalidatePath('/')
  return {}
}

export async function toggleSlot(department: string, day: number, time: string, on: boolean): Promise<R> {
  const p = await me()
  if (!ownsOffice(p, department) || !(await offices()).includes(department) || !SLOTS.includes(time) || day < 1 || day > 5) return { error: 'Not allowed.' }
  const db = admin()
  const q = on
    ? db.from('availability').upsert({ department, weekday: day, time })
    : db.from('availability').delete().eq('department', department).eq('weekday', day).eq('time', time)
  const { error } = await q
  if (error) return { error: 'Could not update availability.' }
  revalidatePath('/')
  return {}
}

export async function saveOffice(nameIn: string, active: boolean): Promise<R> {
  const p = await me()
  if (p.role !== 'admin') return { error: 'Not allowed.' }
  const name = nameIn.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 60) return { error: 'Use 2 to 60 characters.' }
  const db = admin()
  const { error } = await db.from('departments').upsert({ name, active })
  if (error) return { error: 'Could not save the office.' }
  const { count } = await db.from('availability').select('time', { count: 'exact', head: true }).eq('department', name)
  if (!count) await db.from('availability').insert([1, 2, 3, 4, 5].flatMap((weekday) => SLOTS.map((time) => ({ department: name, weekday, time }))))
  revalidatePath('/')
  return {}
}

export async function setUserRole(userId: string, role: Role, department: string): Promise<R> {
  const p = await me()
  if (p.role !== 'admin') return { error: 'Not allowed.' }
  if (!ROLES.includes(role) || (role === 'approver' && !(await offices()).includes(department))) return { error: 'Approvers need an office.' }
  if (userId === p.id && role !== 'admin') return { error: 'You cannot remove your own admin role.' }
  const { error } = await admin().from('profiles').update({ role, department: role === 'approver' ? department : null }).eq('id', userId)
  if (error) return { error: 'Could not update the user.' }
  revalidatePath('/')
  return {}
}

export async function setAuthorized(userId: string, on: boolean): Promise<R> {
  const p = await me()
  if (p.role !== 'admin') return { error: 'Not allowed.' }
  const { error } = await admin().from('profiles').update({ authorized: on }).eq('id', userId)
  if (error) return { error: 'Could not update the visitor.' }
  revalidatePath('/')
  return {}
}

const back = (path: '/login' | '/signup', kind: 'error' | 'msg', text: string) => redirect(`${path}?${kind}=${encodeURIComponent(text)}`)

export async function signIn(fd: FormData) {
  const sb = await supabase()
  const { error } = await sb.auth.signInWithPassword({ email: String(fd.get('email')), password: String(fd.get('password')) })
  if (error) back('/login', 'error', 'Wrong email or password. Check both and try again.')
  redirect('/')
}

export async function signUp(fd: FormData) {
  if (fd.get('consent') !== 'on') back('/signup', 'error', 'Tick the box to accept the privacy notice.')
  const type = String(fd.get('type'))
  const last = String(fd.get('last_name')).trim()
  const first = String(fd.get('first_name')).trim()
  const middle = String(fd.get('middle_name') ?? '').trim().replace(/\.$/, '')
  const middleInitial = middle.length > 1 ? `${middle[0]}.` : middle
  const full_name = middleInitial ? `${last}, ${first} ${middleInitial}` : `${last}, ${first}`
  const sb = await supabase()
  const { data, error } = await sb.auth.signUp({
    email: String(fd.get('email')),
    password: String(fd.get('password')),
    options: { data: { full_name, type } },
  })
  if (error) back('/signup', 'error', /already (been )?registered/i.test(error.message) ? 'That email already has an account. Sign in instead.' : error.message)
  if (!data.session) back('/login', 'msg', 'Check your email to confirm the account, then sign in.')
  redirect('/')
}

export async function signOut() {
  const sb = await supabase()
  await sb.auth.signOut()
  redirect('/login')
}
