import nodemailer from 'nodemailer'
import * as tls from 'node:tls'
import { admin } from '../supabase/admin'
import type { Mailable } from './messages'

export type DeliveryResult = { status: 'sent' | 'failed' | 'skipped'; detail: string }

function trustedCAs(): string[] | undefined {
  if (typeof tls.getCACertificates !== 'function') return undefined
  try {
    const system = tls.getCACertificates('system')
    if (!system.length) return undefined
    return [...tls.getCACertificates('default'), ...system]
  } catch {
    return undefined
  }
}

function smtpError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/self.signed certificate|unable.to.verify|certificate chain|unable.to.get.(local.)?issuer|cert.has.expired|certificate.verify.failed/i.test(message)) {
    return 'SMTP TLS certificate validation failed. Check the SMTP hostname, system trust store, antivirus TLS inspection, and installed CA certificates. TLS verification remains enabled.'
  }
  return message.slice(0, 300)
}

async function sendSmtp(to: string, subject: string, text: string, html: string): Promise<DeliveryResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, EMAIL_FROM } = process.env
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !EMAIL_FROM) {
    return { status: 'skipped', detail: 'SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM must be set' }
  }
  const port = Number(SMTP_PORT || '587')
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { status: 'failed', detail: 'Invalid SMTP_PORT' }
  }
  const secure = SMTP_SECURE === undefined ? port === 465 : SMTP_SECURE === 'true'
  const certificates = trustedCAs()
  try {
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure,
      requireTLS: !secure,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { servername: SMTP_HOST, ...(certificates ? { ca: certificates } : {}) },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    })
    const info = await transport.sendMail({ from: EMAIL_FROM, to, subject, text, html })
    return { status: info.accepted.length > 0 ? 'sent' : 'failed', detail: info.accepted.length > 0 ? `SMTP accepted: ${String(info.response || 'Message queued').slice(0, 180)}` : 'SMTP server did not accept the recipient' }
  } catch (error) {
    return { status: 'failed', detail: smtpError(error) }
  }
}

async function sendResend(to: string, subject: string, text: string, html: string): Promise<DeliveryResult> {
  if (!process.env.RESEND_API_KEY) return { status: 'skipped', detail: 'RESEND_API_KEY is not set' }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'SPCC Appointments <onboarding@resend.dev>', to: [to], subject, text, html }),
    })
    return { status: res.ok ? 'sent' : 'failed', detail: res.ok ? '' : (await res.text()).slice(0, 300) }
  } catch (error) {
    return { status: 'failed', detail: String(error).slice(0, 300) }
  }
}

export async function send(to: string, subject: string, text: string, html: string): Promise<DeliveryResult> {
  const selected = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || (process.env.SMTP_HOST ? 'smtp' : 'resend')
  if (selected === 'smtp') return sendSmtp(to, subject, text, html)
  if (selected === 'resend') return sendResend(to, subject, text, html)
  if (selected === 'disabled') return { status: 'skipped', detail: 'Email delivery is disabled' }
  return { status: 'failed', detail: 'Unknown EMAIL_PROVIDER; select smtp, resend or disabled' }
}

export async function log(a: Mailable, to: string, event: string, r: DeliveryResult) {
  const { error } = await admin().from('email_log').insert({ appointment_id: a.id, to_email: to, event, status: r.status, detail: r.detail })
  if (error) console.error('email log failed:', error.message)
}

export async function logAccessDelivery(to: string, event: string, result: DeliveryResult) {
  const { error } = await admin().from('email_log').insert({
    appointment_id: null,
    to_email: to,
    event,
    status: result.status,
    detail: result.detail.slice(0, 400),
  })
  if (error) console.error('activation email delivery log failed:', error.message)
}
