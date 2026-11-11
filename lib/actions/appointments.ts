import { revalidatePath } from 'next/cache'
import { notify, notifyOffice } from '@/lib/email'
import { admin } from '@/lib/supabase/admin'
import { SLOTS } from '@/lib/constants'
import { DATE, MAX_TEXT, today, me, offices, states, isStaff, ownsOffice } from './context'
import type { R, SlotInfo } from '@/lib/types'

export async function slotStates(department: string, date: string): Promise<SlotInfo[]> {
  await me()
  if (!(await offices()).includes(department) || !DATE.test(date)) return []
  return states(department, date)
}

export async function book(input: { department: string; date: string; time: string; purpose: string }): Promise<R> {
  const p = await me()
  if (p.role === 'admin') return { error: 'Administrators do not book appointments.' }
  if (!p.authorized) return { error: 'SPCC staff must authorize your account before you request an appointment.' }
  const { department, date, time } = input
  const purpose = input.purpose.trim()
  if (!(await offices()).includes(department) || !SLOTS.includes(time) || !DATE.test(date) || !purpose) return { error: 'Choose an office, date and time, and enter an appointment purpose.' }
  if (purpose.length > MAX_TEXT) return { error: `Keep the purpose under ${MAX_TEXT} characters.` }
  if (p.role === 'approver' && p.department === department) return { error: 'Choose a different office.' }
  if (date < today()) return { error: 'Pick a date that has not passed.' }
  const slot = (await states(department, date)).find((s) => s.time === time)
  if (!slot || slot.state === 'closed' || slot.state === 'booked') return { error: 'This appointment time is unavailable. Choose another time.' }
  const db = admin()
  const { count } = await db.from('appointments').select('id', { count: 'exact', head: true })
    .eq('requester_id', p.id).eq('department', department).eq('date', date).eq('time', time)
    .in('status', ['Pending', 'Approved', 'Rescheduled'])
  if (count) return { error: 'You already have an open request for that slot.' }
  const { data, error } = await db.from('appointments')
    .insert({ requester_id: p.id, requester_name: p.full_name, requester_email: p.email, requester_type: p.role, department, date, time, purpose })
    .select().single()
  if (error || !data) return { error: 'Your appointment request was not saved. Please try again.' }
  await notify(data, 'pending review')
  await notifyOffice(data)
  revalidatePath('/')
  return {}
}

export async function decide(id: number, action: 'approve' | 'reject' | 'reschedule', to?: { date: string; time: string }): Promise<R> {
  const p = await me()
  if (!isStaff(p)) return { error: 'Your account does not have permission for this action.' }
  const db = admin()
  const { data: a, error: lookupError } = await db.from('appointments').select('*').eq('id', id).maybeSingle()
  if (lookupError) {
    console.error('Appointment review lookup failed:', lookupError.message)
    return { error: 'Could not load the appointment. Check the server connection and Supabase credentials.' }
  }
  if (!a || !['Pending', 'Approved', 'Rescheduled'].includes(a.status)) return { error: 'This appointment is closed or no longer exists.' }
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
    if (!slot || slot.state === 'closed' || slot.state === 'booked') return { error: 'This appointment time is unavailable. Choose another time.' }
    patch = { status: 'Rescheduled', date: to.date, time: to.time }
    event = 'rescheduled'
  }
  const { error } = await db.from('appointments').update(patch).eq('id', id)
  if (error) return { error: error.code === '23505' ? 'That slot already has a confirmed booking.' : 'The appointment decision was not saved. Please try again.' }
  await notify({ ...a, ...patch }, event)
  revalidatePath('/')
  return {}
}

export async function cancel(id: number): Promise<R> {
  const p = await me()
  const db = admin()
  const { data: a, error: lookupError } = await db.from('appointments').select('*').eq('id', id).maybeSingle()
  if (lookupError) {
    console.error('Appointment cancellation lookup failed:', lookupError.message)
    return { error: 'Could not load the appointment. Check the server connection and Supabase credentials.' }
  }
  if (!a) return { error: 'Appointment not found. Refresh the page and try again.' }
  if (a.requester_id !== p.id && p.role !== 'admin') return { error: 'Your account does not have permission for this action.' }
  if (!['Pending', 'Approved', 'Rescheduled'].includes(a.status)) return { error: 'This appointment is already closed.' }
  const { error } = await db.from('appointments').update({ status: 'Cancelled' }).eq('id', id)
  if (error) return { error: 'The appointment was not cancelled. Please try again.' }
  await notify(a, 'cancelled')
  revalidatePath('/')
  return {}
}

