import { revalidatePath } from 'next/cache'
import { notify, notifyOffice } from '@/lib/email'
import { admin } from '@/lib/supabase/admin'
import { IT_DEPARTMENT, IT_TEACHERS, SLOTS } from '@/lib/constants'
import { DATE, MAX_TEXT, today, slotPassed, scheduleError, me, offices, states, isStaff, ownsOffice } from './context'
import type { R, SlotInfo } from '@/lib/types'

export async function slotStates(department: string, date: string, teacherName?: string | null): Promise<SlotInfo[]> {
  await me()
  if (!DATE.test(date)) return []
  if (department === IT_DEPARTMENT && (!teacherName || !IT_TEACHERS.some((name) => name === teacherName))) return []
  if (!(await offices()).includes(department)) return []
  return states(department, date, teacherName)
}

export async function book(input: { department: string; teacher_name?: string | null; date: string; time: string; purpose: string }): Promise<R> {
  const p = await me()
  if (p.role === 'admin') return { error: 'Administrators do not book appointments.' }
  if (!p.authorized) return { error: 'SPCC staff must authorize your account before you request an appointment.' }
  const { department, date, time } = input
  const purpose = input.purpose.trim()
  const teacher_name = typeof input.teacher_name === 'string' ? input.teacher_name.trim() : null
  if (department === IT_DEPARTMENT && (!teacher_name || !IT_TEACHERS.some((teacher) => teacher === teacher_name))) return { error: 'Select a valid College of IT teacher before continuing.' }
  if (department !== IT_DEPARTMENT && teacher_name) return { error: 'Teacher selection is only available for College of IT appointments.' }
  if (!SLOTS.includes(time) || !DATE.test(date) || !purpose) return { error: 'Choose an office, date and time, and enter an appointment purpose.' }
  try {
    if (!(await offices()).includes(department)) return { error: 'This office is not accepting appointments.' }
  } catch {
    return { error: 'Office availability could not be loaded. Please retry.' }
  }
  if (purpose.length > MAX_TEXT) return { error: `Keep the purpose under ${MAX_TEXT} characters.` }
  if (p.role === 'approver' && p.department === department) return { error: 'Choose a different office.' }
  if (slotPassed(date, time)) return { error: 'The selected appointment time has already passed.' }
  try {
    const slot = (await states(department, date, teacher_name)).find((s) => s.time === time)
    if (!slot || slot.state === 'closed' || slot.state === 'booked') return { error: 'This appointment time is unavailable. Choose another time.' }
  } catch {
    return { error: 'Appointment times could not be checked. Try again.' }
  }
  const db = admin()
  const { count, error: countError } = await db.from('appointments').select('id', { count: 'exact', head: true })
    .eq('requester_id', p.id).eq('department', department).eq('date', date).eq('time', time)
    .in('status', ['Pending', 'Approved', 'Rescheduled'])
  if (countError) return { error: 'Could not check existing appointments. Try again.' }
  if (count) return { error: 'You already have an open request for that slot.' }
  const { data, error } = await db.from('appointments')
    .insert({ requester_id: p.id, requester_name: p.full_name, requester_email: p.email, requester_type: p.role, department, teacher_name: department === IT_DEPARTMENT ? teacher_name : null, date, time, purpose })
    .select().single()
  if (error || !data) return { error: scheduleError(error, 'Your appointment request was not saved. Please try again.') }
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
    if (slotPassed(a.date, a.time)) return { error: 'This appointment time has already passed.' }
    try {
      const slot = (await states(a.department, a.date, a.teacher_name)).find((s) => s.time === a.time)
      if (!slot || slot.state === 'closed') return { error: 'This slot is no longer available. Reschedule the request.' }
      if (slot.state === 'booked') return { error: 'This slot already has a confirmed appointment. Reschedule or reject the request.' }
    } catch {
      return { error: 'Unable to verify the appointment slot. Try again.' }
    }
    patch = { status: 'Approved' }; event = 'approved'
  }
  else if (action === 'reject') { patch = { status: 'Rejected' }; event = 'rejected' }
  else {
    if (!to || !DATE.test(to.date) || !SLOTS.includes(to.time) || slotPassed(to.date, to.time)) return { error: 'Pick a future date and slot.' }
    try {
      const slot = (await states(a.department, to.date, a.teacher_name)).find((s) => s.time === to.time)
      if (!slot || slot.state === 'closed' || slot.state === 'booked') return { error: 'This appointment time is unavailable. Choose another time.' }
    } catch {
      return { error: 'Unable to verify the new appointment slot. Try again.' }
    }
    patch = { status: 'Rescheduled', date: to.date, time: to.time }
    event = 'rescheduled'
  }
  const { data: updated, error } = await db.from('appointments')
    .update(patch).eq('id', id).eq('status', a.status).select('id').maybeSingle()
  if (error) return { error: scheduleError(error, 'The appointment decision was not saved. Please try again.') }
  if (!updated) return { error: 'Another action already changed this request. Refresh and review its current status.' }
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
  const { data: updated, error } = await db.from('appointments')
    .update({ status: 'Cancelled' }).eq('id', id).eq('status', a.status).select('id').maybeSingle()
  if (error) return { error: scheduleError(error, 'The appointment was not cancelled. Please try again.') }
  if (!updated) return { error: 'This appointment was already changed. Refresh and check its current status.' }
  await notify(a, 'cancelled')
  revalidatePath('/')
  return {}
}

