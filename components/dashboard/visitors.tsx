'use client'

import { useState } from 'react'
import { registerVisitor } from '@/app/actions'
import { BusyButton, type Run } from '@/components/dashboard/shared'
import { code } from '@/lib/constants'
import type { Appt, Profile } from '@/lib/types'

export function VisitorForm({ profile, depts, appts, run, busy }: { profile: Profile; depts: string[]; appts: Appt[]; run: Run; busy: boolean }) {
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [department, setDepartment] = useState(profile.department ?? depts[0])
  const [apptId, setApptId] = useState('')
  const linkable = appts.filter((x) => x.department === department && x.requester_type === 'visitor' && (x.status === 'Approved' || x.status === 'Rescheduled'))
  return <>
    <label className="field-label" htmlFor="v-name">Visitor name</label><input id="v-name" className="field-input" value={name} onChange={(e) => setName(e.target.value)} />
    <label className="field-label" htmlFor="v-purpose">Purpose</label><input id="v-purpose" className="field-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
    <label className="field-label" htmlFor="v-dept">Destination office</label><select id="v-dept" className="field-input" value={department} disabled={profile.role === 'approver'} onChange={(e) => { setDepartment(e.target.value); setApptId('') }}>{depts.map((d) => <option key={d}>{d}</option>)}</select>
    <label className="field-label" htmlFor="v-appt">Appointment reference (optional)</label><select id="v-appt" className="field-input" value={apptId} onChange={(e) => setApptId(e.target.value)}><option value="">None</option>{linkable.map((x) => <option key={x.id} value={x.id}>{code(x.id)} · {x.requester_name}</option>)}</select>
    <div className="form-actions"><BusyButton label="Save record" className="primary-button" disabled={!name.trim() || !purpose.trim() || busy} onClick={() => run(() => registerVisitor({ name, purpose, department, appointmentId: apptId ? Number(apptId) : null }), 'Visitor registered')}>Save record</BusyButton></div></>
}
