import { CalendarDays, ClipboardCheck, Clock3, FileText, Grid2X2, LayoutDashboard, Settings, UsersRound, ShieldCheck } from 'lucide-react'

export type Tab = 'Summary' | 'Appointments' | 'Visitors' | 'Availability' | 'Reports' | 'Offices' | 'Email log' | 'Users' | 'Access requests'
export type Group = 'requester' | 'approver' | 'admin'

export const TABS: { id: Tab; icon: typeof Clock3; who: Group[] }[] = [
  { id: 'Summary', icon: LayoutDashboard, who: ['approver', 'admin'] },
  { id: 'Appointments', icon: CalendarDays, who: ['requester', 'approver', 'admin'] },
  { id: 'Visitors', icon: UsersRound, who: ['approver', 'admin'] },
  { id: 'Availability', icon: Clock3, who: ['approver', 'admin'] },
  { id: 'Reports', icon: FileText, who: ['admin'] },
  { id: 'Offices', icon: Grid2X2, who: ['admin'] },
  { id: 'Email log', icon: ClipboardCheck, who: ['admin'] },
  { id: 'Users', icon: Settings, who: ['admin'] },
  { id: 'Access requests', icon: ShieldCheck, who: ['admin'] },
]
export const INTRO: Record<Tab, string> = {
  Summary: 'Review pending decisions, confirmed appointments and visitor activity.',
  Appointments: 'Review appointment requests and their current status.',
  Visitors: 'Record arrivals and departures. Campus security authorizes entry.',
  Availability: 'Set the times each office accepts appointments, Monday to Friday.',
  Reports: 'Appointment totals by office and decision.',
  Offices: 'Manage the offices that accept appointment requests.',
  'Email log': 'Check delivery attempts for appointment notifications and account activation emails.',
  Users: 'Assign account roles, choose department approvers and manage visitor access.',
  'Access requests': 'Review student, faculty and visitor identities before granting accounts.',
}

export const TAB_TITLE: Record<Tab, string> = {
  Summary: 'Overview',
  Appointments: 'Appointments',
  Visitors: 'Visitor records',
  Availability: 'Office hours',
  Reports: 'Reports',
  Offices: 'Offices',
  'Email log': 'Email delivery',
  Users: 'Users',
  'Access requests': 'Access requests',
}
