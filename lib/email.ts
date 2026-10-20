import { admin } from './supabase/admin'
import { code, day } from './constants'

type Mailable = { id: number; requester_email: string; requester_name: string; department: string; date: string; time: string }

async function send(to: string, subject: string, text: string) {
  if (!process.env.RESEND_API_KEY) return { status: 'skipped', detail: 'RESEND_API_KEY is not set' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'SPCC Appointments <onboarding@resend.dev>', to: [to], subject, text }),
    })
    return { status: res.ok ? 'sent' : 'failed', detail: res.ok ? '' : (await res.text()).slice(0, 300) }
  } catch (e) {
    return { status: 'failed', detail: String(e).slice(0, 300) }
  }
}

async function log(a: Mailable, to: string, event: string, r: { status: string; detail: string }) {
  await admin().from('email_log').insert({ appointment_id: a.id, to_email: to, event, status: r.status, detail: r.detail })
}

/** Tells the requester about a status or schedule change. The text carries no purpose or other personal detail. */
export async function notify(a: Mailable, event: string) {
  const text = `Hello ${a.requester_name},\n\nYour appointment with ${a.department} on ${day(a.date)} at ${a.time} is ${event}.\n\nSystems Plus Computer College, Caloocan`
  await log(a, a.requester_email, event, await send(a.requester_email, `SPCC appointment ${code(a.id)}: ${event}`, text))
}

/** Tells the office's approvers that a request is waiting. */
export async function notifyOffice(a: Mailable) {
  const { data } = await admin().from('profiles').select('email').eq('role', 'approver').eq('department', a.department)
  for (const s of (data ?? []) as { email: string }[]) {
    const text = `A new appointment request for ${a.department} is waiting for review (${code(a.id)}, ${day(a.date)} at ${a.time}). Sign in to the SPCC appointment system to review it.`
    await log(a, s.email, 'new request for review', await send(s.email, `SPCC appointment ${code(a.id)}: new request`, text))
  }
}
