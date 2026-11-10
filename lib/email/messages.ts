import { code, day } from '../constants'
import { appointmentEmailHtml, type AppointmentEmailHtml } from './html'

export type Mailable = { id: number; requester_email: string; requester_name: string; department: string; date: string; time: string }

const EVENTS: Record<string, { subject: string; message: string }> = {
  'pending review': { subject: 'Request received', message: 'Your request has been sent to the office for review. It is not confirmed yet.' },
  approved: { subject: 'Appointment approved', message: 'The office has approved your appointment. Please arrive at the scheduled time.' },
  rejected: { subject: 'Request declined', message: 'The office has declined your appointment request. Sign in to review the status.' },
  rescheduled: { subject: 'Appointment rescheduled', message: 'Your appointment has a new date or time. Review the updated schedule below.' },
  cancelled: { subject: 'Appointment cancelled', message: 'Your appointment has been cancelled. The slot is no longer reserved.' },
}

const EVENT_STATUS: Record<string, AppointmentEmailHtml['status']> = {
  'pending review': 'pending',
  approved: 'approved',
  rejected: 'rejected',
  rescheduled: 'rescheduled',
  cancelled: 'cancelled',
}

export function requesterMessage(a: Mailable, event: string) {
  const details = EVENTS[event] ?? { subject: 'Appointment update', message: 'The status of your appointment has changed.' }
  return {
    subject: `IAVMS ${code(a.id)}: ${details.subject}`,
    text: [
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
    ].join('\n'),
    html: appointmentEmailHtml({
      heading: details.subject,
      preheader: details.message,
      message: details.message,
      reference: code(a.id),
      office: a.department,
      date: day(a.date),
      time: a.time,
      status: EVENT_STATUS[event] ?? 'updated',
      greeting: `Hello ${a.requester_name || 'there'},`,
    }),
  }
}

export function approverMessage(a: Mailable) {
  return {
    subject: `IAVMS ${code(a.id)}: Request needs review`,
    text: [
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
    ].join('\n'),
    html: appointmentEmailHtml({
      heading: 'Appointment request needs review',
      preheader: 'A new appointment request needs an office decision.',
      message: 'A new appointment request has been submitted to your office. Review the details and decide whether to approve or decline it.',
      reference: code(a.id),
      office: a.department,
      date: day(a.date),
      time: a.time,
      status: 'pending',
      actionText: 'Sign in to IAVMS to review the request. The time is not reserved until approval.',
    }),
  }
}
