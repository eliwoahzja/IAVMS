'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { ROLES, SLOTS, isRequester } from '@/lib/constants'
import { notify, notifyOffice } from '@/lib/email'
import { admin } from '@/lib/supabase/admin'
import { supabase } from '@/lib/supabase/server'
import type { Profile, R, Role, SlotInfo } from '@/lib/types'

const DATE = /^\d{4}-\d{2}-\d{2}$/
const MAX_NAME = 120
const MAX_TEXT = 500
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
  if (purpose.length > MAX_TEXT) return { error: `Keep the purpose under ${MAX_TEXT} characters.` }
  if (p.role === 'approver' && p.department === department) return { error: 'Choose a different office.' }
  if (date < today()) return { error: 'Pick a date that has not passed.' }
  const slot = (await states(department, date)).find((s) => s.time === time)
  if (!slot || slot.state === 'closed' || slot.state === 'booked') return { error: 'That slot is not available.' }
  const db = admin()
  const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
    .eq('requester_id', p.id).eq('department', department).eq('date', date).eq('time', time)
    .in('status', ['Pending', 'Approved', 'Rescheduled'])
  if (count) return { error: 'You already have an open request for that slot.' }
  const { data, error } = await db.from('appointments')
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
  if (action === 'approve') {
    if (a.date < today()) return { error: 'That date has already passed.' }
    patch = { status: 'Approved' }; event = 'approved'
  }
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
  if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` }
  if (purpose.length > MAX_TEXT) return { error: `Keep the purpose under ${MAX_TEXT} characters.` }
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

export async function blockSlot(department: string, date: string, time: string | null, reasonIn: string): Promise<R> {
  const p = await me()
  const reason = reasonIn.trim().replace(/\s+/g, ' ')
  if (!ownsOffice(p, department)) return { error: 'Not allowed.' }
  if (!(await offices()).includes(department)) return { error: 'That office is not taking appointments.' }
  if (!DATE.test(date) || date < today()) return { error: 'Pick a date that has not passed.' }
  if (time !== null && !SLOTS.includes(time)) return { error: 'Pick a time or the whole day.' }
  if (!reason) return { error: 'Say why the office is unavailable.' }
  if (reason.length > 60) return { error: 'Keep the reason under 60 characters.' }
  const { error } = await admin().from('blocked_slots').insert({ department, date, time, reason, created_by: p.id })
  if (error) return { error: error.code === '23505' ? 'That time is already unavailable.' : 'Could not mark that time as unavailable.' }
  revalidatePath('/')
  return {}
}

export async function unblockSlot(id: number): Promise<R> {
  const p = await me()
  const db = admin()
  const { data: b } = await db.from('blocked_slots').select('department').eq('id', id).single()
  if (!b || !ownsOffice(p, b.department)) return { error: 'Not allowed.' }
  const { error } = await db.from('blocked_slots').delete().eq('id', id)
  if (error) return { error: 'Could not open that time.' }
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
  if (!count) {
    const { error: slotError } = await db.from('availability').insert([1, 2, 3, 4, 5].flatMap((weekday) => SLOTS.map((time) => ({ department: name, weekday, time }))))
    if (slotError) return { error: 'The office was saved but its slots could not be opened.' }
  }
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
  if (!isRequester(type as Role)) back('/signup', 'error', 'Choose what describes you.')
  const last = String(fd.get('last_name')).trim()
  const first = String(fd.get('first_name')).trim()
  const middle = String(fd.get('middle_name') ?? '').trim().replace(/\.$/, '')
  if (!last || !first) back('/signup', 'error', 'Fill in your first and last name.')
  if (last.length > 60 || first.length > 60 || middle.length > 60) back('/signup', 'error', 'Keep each name under 60 characters.')
  const middleInitial = middle.length > 1 ? `${middle[0]}.` : middle
  const full_name = middleInitial ? `${last}, ${first} ${middleInitial}` : `${last}, ${first}`
  const sb = await supabase()
  const { data, error } = await sb.auth.signUp({
    email: String(fd.get('email')),
    password: String(fd.get('password')),
    options: { data: { full_name, type } },
  })
  if (error) back('/signup', 'error', /already (been )?registered/i.test(error.message) ? 'That email already has an account. Sign in instead.' : 'That account could not be created. Check the email and use at least 8 characters for the password.')
  if (!data.session) back('/login', 'msg', 'Check your email to confirm the account, then sign in.')
  redirect('/')
}

export async function signOut() {
  const sb = await supabase()
  await sb.auth.signOut()
  redirect('/login')
}
