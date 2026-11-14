'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { book, decide, slotStates } from '@/app/actions'
import { DatePicker } from '@/components/date-picker'
import { BusyButton, ConfirmButton, type Run } from '@/components/dashboard/shared'
import { IT_DEPARTMENT, IT_TEACHERS, SLOTS, code, day, initials, tone } from '@/lib/constants'
import type { Appt, SlotInfo } from '@/lib/types'

function SlotPicker({ department, date, value, onPick }: { department: string; date: string; value: string; onPick: (t: string) => void }) {
  const [slots, setSlots] = useState<SlotInfo[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let live = true
    setSlots(null)
    setFailed(false)
    slotStates(department, date)
      .then((result) => {
        if (!live) return
        setSlots(result)
        if (!result.length) setFailed(true)
      })
      .catch(() => {
        if (!live) return
        setSlots([])
        setFailed(true)
      })
    return () => { live = false }
  }, [department, date, retry])
  if (failed) return <div role="alert" className="muted-note">Appointment times could not be loaded. Check the server configuration and try again. <button type="button" className="secondary-button" onClick={() => setRetry((n) => n + 1)}>Retry</button></div>
  if (!slots) return <div className="slot-grid" aria-busy="true" aria-label="Loading appointment times">{SLOTS.map((t) => <span key={t} className="skeleton" />)}</div>
  const label = { open: 'Open', held: 'Request pending', booked: 'Booked', closed: 'Closed' }
  return <div className="slot-grid">{slots.map((s) => <button type="button" key={s.time} disabled={s.state === 'booked' || s.state === 'closed'} className={`choice-card ${value === s.time ? 'selected' : ''}`} onClick={() => onPick(s.time)}>{s.time}<small>{label[s.state]}</small></button>)}</div>
}

export function Wizard({ today, depts, own, run, busy }: { today: string; depts: string[]; own: string | null; run: Run; busy: boolean }) {
  const [step, setStep] = useState(1)
  const [department, setDepartment] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [purpose, setPurpose] = useState('')
  const ok = step === 1 ? !!department && (department !== IT_DEPARTMENT || !!teacherName) : step === 2 ? !!date && !!time : !!purpose.trim()
  return <div className="wizard">
    <div className="wizard-steps">{['Office', 'Time slot', 'Purpose'].map((s, i) => <span key={s} className={step >= i + 1 ? 'active' : ''}>{i + 1} {s}</span>)}</div>
    {step === 1 && <>
      <div className="choice-grid">{depts.filter((d) => d !== own).map((d) => <button type="button" key={d} className={`choice-card ${department === d ? 'selected' : ''}`} aria-pressed={department === d} onClick={() => { setDepartment(d); setTeacherName(''); setDate(''); setTime('') }}>{d}</button>)}</div>
      {department === IT_DEPARTMENT && <div className="teacher-select">
        <span className="field-label">Which College of IT teacher would you like to meet?</span>
        <div className="choice-grid" role="group" aria-label="Select College of IT teacher">
          {IT_TEACHERS.map((teacher) => <button type="button" key={teacher} aria-pressed={teacherName === teacher} className={`choice-card ${teacherName === teacher ? 'selected' : ''}`} onClick={() => { setTeacherName(teacher); setDate(''); setTime('') }}>{teacher}</button>)}
        </div>
      </div>}
    </>
    {step === 2 && <><DatePicker id="appt-date" label="Date" value={date} min={today} onChange={(next) => { setDate(next); setTime('') }} />{date ? <><SlotPicker department={department} date={date} value={time} onPick={setTime} /><p className="muted-note">A request is not a confirmed booking until the office approves it. Pending requests leave the slot available.</p></> : <p className="muted-note">Office hours run Monday to Friday, 9:00 AM to 3:00 PM.</p>}</>}
    {step === 3 && <><label className="field-label" htmlFor="appt-purpose">What is the appointment for?</label><textarea id="appt-purpose" className="field-input" rows={4} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></>}
    <div className="form-actions">{step > 1 && <button className="secondary-button" onClick={() => setStep(step - 1)}>Back</button>}
      {step < 3 ? <button className="primary-button" disabled={!ok} onClick={() => setStep(step + 1)}>Continue</button> : <BusyButton label="Submit request" className="primary-button" disabled={!ok || busy} onClick={() => run(() => book({ department, teacher_name: department === IT_DEPARTMENT ? teacherName : null, date, time, purpose }), 'Request submitted. Waiting for office approval.')}>Submit request</BusyButton>}</div></div>
}

export function Review({ a, today, run, busy }: { a: Appt; today: string; run: Run; busy: boolean }) {
  const [resched, setResched] = useState(a.status !== 'Pending')
  const [date, setDate] = useState(a.date)
  const [time, setTime] = useState('')
  return <>
    <div className="review-summary"><span className={`avatar avatar-${tone(a.id)}`}>{initials(a.requester_name)}</span><div><strong>{a.requester_name}</strong><span>{a.department} · {day(a.date)} at {a.time}</span>{a.teacher_name && <span>Teacher: {a.teacher_name}</span>}<span>{a.purpose}</span></div></div>
    {resched && <><DatePicker id="new-date" label="New date" value={date} min={today} onChange={(next) => { setDate(next); setTime('') }} /><SlotPicker department={a.department} date={date} value={time} onPick={setTime} /></>}
    <div className="form-actions">{a.status === 'Pending' && !resched && <ConfirmButton label="Reject" confirmLabel="Confirm reject" disabled={busy} onConfirm={() => run(() => decide(a.id, 'reject'), 'Request rejected')} />}
      {resched ? <BusyButton label="Confirm new time" className="primary-button" disabled={!time || busy} onClick={() => run(() => decide(a.id, 'reschedule', { date, time }), 'Request rescheduled')}>Confirm new time</BusyButton>
        : <><button className="secondary-button" onClick={() => setResched(true)}>Reschedule</button>{a.status === 'Pending' && <BusyButton label="Approve" className="primary-button" disabled={busy} onClick={() => run(() => decide(a.id, 'approve'), 'Request approved')}><Check /> Approve</BusyButton>}</>}</div></>
}
