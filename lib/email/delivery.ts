import nodemailer from 'nodemailer'
import { admin } from '../supabase/admin'
import type { Mailable } from './messages'

type DeliveryResult = { status: 'sent' | 'failed' | 'skipped'; detail: string }

async function sendSmtp(to: string, subject: string, text: string): Promise<DeliveryResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, EMAIL_FROM } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    return { status: 'skipped', detail: 'SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM must be set' }
  }
  const port = Number(SMTP_PORT || '587')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { status: 'failed', detail: 'Invalid SMTP_PORT' }
  }
  const secure = SMTP_SECURE === undefined ? port === 465 : SMTP_SECURE === 'true'
  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      requireTLS: !secure,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
    const info = await transport.sendMail({ from: EMAIL_FROM, to, subject, text })
    return { status: info.accepted.length > 0 ? 'sent' : 'failed', detail: info.accepted.length > 0 ? '' : 'SMTP server did not accept the recipient' }
  } catch (error) {
    return { status: 'failed', detail: String(error).slice(0, 300) }
  }
}

async function sendResend(to: string, subject: string, text: string): Promise<DeliveryResult> {
  if (!process.env.RESEND_API_KEY) return { status: 'skipped', detail: 'RESEND_API_KEY is not set' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'SPCC Appointments <onboarding@resend.dev>', to: [to], subject, text }),
    })
    return { status: res.ok ? 'sent' : 'failed', detail: res.ok ? '' : (await res.text()).slice(0, 300) }
  } catch (error) {
    return { status: 'failed', detail: String(error).slice(0, 300) }
  }
}

export async function send(to: string, subject: string, text: string): Promise<DeliveryResult> {
  const selected = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || (process.env.SMTP_HOST ? 'smtp' : 'resend')
  if (selected === 'smtp') return sendSmtp(to, subject, text)
  if (selected === 'resend') return sendResend(to, subject, text)
  if (selected === 'disabled') return { status: 'skipped', detail: 'Email delivery is disabled' }
  return { status: 'failed', detail: 'Unknown EMAIL_PROVIDER; select smtp, resend or disabled' }
}

export async function log(a: Mailable, to: string, event: string, r: DeliveryResult) {
  const { error } = await admin().from('email_log').insert({ appointment_id: a.id, to_email: to, event, status: r.status, detail: r.detail })
  if (error) console.error('email log failed:', error.message)
}
