import { admin } from '../supabase/admin'
import type { Mailable } from './messages'

export async function send(to: string, subject: string, text: string) {
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

export async function log(a: Mailable, to: string, event: string, r: { status: string; detail: string }) {
  const { error } = await admin().from('email_log').insert({ appointment_id: a.id, to_email: to, event, status: r.status, detail: r.detail })
  if (error) console.error('email log failed:', error.message)
}
