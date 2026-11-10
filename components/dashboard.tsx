'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { Check, LogOut, Menu, Plus, Search, X } from 'lucide-react'
import { cancel, markVisit, signOut } from '@/app/actions'
import { SkeletonRows, SkeletonTableRows } from '@/components/skeleton'
import { STATUSES, TYPE_LABEL, bySchedule, code, initials, personLabel, tone } from '@/lib/constants'
import { TABS, INTRO, TAB_TITLE, type Group, type Tab } from '@/components/dashboard/config'
import { BusyButton, ConfirmButton, Metric, ApptRow, type Run } from '@/components/dashboard/shared'
import { ModalBox } from '@/components/dashboard/modal'
import { Wizard, Review } from '@/components/dashboard/appointments'
import { VisitorForm } from '@/components/dashboard/visitors'
import { Availability, Offices, UserRow } from '@/components/dashboard/administration'
import type { Appt, Avail, Block, Dept, MailRow, Profile, Status, Visitor } from '@/lib/types'

type Modal = null | 'book' | 'visitor' | { review: Appt }

function usePending(active: boolean, delay = 140) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    if (!active) { setShown(false); return }
    const t = window.setTimeout(() => setShown(true), delay)
    return () => window.clearTimeout(t)
  }, [active, delay])
  return shown
}

const stamp = (iso: string) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })

type Props = { profile: Profile; appts: Appt[]; visitors: Visitor[]; avail: Avail[]; blocks: Block[]; users: Profile[]; emails: MailRow[]; departments: Dept[]; today: string }

export function Dashboard({ profile, appts, visitors, avail, blocks, users, emails, departments, today }: Props) {
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
  const [acting, setActing] = useState(false)
  const refreshing = usePending(busy) && !acting
  const [isMobile, setIsMobile] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const sidebar = useRef<HTMLElement>(null)
  const name = personLabel(profile.full_name)
  const avatarText = profile.full_name.trim() ? initials(profile.full_name) : profile.email.slice(0, 1).toUpperCase()

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 780px)')
    const sync = () => { setIsMobile(mq.matches); if (!mq.matches) setMenuOpen(false) }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButton.current?.focus({ preventScroll: true })
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setMenuOpen(false); return }
      if (e.key !== 'Tab' || !sidebar.current) return
      const f = Array.from(sidebar.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'))
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      document.body.style.overflow = previous
      menuButton.current?.focus({ preventScroll: true })
    }
  }, [menuOpen])

  const run: Run = (fn, ok) => {
    setActing(true)
    start(async () => {
      try {
        const r = await fn()
        setToast(r.error ?? ok)
        setToastError(!!r.error)
        if (!r.error) setModal(null)
        window.setTimeout(() => setToast(''), 3500)
      } finally {
        setActing(false)
      }
    })
  }

  const ordered = useMemo(() => [...appts].sort(bySchedule), [appts])
  const count = (s: Status) => ordered.filter((a) => a.status === s).length
  const list = useMemo(() => ordered.filter((a) => (filter === 'All' || a.status === filter) && `${a.requester_name} ${a.department} ${code(a.id)}`.toLowerCase().includes(search.toLowerCase())), [ordered, filter, search])
  const pending = ordered.filter((a) => a.status === 'Pending' && (group === 'admin' || a.department === profile.department)).slice(0, 5)

  return <div className="app-shell">
    <a className="skip-link" href="#content">Skip to content</a>
    {busy && <div className="progress" role="progressbar" aria-label="Saving" />}
    {menuOpen && <div className="sidebar-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
    <aside ref={sidebar} id="app-sidebar" inert={isMobile && !menuOpen} className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="brand-lockup"><img className="brand-seal" src="/seal.png" alt="" width={38} height={38} /><div><p className="brand-name">SPCC</p><p className="brand-subtitle">Caloocan campus</p></div><button ref={closeButton} className="icon-button mobile-close" onClick={() => setMenuOpen(false)} aria-label="Close navigation"><X /></button></div>
      <nav className="main-nav" aria-label="Main navigation">
        {tabs.map(({ id, icon: Icon }) => <button key={id} type="button" className={`nav-item ${tab === id ? 'nav-item-active' : ''}`} aria-current={tab === id ? 'page' : undefined} onClick={() => { setTab(id); setMenuOpen(false) }}><Icon /><span>{id === 'Appointments' && group === 'requester' ? 'My appointments' : TAB_TITLE[id]}</span>{id === 'Appointments' && staff && count('Pending') > 0 && <b>{count('Pending')}</b>}</button>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="user-card">
          <div className="user-card-top"><span className={`avatar avatar-${tone(profile.full_name.length)}`}>{avatarText}</span><div><strong>{name || profile.email}</strong>{name ? <small>{profile.email}</small> : null}</div></div>
          <span className="user-card-role">{TYPE_LABEL[profile.role] ?? profile.role}</span>
        </div>
        <form action={signOut}><button className="signout"><LogOut aria-hidden="true" /><span>Sign out</span></button></form>
        <p className="privacy-text">Personal data is handled under the Data Privacy Act of 2012 (RA 10173).</p>
      </div>
    </aside>

    <main className="main-content" id="content" inert={isMobile && menuOpen}>
      <header className="topbar"><button ref={menuButton} className="icon-button mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="app-sidebar"><Menu /></button><div className="breadcrumb"><span>Workspace</span><span>/</span><strong>{tab === 'Appointments' && group === 'requester' ? 'My appointments' : TAB_TITLE[tab]}</strong></div>
        {tab === 'Appointments' && <div className="topbar-actions"><div className="search-wrap"><Search /><input aria-label="Search appointments" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search requests" /></div></div>}</header>
      <div className="content-wrap">
        <section className="page-intro"><div><h1>{tab === 'Appointments' && !staff ? 'My appointments' : TAB_TITLE[tab]}</h1><p className="intro-copy">{tab === 'Appointments' && !staff ? 'Follow your requests and check whether an office has approved them.' : INTRO[tab]}</p></div>
          {profile.role !== 'admin' && tab === 'Appointments' && <button className="primary-button" disabled={!profile.authorized} onClick={() => setModal('book')}><Plus /> New appointment</button>}
          {staff && tab === 'Visitors' && <button className="primary-button" onClick={() => setModal('visitor')}><Plus /> Register visitor</button>}</section>

        {!profile.authorized && tab === 'Appointments' && <p className="auth-note" role="status">Staff must authorize your account before you can book.</p>}
        {tab === 'Summary' && <>
          <section className="metric-grid">
            <Metric label="Pending review" value={count('Pending')} tone="coral" />
            <Metric label="Approved" value={count('Approved') + count('Rescheduled')} tone="sage" />
            <Metric label="All requests" value={ordered.length} tone="lavender" />
            <Metric label="Visitor records" value={visitors.length} tone="sand" />
          </section>
          <div className="panel panel-focus"><div className="panel-heading"><div><h2>Awaiting a decision</h2><p className="panel-sub">Requests that staff need to review</p></div><button type="button" className="secondary-button" onClick={() => { setTab('Appointments'); setFilter('Pending') }}>View all requests</button></div>
            <div className="request-list">{refreshing ? <SkeletonRows rows={Math.max(pending.length, 2)} label="Refreshing pending requests" /> : pending.length ? pending.map((a, i) => <ApptRow key={a.id} a={a} i={i} actions={<button type="button" className="secondary-button" onClick={() => setModal({ review: a })}>Review</button>} />) : <p className="empty-copy">No pending requests need a decision.</p>}</div></div>
          </>}

        {tab === 'Appointments' && <div className="panel"><div className="panel-heading"><div><h2>{list.length} {list.length === 1 ? 'request' : 'requests'}</h2></div>
          <div className="filters"><label className="field-label" htmlFor="f-status">Status</label><select id="f-status" className="field-input" value={filter} onChange={(e) => setFilter(e.target.value as Status | 'All')}><option>All</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div></div>
          <div className="request-list">{refreshing ? <SkeletonRows rows={Math.min(Math.max(list.length, 2), 5)} label="Refreshing requests" /> : list.length ? list.map((a, i) => <ApptRow key={a.id} a={a} i={i} actions={<>
            {staff && (group === 'admin' || a.department === profile.department) && ['Pending', 'Approved', 'Rescheduled'].includes(a.status) && <button className="secondary-button" onClick={() => setModal({ review: a })}>{a.status === 'Pending' ? 'Review' : 'Reschedule'}</button>}
            {(a.requester_id === profile.id || group === 'admin') && ['Pending', 'Approved', 'Rescheduled'].includes(a.status) && <ConfirmButton label="Cancel" confirmLabel="Confirm cancel" disabled={busy} onConfirm={() => run(() => cancel(a.id), 'Appointment cancelled')} />}</>} />) : <p className="empty-copy">No appointments match your search or selected status.</p>}</div></div>}

        {tab === 'Visitors' && <div className="panel"><div className="request-list">{refreshing ? <SkeletonRows rows={Math.min(Math.max(visitors.length, 2), 5)} label="Refreshing visitor records" /> : visitors.length ? visitors.map((v) => <div className="request-row" key={v.id}><span className={`avatar avatar-${tone(v.id)}`}>{initials(v.name)}</span><span className="request-person"><strong>{v.name}</strong><span>{v.purpose}{v.appointment_id ? ` · ${code(v.appointment_id)}` : ''}</span></span><span className="request-detail"><strong>{v.department}</strong><span>{v.arrived_at ? `Arrived ${stamp(v.arrived_at)}` : 'Not arrived'}{v.left_at ? ` · Left ${stamp(v.left_at)}` : ''}</span></span><span className="row-actions">{!v.arrived_at && <BusyButton label="Mark arrived" disabled={busy} onClick={() => run(() => markVisit(v.id, 'arrived_at'), 'Arrival recorded')}>Mark arrived</BusyButton>}{v.arrived_at && !v.left_at && <BusyButton label="Mark left" disabled={busy} onClick={() => run(() => markVisit(v.id, 'left_at'), 'Departure recorded')}>Mark left</BusyButton>}</span></div>) : <p className="empty-copy">No visitor records yet. Use Register visitor to record a visit.</p>}</div></div>}

        {tab === 'Availability' && <Availability profile={profile} avail={avail} blocks={blocks} depts={depts} today={today} run={run} busy={busy} refreshing={refreshing} />}

        {tab === 'Reports' && <div className="panel table-wrap" aria-busy={refreshing}><table className="table"><thead><tr><th>Office</th>{STATUSES.map((s) => <th key={s}>{s}</th>)}<th>Total</th></tr></thead>
          <tbody>{refreshing ? <SkeletonTableRows rows={Math.min(Math.max(depts.length, 2), 6)} cols={STATUSES.length + 2} /> : depts.map((d) => <tr key={d}><td>{d}</td>{STATUSES.map((s) => <td key={s}>{ordered.filter((a) => a.department === d && a.status === s).length}</td>)}<td>{ordered.filter((a) => a.department === d).length}</td></tr>)}</tbody></table></div>}

        {tab === 'Offices' && <Offices departments={departments} run={run} busy={busy} refreshing={refreshing} />}

        {tab === 'Email log' && <div className="panel"><div className="request-list">{refreshing ? <SkeletonRows rows={3} label="Refreshing the email log" /> : emails.length ? emails.map((m) => <div className="request-row" key={m.id}><span className="request-person"><strong>{m.appointment_id ? code(m.appointment_id) : 'No reference'}: {m.event}</strong><span>{m.to_email}</span></span><span className="request-detail"><strong>{m.status}</strong><span>{m.detail || stamp(m.created_at)}</span></span></div>) : <p className="empty-copy">No appointment emails have been logged yet.</p>}</div></div>}

        {tab === 'Users' && <div className="panel"><div className="request-list">{refreshing ? <SkeletonRows rows={Math.min(Math.max(users.length, 2), 6)} label="Refreshing the user list" /> : users.map((u) => <UserRow key={u.id} u={u} self={u.id === profile.id} depts={depts} run={run} busy={busy} />)}</div></div>}
      </div>
    </main>

    {typeof modal === 'object' && modal && <ModalBox title={`Review ${code(modal.review.id)}`} onClose={() => setModal(null)}><Review a={modal.review} today={today} run={run} busy={busy} /></ModalBox>}
    {modal === 'book' && <ModalBox title="New appointment" onClose={() => setModal(null)}><Wizard today={today} depts={depts} own={profile.role === 'approver' ? profile.department : null} run={run} busy={busy} /></ModalBox>}
    {modal === 'visitor' && <ModalBox title="Register a visitor" onClose={() => setModal(null)}><VisitorForm profile={profile} depts={depts} appts={ordered} run={run} busy={busy} /></ModalBox>}
    {toast && <div className={`toast ${toastError ? 'toast-error' : ''}`} role={toastError ? 'alert' : 'status'}>{toastError ? <X /> : <Check />} {toast}</div>}
  </div>
}

