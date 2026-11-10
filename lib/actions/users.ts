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


export async function deleteAccount(userId: string): Promise<R> {
  const p = await me()
  if (p.role !== 'admin') return { error: 'Only administrators can delete accounts.' }
  if (userId === p.id) return { error: 'You cannot delete your own account.' }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return { error: 'Invalid account ID.' }
  const { data, error } = await admin().rpc('admin_delete_account', { p_target_id: userId })
  if (error) return { error: error.message.includes('last administrator') ? 'You cannot delete the last administrator.' : 'Account deletion failed. No records were removed.' }
  if (!data) return { error: 'This account no longer exists.' }
  revalidatePath('/')
  return {}
}
