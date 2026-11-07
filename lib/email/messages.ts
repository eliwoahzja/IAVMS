import { code, day } from '../constants'

export type Mailable = { id: number; requester_email: string; requester_name: string; department: string; date: string; time: string }

const EVENTS: Record<string, { subject: string; message: string }> = {
  'pending review': { subject: 'Request received', message: 'Your request has been sent to the office for review. It is not confirmed yet.' },
  approved: { subject: 'Appointment approved', message: 'The office has approved your appointment. Please arrive at the scheduled time.' },
  rejected: { subject: 'Request declined', message: 'The office has declined your appointment request. Sign in to review the status.' },
  rescheduled: { subject: 'Appointment rescheduled', message: 'Your appointment has a new date or time. Review the updated schedule below.' },
  cancelled: { subject: 'Appointment cancelled', message: 'Your appointment has been cancelled. The slot is no longer reserved.' },
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
  }
}
