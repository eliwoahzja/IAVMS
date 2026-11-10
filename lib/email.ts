import { admin } from './supabase/admin'
import { send, log } from './email/delivery'
import { approverMessage, requesterMessage, type Mailable } from './email/messages'

export async function notify(a: Mailable, event: string) {
  const message = requesterMessage(a, event)
  await log(a, a.requester_email, event, await send(a.requester_email, message.subject, message.text, message.html))
}

export async function notifyOffice(a: Mailable) {
  const db = admin()
  const { data: assigned } = await db.from('profiles').select('email').eq('role', 'approver').eq('department', a.department)
  const approvers = (assigned ?? []) as { email: string }[]
  const { data: administrators } = approvers.length ? { data: [] as { email: string }[] } : await db.from('profiles').select('email').eq('role', 'admin')
  const recipients = [...new Set([...approvers, ...((administrators ?? []) as { email: string }[])].map((p) => p.email))]
  const message = approverMessage(a)
  for (const email of recipients) {
    await log(a, email, 'new request for review', await send(email, message.subject, message.text, message.html))
  }
}
