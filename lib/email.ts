import { admin } from './supabase/admin'
import { code, day } from './constants'

type Mailable = { id: number; requester_email: string; requester_name: string; department: string; date: string; time: string }

const EVENTS: Record<string, { subject: string; message: string }> = {
  'pending review': { subject: 'Request received', message: 'Your request has been sent to the office for review. It is not confirmed yet.' },
  approved: { subject: 'Appointment approved', message: 'The office has approved your appointment. Please arrive at the scheduled time.' },
  rejected: { subject: 'Request declined', message: 'The office has declined your appointment request. Sign in to review the status.' },
  rescheduled: { subject: 'Appointment rescheduled', message: 'Your appointment has a new date or time. Review the updated schedule below.' },
  cancelled: { subject: 'Appointment cancelled', message: 'Your appointment has been cancelled. The slot is no longer reserved.' },
}

async function send(to: string, subject: string, text: string) {
  if (!process.env.RESEND_API_KEY) return { status: 'skipped', detail: 'RESEND_API_KEY is not set' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'SPCC Appointments <onboarding@resend.dev>', to: [to], subject, text }),
    })
    return { status: res.ok ? 'sent' : 'failed', detail: res.ok ? '' : (await res.text()).slice(0, 300) }
  } catch (e) {
    return { status: 'failed', detail: String(e).slice(0, 300) }
  }
}

async function log(a: Mailable, to: string, event: string, r: { status: string; detail: string }) {
  const { error } = await admin().from('email_log').insert({ appointment_id: a.id, to_email: to, event, status: r.status, detail: r.detail })
  if (error) console.error('email log failed:', error.message)
}

export async function notify(a: Mailable, event: string) {
  const details = EVENTS[event] ?? { subject: 'Appointment update', message: 'The status of your appointment has changed.' }
  const text = [
    `Hello ${a.requester_name || 'there'},`,
    '',
    details.message,
    '',
    `Reference: ${code(a.id)}`,
    `Office: ${a.department}`,
    `Date: ${day(a.date)}`,
    `Time: ${a.time}`,
    '',
    'Sign in to IAVMS to check your appointment details.',
    '',
    'Systems Plus Computer College',
    'Caloocan Campus',
  ].join('\n')
  await log(a, a.requester_email, event, await send(a.requester_email, `IAVMS ${code(a.id)}: ${details.subject}`, text))
}

export async function notifyOffice(a: Mailable) {
  const db = admin()
  const { data: assigned } = await db.from('profiles').select('email').eq('role', 'approver').eq('department', a.department)
  const approvers = (assigned ?? []) as { email: string }[]
  const { data: administrators } = approvers.length ? { data: [] as { email: string }[] } : await db.from('profiles').select('email').eq('role', 'admin')
  const recipients = [...new Set([...approvers, ...((administrators ?? []) as { email: string }[])].map((p) => p.email))]
  for (const email of recipients) {
    const text = [
      'A new appointment request needs a decision.',
      '',
      `Reference: ${code(a.id)}`,
      `Office: ${a.department}`,
      `Requested date: ${day(a.date)}`,
      `Requested time: ${a.time}`,
      '',
      'Sign in to IAVMS to review the request. The time is not reserved until approval.',
      '',
      'Systems Plus Computer College',
      'Caloocan Campus',
    ].join('\n')
    await log(a, email, 'new request for review', await send(email, `IAVMS ${code(a.id)}: Request needs review`, text))
  }
}
