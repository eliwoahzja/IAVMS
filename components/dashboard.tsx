'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react'
import { CalendarDays, Check, ClipboardCheck, Clock3, FileText, Grid2X2, LayoutDashboard, Menu, Plus, Search, Settings, UsersRound, X } from 'lucide-react'
import { book, cancel, decide, markVisit, registerVisitor, saveOffice, setAuthorized, setUserRole, signOut, slotStates, toggleSlot } from '@/app/actions'
import { ROLES, SLOTS, STATUSES, TYPE_LABEL, WEEKDAYS, code, day, initials, personLabel, tone } from '@/lib/constants'
import { project, rubberband, springTo } from '@/lib/spring'
import type { Appt, Avail, Dept, MailRow, Profile, R, Role, SlotInfo, Status, Visitor } from '@/lib/types'

type Tab = 'Summary' | 'Appointments' | 'Visitors' | 'Availability' | 'Reports' | 'Offices' | 'Email log' | 'Users'
type Group = 'requester' | 'approver' | 'admin'
type Modal = null | 'book' | 'visitor' | { review: Appt }
type Run = (fn: () => Promise<R>, ok: string) => void

const TABS: { id: Tab; icon: typeof Clock3; who: Group[] }[] = [
  { id: 'Summary', icon: LayoutDashboard, who: ['approver', 'admin'] },
  { id: 'Appointments', icon: CalendarDays, who: ['requester', 'approver', 'admin'] },
  { id: 'Visitors', icon: UsersRound, who: ['approver', 'admin'] },
  { id: 'Availability', icon: Clock3, who: ['approver', 'admin'] },
  { id: 'Reports', icon: FileText, who: ['admin'] },
  { id: 'Offices', icon: Grid2X2, who: ['admin'] },
  { id: 'Email log', icon: ClipboardCheck, who: ['admin'] },
  { id: 'Users', icon: Settings, who: ['admin'] },
]
const INTRO: Record<Tab, string> = {
  Summary: 'Counts by status and the next scheduled appointments.',
  Appointments: 'Requests for your office and your own bookings.',
  Visitors: 'Visitor records for your office. Campus security controls entry.',
  Availability: 'Tick the slots this office accepts, Monday to Friday.',
  Reports: 'Requests by office and status.',
  Offices: 'Turn offices on or off for booking, or add a new one.',
  'Email log': 'Emails sent for appointment changes.',
  Users: 'Set roles, assign approvers to offices and authorize visitors.',
}

const stamp = (iso: string) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })

type Props = { profile: Profile; appts: Appt[]; visitors: Visitor[]; avail: Avail[]; users: Profile[]; emails: MailRow[]; departments: Dept[]; today: string }

export function Dashboard({ profile, appts, visitors, avail, users, emails, departments, today }: Props) {
  const group: Group = profile.role === 'admin' ? 'admin' : profile.role === 'approver' ? 'approver' : 'requester'
  const staff = group !== 'requester'
  const depts = departments.filter((d) => d.active).map((d) => d.name)
  const tabs = TABS.filter((t) => t.who.includes(group))
  const [tab, setTab] = useState<Tab>(tabs[0].id)
  const [menuOpen, setMenuOpen] = useState(false)
  const [modal, setModal] = useState<Modal>(null)
  const [filter, setFilter] = useState<Status | 'All'>(staff ? 'Pending' : 'All')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [toastError, setToastError] = useState(false)
  const [busy, start] = useTransition()

  const run: Run = (fn, ok) => start(async () => {
    const r = await fn()
    setToast(r.error ?? ok)
    setToastError(!!r.error)
    if (!r.error) setModal(null)
    window.setTimeout(() => setToast(''), 3500)
  })

  const count = (s: Status) => appts.filter((a) => a.status === s).length
  const list = useMemo(() => appts.filter((a) => (filter === 'All' || a.status === filter) && `${a.requester_name} ${a.department} ${code(a.id)}`.toLowerCase().includes(search.toLowerCase())), [appts, filter, search])
  const upcoming = appts.filter((a) => (a.status === 'Approved' || a.status === 'Rescheduled') && a.date >= today).slice(0, 6)

  return <div className="app-shell">
    {busy && <div className="progress" role="progressbar" aria-label="Saving" />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><img className="brand-seal" src="/seal.png" alt="" width={38} height={38} /><div><p className="brand-name">SPCC</p><p className="brand-subtitle">Caloocan campus</p></div><button className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X /></button></div>
      <nav className="main-nav" aria-label="Main navigation">
        {tabs.map(({ id, icon: Icon }) => <button key={id} type="button" className={`nav-item ${tab === id ? 'nav-item-active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setMenuOpen(false) }}><Icon /><span>{id}</span>{id === 'Appointments' && staff && count('Pending') > 0 && <b>{count('Pending')}</b>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-card">
          <div className="user-card-top"><span className={`avatar avatar-${tone(profile.full_name.length)}`}>{initials(profile.full_name)}</span><div><strong>{personLabel(profile.full_name) || profile.email}</strong><small>{profile.email}</small></div></div>
          <span className="user-card-role">{TYPE_LABEL[profile.role] ?? profile.role}</span>
        </div>
        <form action={signOut}><button className="signout">Sign out</button></form>
        <p className="privacy-text">Personal data is handled under the Data Privacy Act of 2012 (RA 10173).</p>
      </div>
    </aside>

    <main className="main-content">
      <header className="topbar"><button className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{tab}</strong></div>
        {tab === 'Appointments' && <div className="topbar-actions"><div className="search-wrap"><Search /><input aria-label="Search appointments" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests" /></div></div>}</header>
      <div className="content-wrap">
        <section className="page-intro"><div><h1>{tab}</h1><p className="intro-copy">{tab === 'Appointments' && !staff ? 'Your requests and their status.' : INTRO[tab]}</p></div>
          {profile.role !== 'admin' && tab === 'Appointments' && <button className="primary-button" disabled={!profile.authorized} onClick={() => setModal('book')}><Plus /> New appointment</button>}
          {staff && tab === 'Visitors' && <button className="primary-button" onClick={() => setModal('visitor')}><Plus /> Register visitor</button>}</section>

        {!profile.authorized && tab === 'Appointments' && <p className="auth-note" role="status">Staff must authorize your account before you can book.</p>}
        {tab === 'Summary' && <>
          <section className="metric-grid">
            <Metric label="Pending review" value={count('Pending')} tone="coral" />
            <Metric label="Approved" value={count('Approved') + count('Rescheduled')} tone="sage" />
            <Metric label="All requests" value={appts.length} tone="lavender" />
            <Metric label="Visitor records" value={visitors.length} tone="sand" />
          </section>
          <div className="panel"><div className="panel-heading"><div><h2>Upcoming appointments</h2></div></div>
            <div className="request-list">{upcoming.length ? upcoming.map((a, i) => <ApptRow key={a.id} a={a} i={i} />) : <p className="empty-copy">Nothing scheduled.</p>}</div></div></>}

        {tab === 'Appointments' && <div className="panel"><div className="panel-heading"><div><h2>{list.length} {list.length === 1 ? 'request' : 'requests'}</h2></div>
          <div className="filters"><label className="modal-label" htmlFor="f-status">Status</label><select id="f-status" className="modal-input" value={filter} onChange={(e) => setFilter(e.target.value as Status | 'All')}><option>All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <div className="request-list">{list.length ? list.map((a, i) => <ApptRow key={a.id} a={a} i={i} actions={<>
            {staff && (group === 'admin' || a.department === profile.department) && ['Pending', 'Approved', 'Rescheduled'].includes(a.status) && <button className="secondary-button" onClick={() => setModal({ review: a })}>{a.status === 'Pending' ? 'Review' : 'Reschedule'}</button>}
            {(a.requester_id === profile.id || group === 'admin') && ['Pending', 'Approved', 'Rescheduled'].includes(a.status) && <ConfirmButton label="Cancel" confirmLabel="Confirm cancel" disabled={busy} onConfirm={() => run(() => cancel(a.id), 'Appointment cancelled')} />}</>} />) : <p className="empty-copy">No requests match.</p>}</div></div>}

        {tab === 'Visitors' && <div className="panel"><div className="request-list">{visitors.length ? visitors.map((v) => <div className="request-row" key={v.id}><span className={`avatar avatar-${tone(v.id)}`}>{initials(v.name)}</span><span className="request-person"><strong>{v.name}</strong><span>{v.purpose}{v.appointment_id ? ` · ${code(v.appointment_id)}` : ''}</span></span><span className="request-detail"><strong>{v.department}</strong><span>{v.arrived_at ? `Arrived ${stamp(v.arrived_at)}` : 'Not arrived'}{v.left_at ? ` · Left ${stamp(v.left_at)}` : ''}</span></span><span className="row-actions">{!v.arrived_at && <button className="secondary-button" disabled={busy} onClick={() => run(() => markVisit(v.id, 'arrived_at'), 'Arrival recorded')}>Mark arrived</button>}{v.arrived_at && !v.left_at && <button className="secondary-button" disabled={busy} onClick={() => run(() => markVisit(v.id, 'left_at'), 'Departure recorded')}>Mark left</button>}</span></div>) : <p className="empty-copy">No visitors registered.</p>}</div></div>}

        {tab === 'Availability' && <Availability profile={profile} avail={avail} depts={depts} run={run} />}

        {tab === 'Reports' && <div className="panel table-wrap"><table className="table"><thead><tr><th>Office</th>{STATUSES.map((s) => <th key={s}>{s}</th>)}<th>Total</th></tr></thead>
          <tbody>{depts.map((d) => <tr key={d}><td>{d}</td>{STATUSES.map((s) => <td key={s}>{appts.filter((a) => a.department === d && a.status === s).length}</td>)}<td>{appts.filter((a) => a.department === d).length}</td></tr>)}</tbody></table></div>}

        {tab === 'Offices' && <Offices departments={departments} run={run} busy={busy} />}

        {tab === 'Email log' && <div className="panel"><div className="request-list">{emails.length ? emails.map((m) => <div className="request-row" key={m.id}><span className="request-person"><strong>{m.appointment_id ? code(m.appointment_id) : 'No reference'}: {m.event}</strong><span>{m.to_email}</span></span><span className="request-detail"><strong>{m.status}</strong><span>{m.detail || stamp(m.created_at)}</span></span></div>) : <p className="empty-copy">No emails yet.</p>}</div></div>}

        {tab === 'Users' && <div className="panel"><div className="request-list">{users.map((u) => <UserRow key={u.id} u={u} self={u.id === profile.id} depts={depts} run={run} busy={busy} />)}</div></div>}
      </div>
    </main>

    {typeof modal === 'object' && modal && <ModalBox title={`Review ${code(modal.review.id)}`} onClose={() => setModal(null)}><Review a={modal.review} run={run} busy={busy} /></ModalBox>}
    {modal === 'book' && <ModalBox title="New appointment" onClose={() => setModal(null)}><Wizard today={today} depts={depts} own={profile.role === 'approver' ? profile.department : null} run={run} busy={busy} /></ModalBox>}
    {modal === 'visitor' && <ModalBox title="Register a visitor" onClose={() => setModal(null)}><VisitorForm profile={profile} depts={depts} appts={appts} run={run} busy={busy} /></ModalBox>}
    {toast && <div className={`toast ${toastError ? 'toast-error' : ''}`} role={toastError ? 'alert' : 'status'}>{toastError ? <X /> : <Check />} {toast}</div>}
  </div>
}

function Metric({ label, value, tone: t }: { label: string; value: number; tone: string }) {
  return <div className={`metric-card metric-${t}`}><strong className="metric-value">{value}</strong><span className="metric-label">{label}</span></div>
}

function ApptRow({ a, i = 0, actions }: { a: Appt; i?: number; actions?: React.ReactNode }) {
  return <div className="request-row" style={{ '--i': Math.min(i, 8) } as React.CSSProperties}><span className={`avatar avatar-${tone(a.id)}`}>{initials(a.requester_name)}</span>
    <span className="request-person"><strong>{a.requester_name}</strong><span>{TYPE_LABEL[a.requester_type] ?? a.requester_type} · {code(a.id)}</span></span>
    <span className="request-detail"><strong>{a.department}</strong><span>{day(a.date)} · {a.time}</span><span>{a.purpose}</span></span>
    <span className={`status-pill status-${a.status.toLowerCase()}`}><span />{a.status}</span>
    {actions && <span className="row-actions">{actions}</span>}</div>
}

function ModalBox({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const card = useRef<HTMLElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  const offset = useRef(0)
  const stop = useRef<() => void>(() => {})
  const closeRef = useRef<() => void>(() => {})
  const drag = useRef<{ startY: number; startOffset: number; samples: { t: number; y: number }[] } | null>(null)
  const isSheet = () => window.matchMedia('(max-width: 780px)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function apply(v: number) {
    offset.current = v
    const c = card.current
    if (!c) return
    c.style.transform = `translate3d(0, ${v}px, 0)`
    if (scrim.current) scrim.current.style.opacity = String(Math.max(0, 1 - (Math.max(0, v) / (c.offsetHeight || 1)) * 0.9))
  }
  // Every move starts from the sheet's live position and velocity, so a grab mid-flight never jumps.
  function settle(to: number, velocity: number, done?: () => void) {
    stop.current()
    stop.current = springTo(offset.current, to, velocity, 0.4, apply, done)
  }
  closeRef.current = () => { if (isSheet() && card.current) settle(card.current.offsetHeight, 0, onClose); else onClose() }

  useLayoutEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    card.current?.focus({ preventScroll: true })
    if (isSheet() && card.current) { apply(card.current.offsetHeight); settle(0, 0) }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeRef.current(); return }
      if (e.key !== 'Tab' || !card.current) return
      const f = Array.from(card.current.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, textarea'))
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      const at = document.activeElement
      if (e.shiftKey && (at === first || at === card.current)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && at === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    return () => { window.removeEventListener('keydown', key); document.body.style.overflow = ''; stop.current(); prev?.focus?.() }
  }, [])

  function down(e: React.PointerEvent<HTMLDivElement>) {
    if (!isSheet() || (e.target as HTMLElement).closest('button')) return
    stop.current()
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startOffset: offset.current, samples: [{ t: e.timeStamp, y: e.clientY }] }
  }
  function move(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current
    if (!d || !card.current) return
    const raw = e.clientY - d.startY + d.startOffset
    apply(raw >= 0 ? raw : -rubberband(-raw, card.current.offsetHeight))
    d.samples = [...d.samples.slice(-4), { t: e.timeStamp, y: e.clientY }]
  }
  function up() {
    const d = drag.current
    drag.current = null
    if (!d || !card.current) return
    const a = d.samples[0]
    const b = d.samples[d.samples.length - 1]
    const v = b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0
    const h = card.current.offsetHeight
    // Release velocity decides the outcome; position plus projected momentum breaks ties.
    const dismiss = v > 900 || (v > -900 && offset.current + project(v) > h * 0.5)
    if (dismiss) settle(h, v, onClose)
    else settle(0, v)
  }

  return <div className="modal-backdrop" role="presentation">
    <div ref={scrim} className="modal-scrim" onPointerDown={() => closeRef.current()} />
    <section ref={card} className="modal-card" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="sheet-handle" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
        <div className="sheet-grip" aria-hidden="true" />
        <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={() => closeRef.current()} aria-label="Close dialog"><X /></button></div>
      </div>
      {children}
    </section>
  </div>
}

function SlotPicker({ department, date, value, onPick }: { department: string; date: string; value: string; onPick: (t: string) => void }) {
  const [slots, setSlots] = useState<SlotInfo[] | null>(null)
  useEffect(() => {
    let live = true
    setSlots(null)
    slotStates(department, date).then((s) => { if (live) setSlots(s) })
    return () => { live = false }
  }, [department, date])
  if (!slots) return <div className="slot-grid" aria-busy="true">{SLOTS.map((t) => <span key={t} className="skeleton" />)}</div>
  const label = { open: 'Open', held: 'Request pending', booked: 'Booked', closed: 'Closed' }
  return <div className="slot-grid">{slots.map((s) => <button type="button" key={s.time} disabled={s.state === 'booked' || s.state === 'closed'} className={`choice-card ${value === s.time ? 'selected' : ''}`} onClick={() => onPick(s.time)}>{s.time}<small>{label[s.state]}</small></button>)}</div>
}

function Wizard({ today, depts, own, run, busy }: { today: string; depts: string[]; own: string | null; run: Run; busy: boolean }) {
  const [step, setStep] = useState(1)
  const [department, setDepartment] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [purpose, setPurpose] = useState('')
  const ok = step === 1 ? !!department : step === 2 ? !!date && !!time : !!purpose.trim()
  return <div className="wizard">
    <div className="wizard-steps">{['Office', 'Time slot', 'Purpose'].map((s, i) => <span key={s} className={step >= i + 1 ? 'active' : ''}>{i + 1} {s}</span>)}</div>
    {step === 1 && <div className="choice-grid">{depts.filter((d) => d !== own).map((d) => <button type="button" key={d} className={`choice-card ${department === d ? 'selected' : ''}`} onClick={() => setDepartment(d)}>{d}</button>)}</div>}
    {step === 2 && <><label className="modal-label" htmlFor="appt-date">Date</label><input id="appt-date" type="date" min={today} className="modal-input" value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} />{date && <><SlotPicker department={department} date={date} value={time} onPick={setTime} /><p className="muted-note">Only approved or rescheduled bookings block a slot. Pending requests do not.</p></>}</>}
    {step === 3 && <><label className="modal-label" htmlFor="appt-purpose">What is the appointment for?</label><textarea id="appt-purpose" className="modal-input" rows={4} value={purpose} onChange={(e) => setPurpose(e.target.value)} /></>}
    <div className="modal-actions">{step > 1 && <button className="secondary-button" onClick={() => setStep(step - 1)}>Back</button>}
      {step < 3 ? <button className="primary-button" disabled={!ok} onClick={() => setStep(step + 1)}>Continue</button> : <button className="primary-button" disabled={!ok || busy} onClick={() => run(() => book({ department, date, time, purpose }), 'Request submitted')}>Submit request</button>}</div></div>
}

function Review({ a, run, busy }: { a: Appt; run: Run; busy: boolean }) {
  const [resched, setResched] = useState(a.status !== 'Pending')
  const [date, setDate] = useState(a.date)
  const [time, setTime] = useState('')
  return <>
    <div className="review-summary"><span className={`avatar avatar-${tone(a.id)}`}>{initials(a.requester_name)}</span><div><strong>{a.requester_name}</strong><span>{a.department} · {day(a.date)} at {a.time}</span><span>{a.purpose}</span></div></div>
    {resched && <><label className="modal-label" htmlFor="new-date">New date</label><input id="new-date" type="date" className="modal-input" value={date} onChange={(e) => { setDate(e.target.value); setTime('') }} /><SlotPicker department={a.department} date={date} value={time} onPick={setTime} /></>}
    <div className="modal-actions">{a.status === 'Pending' && !resched && <ConfirmButton label="Reject" confirmLabel="Confirm reject" disabled={busy} onConfirm={() => run(() => decide(a.id, 'reject'), 'Request rejected')} />}
      {resched ? <button className="primary-button" disabled={!time || busy} onClick={() => run(() => decide(a.id, 'reschedule', { date, time }), 'Request rescheduled')}>Confirm new time</button>
        : <><button className="secondary-button" onClick={() => setResched(true)}>Reschedule</button>{a.status === 'Pending' && <button className="primary-button" disabled={busy} onClick={() => run(() => decide(a.id, 'approve'), 'Request approved')}><Check /> Approve</button>}</>}</div></>
}

function VisitorForm({ profile, depts, appts, run, busy }: { profile: Profile; depts: string[]; appts: Appt[]; run: Run; busy: boolean }) {
  const [name, setName] = useState('')
  const [purpose, setPurpose] = useState('')
  const [department, setDepartment] = useState(profile.department ?? depts[0])
  const [apptId, setApptId] = useState('')
  const linkable = appts.filter((x) => x.department === department && x.requester_type === 'visitor' && (x.status === 'Approved' || x.status === 'Rescheduled'))
  return <>
    <label className="modal-label" htmlFor="v-name">Visitor name</label><input id="v-name" className="modal-input" value={name} onChange={(e) => setName(e.target.value)} />
    <label className="modal-label" htmlFor="v-purpose">Purpose</label><input id="v-purpose" className="modal-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
    <label className="modal-label" htmlFor="v-dept">Destination office</label><select id="v-dept" className="modal-input" value={department} disabled={profile.role === 'approver'} onChange={(e) => { setDepartment(e.target.value); setApptId('') }}>{depts.map((d) => <option key={d}>{d}</option>)}</select>
    <label className="modal-label" htmlFor="v-appt">Appointment reference (optional)</label><select id="v-appt" className="modal-input" value={apptId} onChange={(e) => setApptId(e.target.value)}><option value="">None</option>{linkable.map((x) => <option key={x.id} value={x.id}>{code(x.id)} · {x.requester_name}</option>)}</select>
    <div className="modal-actions"><button className="primary-button" disabled={!name.trim() || !purpose.trim() || busy} onClick={() => run(() => registerVisitor({ name, purpose, department, appointmentId: apptId ? Number(apptId) : null }), 'Visitor registered')}>Save record</button></div></>
}

function Availability({ profile, avail, depts, run }: { profile: Profile; avail: Avail[]; depts: string[]; run: Run }) {
  const [dept, setDept] = useState(profile.department ?? depts[0])
  const on = new Set(avail.filter((a) => a.department === dept).map((a) => `${a.weekday}-${a.time}`))
  return <div className="panel"><div className="panel-heading"><div><h2>{dept}</h2></div>
    {profile.role === 'admin' && <div className="filters"><label className="modal-label" htmlFor="a-dept">Office</label><select id="a-dept" className="modal-input" value={dept} onChange={(e) => setDept(e.target.value)}>{depts.map((d) => <option key={d}>{d}</option>)}</select></div>}</div>
    <div className="table-wrap"><table className="table"><thead><tr><th>Slot</th>{WEEKDAYS.map((w) => <th key={w.n}>{w.label}</th>)}</tr></thead>
      <tbody>{SLOTS.map((t) => <tr key={t}><td>{t}</td>{WEEKDAYS.map((w) => <td key={w.n}><input type="checkbox" aria-label={`${w.label} ${t}`} checked={on.has(`${w.n}-${t}`)} onChange={(e) => run(() => toggleSlot(dept, w.n, t, e.target.checked), 'Availability updated')} /></td>)}</tr>)}</tbody></table></div></div>
}

function UserRow({ u, self, depts, run, busy }: { u: Profile; self: boolean; depts: string[]; run: Run; busy: boolean }) {
  const [role, setRole] = useState<Role>(u.role)
  const [dept, setDept] = useState(u.department ?? depts[0])
  const changed = role !== u.role || (role === 'approver' && dept !== u.department)
  return <div className="request-row"><span className={`avatar avatar-${tone(u.full_name.length)}`}>{initials(u.full_name)}</span>
    <span className="request-person"><strong>{u.full_name || 'No name'}</strong><span>{u.email}</span></span>
    <span className="request-detail"><select aria-label={`Role for ${u.email}`} className="modal-input" value={role} disabled={self} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
      {role === 'approver' && <select aria-label={`Office for ${u.email}`} className="modal-input" value={dept} onChange={(e) => setDept(e.target.value)}>{depts.map((d) => <option key={d}>{d}</option>)}</select>}</span>
    <span className="row-actions">{u.role === 'visitor' && <button className="secondary-button" disabled={busy} onClick={() => run(() => setAuthorized(u.id, !u.authorized), u.authorized ? 'Access revoked' : 'Visitor authorized')}>{u.authorized ? 'Revoke' : 'Authorize'}</button>}<button className="secondary-button" disabled={!changed || busy} onClick={() => run(() => setUserRole(u.id, role, dept), 'User updated')}>Save</button></span></div>
}

function Offices({ departments, run, busy }: { departments: Dept[]; run: Run; busy: boolean }) {
  const [name, setName] = useState('')
  return <div className="panel"><div className="request-list">{departments.map((d) => <div className="request-row" key={d.name}><span className="request-person"><strong>{d.name}</strong><span>{d.active ? 'Takes appointments' : 'Not participating'}</span></span><span className="row-actions"><button className="secondary-button" disabled={busy} onClick={() => run(() => saveOffice(d.name, !d.active), d.active ? 'Office deactivated' : 'Office activated')}>{d.active ? 'Deactivate' : 'Activate'}</button></span></div>)}</div>
    <div className="modal-actions"><label className="modal-label" htmlFor="o-name">New office</label><input id="o-name" className="modal-input" value={name} onChange={(e) => setName(e.target.value)} /><button className="primary-button" disabled={!name.trim() || busy} onClick={() => run(async () => { const r = await saveOffice(name, true); if (!r.error) setName(''); return r }, 'Office added')}>Add office</button></div></div>
}

function ConfirmButton({ label, confirmLabel, disabled, onConfirm }: { label: string; confirmLabel: string; disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const t = window.setTimeout(() => setArmed(false), 4000)
    return () => window.clearTimeout(t)
  }, [armed])
  return <button className={`secondary-button ${armed ? 'danger' : ''}`} disabled={disabled} onClick={() => { if (armed) { setArmed(false); onConfirm() } else setArmed(true) }}>{armed ? confirmLabel : label}</button>
}
