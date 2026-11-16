import { revalidatePath } from 'next/cache'
import { admin } from '@/lib/supabase/admin'
import { send, logAccessDelivery } from '@/lib/email/delivery'
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

  if (action === 'reject') {
    const { data, error } = await db.from('account_requests')
      .update({ status: 'rejected', reviewed_by: reviewer.id, reviewed_at: new Date().toISOString() })
      .eq('id', id).eq('status', 'pending').select('id').maybeSingle()
    if (error) return { error: 'Request was not rejected.' }
    if (!data) return { error: 'Another administrator already started reviewing this request.' }
    revalidatePath('/')
    return {}
  }

  const base = origin()
  if (!base) return { error: 'Set APP_URL to a reachable HTTPS address for recipients outside your device.' }
  const { data: req, error: claimError } = await db.rpc('claim_account_review', {
    p_request_id: id, p_reviewer: reviewer.id,
  })
  if (claimError) return { error: 'Could not reserve this request for review. Try again.' }
  if (!req?.id || !req.reviewed_at) return { error: 'This request is already being reviewed or has been completed. A stalled review becomes retryable after 10 minutes.' }

  let completed = false
  try {
    const { data: profile, error: profileError } = await db.from('profiles')
      .select('id,email,authorized').eq('email', req.email).maybeSingle()
    if (profileError) throw new Error('Could not check the existing account.')
    if (profile?.authorized) throw new Error('An authorized account already exists for this address.')

    const previousId = req.linked_user_id ?? profile?.id ?? null
    const kind = previousId ? 'recovery' : 'invite'
    const { data: authLink, error: authError } = kind === 'invite'
      ? await db.auth.admin.generateLink({
          type: 'invite', email: req.email,
          options: { data: { full_name: req.full_name, type: req.requested_role } },
        })
      : await db.auth.admin.generateLink({ type: 'recovery', email: req.email })
    if (authError || !authLink?.properties?.hashed_token || !authLink.user?.id) {
      throw new Error('Could not generate an activation link. Check the authentication record.')
    }
    const userId = authLink.user.id
    if (previousId && previousId !== userId) throw new Error('The authentication account does not match the request.')

    const { error: linkedError } = await db.from('account_requests')
      .update({ linked_user_id: userId }).eq('id', id)
      .eq('status', 'processing').eq('reviewed_by', reviewer.id).eq('reviewed_at', req.reviewed_at)
    if (linkedError) throw new Error('Could not save the activation account.')

    const { data: approved, error: approveError } = await db.rpc('complete_account_review', {
      p_request_id: id, p_reviewer: reviewer.id,
      p_claimed_at: req.reviewed_at, p_user: userId,
    })
    if (approveError || !approved) throw new Error('Could not finalize authorization. Retry the review.')
    completed = true
    revalidatePath('/')

    const link = base + '/auth/confirm?type=' + kind
      + '&token_hash=' + encodeURIComponent(authLink.properties.hashed_token)
    const safe = (value: string) => value.replace(/[&<>"']/g, ch =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch))
    const subject = 'SPCC Pass: Activate your approved account'
    const message = 'Your account request was approved. Open this private link to set your password: '
      + link + '\nThis link expires automatically.'
    const html = '<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:24px">'
      + '<h2 style="color:#07095f">SPCC Pass</h2><p>Hello ' + safe(req.full_name)
      + ',</p><p>Your account is approved.</p><p><a href="' + safe(link)
      + '" style="display:inline-block;padding:12px 20px;background:#07095f;color:white;border-radius:8px;text-decoration:none">'
      + 'Set your account password</a></p><p>If you did not request this, contact your school administrator.</p></div>'
    const delivery = await send(req.email, subject, message, html)
    await logAccessDelivery(req.email, 'account activation', delivery)
    if (delivery.status !== 'sent') {
      return { error: 'Account approved, but the activation email was not accepted. Use Resend activation email under Approved accounts after checking your email provider.' }
    }
    return {}
  } catch (err) {
    console.error('Account review failed:', err instanceof Error ? err.message : 'Unknown error')
    return { error: err instanceof Error ? err.message : 'Account approval failed. Retry this request.' }
  } finally {
    if (!completed) {
      const { error } = await db.rpc('release_account_review', {
        p_request_id: id, p_reviewer: reviewer.id, p_claimed_at: req.reviewed_at,
      })
      if (error) console.error('Could not release failed access review:', error.message)
    }
  }
}


export async function resendActivation(id: string): Promise<R> {
  const reviewer = await me()
  if (reviewer.role !== 'admin') return { error: 'Only administrators can resend activation emails.' }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { error: 'Invalid activation request.' }
  const base = origin()
  if (!base) return { error: 'APP_URL must be a reachable HTTPS address for recipients on another device. Localhost only works on the server device.' }
  const db = admin()
  const { data: req, error: readError } = await db.from('account_requests')
    .select('id,email,full_name,linked_user_id,status')
    .eq('id', id).eq('status', 'approved').maybeSingle()
  if (readError || !req) return { error: 'Approved activation request was not found.' }
  if (!req.linked_user_id) return { error: 'This approved request has no linked authentication account. Check its user record.' }
  const { data: profile, error: profileError } = await db.from('profiles')
    .select('id,email,authorized').eq('id', req.linked_user_id).maybeSingle()
  if (profileError || !profile || !profile.authorized || profile.email.toLowerCase() !== req.email.toLowerCase()) {
    return { error: 'The approved account could not be verified. No email was sent.' }
  }
  const { data: recent, error: recentError } = await db.from('email_log')
    .select('created_at').eq('to_email', req.email).eq('event', 'activation resend')
    .eq('status', 'sent').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (recentError) return { error: 'Could not check the resend history.' }
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60000) {
    return { error: 'An activation email was sent recently. Check your inbox and retry after a minute.' }
  }
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email: req.email })
  if (error || !data?.properties?.hashed_token || data.user?.id !== profile.id) {
    await logAccessDelivery(req.email, 'activation resend', { status: 'failed', detail: 'Could not generate a password setup link: ' + (error?.message ?? 'Authentication user mismatch').slice(0, 220) })
    return { error: 'Could not generate a new activation link. Check the authentication user and try again.' }
  }
  const link = base + '/auth/confirm?type=recovery&token_hash=' + encodeURIComponent(data.properties.hashed_token)
  const safe = (value: string) => value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch))
  const subject = 'SPCC Pass: Set your approved account password'
  const body = 'Your approved account has a new password setup link. Open this private link to set your password: ' + link + '\nIf you did not request this, contact your school administrator.'
  const html = '<div style="font-family:Arial,sans-serif;max-width:540px;margin:auto;padding:24px"><h2 style="color:#07095f">SPCC Pass</h2><p>Hello ' + safe(req.full_name) + ',</p><p>Your administrator has sent a new password setup link for your approved account.</p><p><a href="' + safe(link) + '" style="display:inline-block;padding:12px 20px;background:#07095f;color:#fff;border-radius:8px;text-decoration:none">Set your password</a></p><p>This link is private and expires automatically. If you did not request this, contact your administrator.</p></div>'
  const delivery = await send(req.email, subject, body, html)
  await logAccessDelivery(req.email, 'activation resend', delivery)
  if (delivery.status !== 'sent') return { error: 'Email provider did not accept the message (' + delivery.status + '): ' + delivery.detail.slice(0, 160) }
  revalidatePath('/')
  return {}
}
