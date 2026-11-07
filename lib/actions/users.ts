import { revalidatePath } from 'next/cache'
import { ROLES } from '@/lib/constants'
import { admin } from '@/lib/supabase/admin'
import { me, offices } from './context'
import type { R, Role } from '@/lib/types'

export async function setUserRole(userId: string, role: Role, department: string): Promise<R> {
  const p = await me()
  if (p.role !== 'admin') return { error: 'Your account does not have permission for this action.' }
  if (!ROLES.includes(role) || (role === 'approver' && !(await offices()).includes(department))) return { error: 'Approvers need an office.' }
  if (userId === p.id && role !== 'admin') return { error: 'You cannot remove your own admin role.' }
  const { error } = await admin().from('profiles').update({ role, department: role === 'approver' ? department : null }).eq('id', userId)
  if (error) return { error: 'The account permissions were not saved. Please try again.' }
  revalidatePath('/')
  return {}
}

export async function setAuthorized(userId: string, on: boolean): Promise<R> {
  const p = await me()
  if (p.role !== 'admin') return { error: 'Your account does not have permission for this action.' }
  const { error } = await admin().from('profiles').update({ authorized: on }).eq('id', userId)
  if (error) return { error: 'Visitor access was not updated. Please try again.' }
  revalidatePath('/')
  return {}
}

