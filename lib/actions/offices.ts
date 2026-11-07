import { revalidatePath } from 'next/cache'
import { SLOTS } from '@/lib/constants'
import { admin } from '@/lib/supabase/admin'
import { DATE, MAX_TEXT, me, today, isStaff, ownsOffice, offices } from './context'
import type { R } from '@/lib/types'

export async function toggleSlot(department: string, day: number, time: string, on: boolean): Promise<R> {
  const p = await me()
  if (!ownsOffice(p, department) || !(await offices()).includes(department) || !SLOTS.includes(time) || day < 1 || day > 5) return { error: 'Your account does not have permission for this action.' }
  const db = admin()
  const q = on
    ? db.from('availability').upsert({ department, weekday: day, time })
    : db.from('availability').delete().eq('department', department).eq('weekday', day).eq('time', time)
  const { error } = await q
  if (error) return { error: 'The office schedule was not updated. Please try again.' }
  revalidatePath('/')
  return {}
}

export async function blockSlot(department: string, date: string, time: string | null, reasonIn: string): Promise<R> {
  const p = await me()
  const reason = reasonIn.trim().replace(/\s+/g, ' ')
  if (!ownsOffice(p, department)) return { error: 'Your account does not have permission for this action.' }
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
  if (!b || !ownsOffice(p, b.department)) return { error: 'Your account does not have permission for this action.' }
  const { error } = await db.from('blocked_slots').delete().eq('id', id)
  if (error) return { error: 'Could not open that time.' }
  revalidatePath('/')
  return {}
}

export async function saveOffice(nameIn: string, active: boolean): Promise<R> {
  const p = await me()
  if (p.role !== 'admin') return { error: 'Your account does not have permission for this action.' }
  const name = nameIn.trim().replace(/\s+/g, ' ')
  if (name.length < 2 || name.length > 60) return { error: 'Use 2 to 60 characters.' }
  const db = admin()
  const { error } = await db.from('departments').upsert({ name, active })
  if (error) return { error: 'The office settings were not saved. Please try again.' }
  const { count } = await db.from('availability').select('time', { count: 'exact', head: true }).eq('department', name)
  if (!count) {
    const { error: slotError } = await db.from('availability').insert([1, 2, 3, 4, 5].flatMap((weekday) => SLOTS.map((time) => ({ department: name, weekday, time }))))
    if (slotError) return { error: 'The office was saved but its slots could not be opened.' }
  }
  revalidatePath('/')
  return {}
}

