import { revalidatePath } from 'next/cache'
import { admin } from '@/lib/supabase/admin'
import { MAX_NAME, MAX_TEXT, me, isStaff, ownsOffice, offices } from './context'
import type { R } from '@/lib/types'

export async function registerVisitor(input: { name: string; purpose: string; department: string; appointmentId: number | null }): Promise<R> {
  const p = await me()
  const name = input.name.trim()
  const purpose = input.purpose.trim()
  if (!isStaff(p) || !ownsOffice(p, input.department)) return { error: 'Your account does not have permission for this action.' }
  if (!name || !purpose || !(await offices()).includes(input.department)) return { error: 'Enter the visitor name, purpose and destination office.' }
  if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` }
  if (purpose.length > MAX_TEXT) return { error: `Keep the purpose under ${MAX_TEXT} characters.` }
  const db = admin()
  if (input.appointmentId) {
    const { data: a } = await db.from('appointments').select('department').eq('id', input.appointmentId).single()
    if (!a || a.department !== input.department) return { error: 'That appointment belongs to another office.' }
  }
  const { error } = await db.from('visitors').insert({ name, purpose, department: input.department, appointment_id: input.appointmentId, created_by: p.id })
  if (error) return { error: 'The visitor record was not saved. Please try again.' }
  revalidatePath('/')
  return {}
}

export async function markVisit(id: number, field: 'arrived_at' | 'left_at'): Promise<R> {
  const p = await me()
  const db = admin()
  const { data: v } = await db.from('visitors').select('*').eq('id', id).single()
  if (!v || !isStaff(p) || !ownsOffice(p, v.department)) return { error: 'Your account does not have permission for this action.' }
  if (field === 'left_at' && !v.arrived_at) return { error: 'Record the visitor’s arrival before marking their departure.' }
  if (v[field]) return {}
  const { error } = await db.from('visitors').update({ [field]: new Date().toISOString() }).eq('id', id)
  if (error) return { error: 'The change was not saved. Please try again.' }
  revalidatePath('/')
  return {}
}

