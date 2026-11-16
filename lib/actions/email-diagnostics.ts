import { revalidatePath } from 'next/cache'
import { admin } from '@/lib/supabase/admin'
import { logAccessDelivery, send } from '@/lib/email/delivery'
import { me } from './context'
import type { R } from '@/lib/types'

export async function sendDiagnosticEmail(): Promise<R> {
  const actor = await me()
  if (actor.role !== 'admin' || !actor.authorized) return { error: 'Only authorized administrators can test email delivery.' }
  const db = admin()
  const { data: recent, error: readError } = await db.from('email_log')
    .select('created_at')
    .eq('to_email', actor.email)
    .eq('event', 'email diagnostic')
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (readError) return { error: 'Could not check the email diagnostic history.' }
  if (recent && Date.now() - new Date(recent.created_at).getTime() < 60000) {
    return { error: 'A diagnostic email was accepted recently. Retry after one minute.' }
  }
  const message = 'This is an IAVMS test email. If you received it, SMTP is delivering to this inbox. The Email delivery tab records provider acceptance only.'
  const html = '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:28px"><h2 style="color:#07095f">SPCC Pass email test</h2><p>' + message + '</p><p>Sent to your administrator email address.</p></div>'
  const delivery = await send(actor.email, 'SPCC Pass: Email delivery test', message, html)
  await logAccessDelivery(actor.email, 'email diagnostic', delivery)
  if (delivery.status !== 'sent') {
    return { error: 'Email not accepted (' + delivery.status + '): ' + delivery.detail.slice(0, 160) }
  }
  revalidatePath('/')
  return {}
}
