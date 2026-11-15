import { revalidatePath } from 'next/cache'
import { admin } from '@/lib/supabase/admin'
import { send } from '@/lib/email/delivery'
import { me } from './context'
import type { R } from '@/lib/types'

const origin = () => {
  const url = process.env.APP_URL?.trim()
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) return null
    if (parsed.username || parsed.password) return null
    return parsed.origin
  } catch {
    return null
  }
}

export async function reviewAccess(id: string, action: 'approve' | 'reject'): Promise<R> {
  const reviewer = await me()
  if (reviewer.role !== 'admin') return { error: 'Only administrators review account requests.' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Invalid request.' }
  const db = admin()
  const { data: req, error: readError } = await db.from('account_requests').select('*').eq('id', id).eq('status', 'pending').maybeSingle()
  if (readError) return { error: 'Could not load account request.' }
  if (!req) return { error: 'This request has already been reviewed.' }
  if (action === 'reject') {
    const { error } = await db.from('account_requests').update({ status: 'rejected', reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending')
    if (error) return { error: 'Request was not rejected.' }
    revalidatePath('/')
    return {}
  }
  const base = origin()
  if (!base) return { error: 'Set APP_URL to the reachable HTTPS address of this app before sending activation emails.' }

  const { data: profile, error: profileError } = await db.from('profiles').select('id,full_name,email,authorized').ilike('email', req.email).maybeSingle()
  if (profileError) return { error: 'Could not check for an existing account.' }
  if (profile?.authorized) return { error: 'An authorized account with this email already exists.' }

  let userId: string | null = profile?.id ?? req.linked_user_id ?? null
  let link: string | null = null
  let subject = 'SPCC Pass: Account approved'
  let message = 'Your SPCC Pass account has been approved. Sign in with your existing account credentials at ' + base + '/login'

  if (!profile || req.linked_user_id) {
    const kind = userId ? 'recovery' : 'invite'
    const { data, error } = kind === 'invite'
      ? await db.auth.admin.generateLink({ type: 'invite', email: req.email, options: { data: { full_name: req.full_name, type: req.requested_role } } })
      : await db.auth.admin.generateLink({ type: 'recovery', email: req.email })
    if (error || !data?.properties?.hashed_token || !data.user?.id) return { error: 'Activation link could not be generated. Check whether this email already has an account.' }
    userId = data.user.id
    if (req.linked_user_id && req.linked_user_id !== userId) return { error: 'Account identity mismatch.' }
    const { error: linkError } = await db.from('account_requests').update({ linked_user_id: userId }).eq('id', id).eq('status', 'pending')
    if (linkError) return { error: 'Could not save account invitation. Please retry.' }
    const token = encodeURIComponent(data.properties.hashed_token)
    link = base + '/auth/confirm?type=' + kind + '&token_hash=' + token
    subject = 'SPCC Pass: Activate your approved account'
    message = 'Your account request was approved. Open the secure link below to set your own password: ' + link + '\nThe link is private and expires automatically.'
  }

  if (!userId) return { error: 'No account was found.' }
  const safe = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch))
  const html = '<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:24px"><h2 style="color:#07095f">SPCC Pass</h2><p>Hello ' + safe(req.full_name) + ',</p><p>Your account request was approved by an administrator.</p>' + (link ? '<p><a href="' + safe(link) + '" style="display:inline-block;padding:12px 20px;background:#07095f;color:white;border-radius:8px;text-decoration:none">Activate account and set password</a></p>' : '<p>Use your existing login or linked Google account to sign in.</p>') + '<p style="color:#555">If you did not request access, contact the school.</p></div>'
  const delivery = await send(req.email, subject, message, html)
  if (delivery.status !== 'sent') return { error: 'Activation email was not accepted (' + delivery.status + '). Check Maileroo SMTP settings and retry approval.' }

  const { error: updateError } = await db.from('profiles').update({ full_name: req.full_name, role: req.requested_role, authorized: true }).eq('id', userId).eq('authorized', false)
  if (updateError) return { error: 'Email accepted, but authorization failed. Contact the administrator before retrying.' }
  const { error: requestError } = await db.from('account_requests').update({ status: 'approved', reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() }).eq('id', id).eq('status', 'pending')
  if (requestError) return { error: 'Account authorized, but review status failed to save.' }
  revalidatePath('/')
  return {}
}
