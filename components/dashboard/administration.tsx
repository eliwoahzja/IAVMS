'use client'

import { useState } from 'react'
import { blockSlot, blockTeacherSlot, deleteAccount, saveOffice, setAuthorized, setUserRole, toggleSlot, toggleTeacherSlot, unblockSlot, unblockTeacherSlot } from '@/app/actions'
import { DatePicker } from '@/components/date-picker'
import { SkeletonRows } from '@/components/skeleton'
import { BusyButton, type Run } from '@/components/dashboard/shared'
import { IT_DEPARTMENT, IT_TEACHERS, ROLES, SLOTS, WEEKDAYS, day, initials, tone } from '@/lib/constants'
import type { Avail, Block, Dept, Profile, Role, TeacherAvail, TeacherBlock } from '@/lib/types'

export function Availability({ profile, avail, blocks, teacherAvail, teacherBlocks, depts, today, run, busy, refreshing }: { profile: Profile; avail: Avail[]; blocks: Block[]; teacherAvail: TeacherAvail[]; teacherBlocks: TeacherBlock[]; depts: string[]; today: string; run: Run; busy: boolean; refreshing: boolean }) {
  const [dept, setDept] = useState(profile.department ?? depts[0])
  const [teacher, setTeacher] = useState('')
  const selectedTeacher = dept === IT_DEPARTMENT ? teacher : ''
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [reason, setReason] = useState('')
  const on = new Set((selectedTeacher ? teacherAvail.filter((a) => a.teacher_name === selectedTeacher) : avail.filter((a) => a.department === dept)).map((a) => `${a.weekday}-${a.time}`))
  const blocked = selectedTeacher ? teacherBlocks.filter((b) => b.teacher_name === selectedTeacher) : blocks.filter((b) => b.department === dept)
  const add = () => run(async () => {
    const r = selectedTeacher
      ? await blockTeacherSlot(selectedTeacher, date, time || null, reason)
      : await blockSlot(dept, date, time || null, reason)
    if (!r.error) { setDate(''); setTime(''); setReason('') }
    return r
  }, 'Marked unavailable')
  return <div className="panel">
    <div className="panel-heading"><div><h2>{dept}</h2><p className="panel-sub">Weekly hours</p></div>
      {profile.role === 'admin' && <div className="filters"><label className="field-label" htmlFor="a-dept">Office</label><select id="a-dept" className="field-input" value={dept} onChange={(e) => { setDept(e.target.value); setTeacher(''); setDate(''); setTime('') }}>{depts.map((d) => <option key={d}>{d}</option>)}</select></div>}</div>
    {dept === IT_DEPARTMENT && <div className="block-section">
      <label className="field-label" htmlFor="teacher-schedule">Schedule to manage</label>
      <select id="teacher-schedule" className="field-input" value={selectedTeacher} onChange={(e) => { setTeacher(e.target.value); setDate(''); setTime('') }}>
        <option value="">College of IT (department-wide)</option>
        {IT_TEACHERS.map((name) => <option key={name} value={name}>{name}</option>)}
      </select>
      <p className="muted-note">{selectedTeacher
        ? 'Teacher availability is independent. Department-wide closures still apply. Changes affecting confirmed appointments are blocked.'
        : 'Department-wide hours and closures apply to every IT teacher.'}</p>
    </div>}
    <div className="table-wrap" aria-busy={refreshing}><table className="table"><thead><tr><th>Slot</th>{WEEKDAYS.map((w) => <th key={w.n}>{w.label}</th>)}</tr></thead>
      <tbody>{SLOTS.map((t) => <tr key={t}><td>{t}</td>{WEEKDAYS.map((w) => <td key={w.n}><input type="checkbox" aria-label={`${w.label} ${t}`} checked={on.has(`${w.n}-${t}`)} onChange={(e) => { const checked = e.currentTarget.checked; run(() => selectedTeacher ? toggleTeacherSlot(selectedTeacher, w.n, t, checked) : toggleSlot(dept, w.n, t, checked), 'Availability updated') }} /></td>)}</tr>)}</tbody></table></div>

    <div className="block-section">
      <h3>Close dates or times</h3>
      <p className="muted-note">Close one time or a whole day. Confirmed appointments must be rescheduled before their slots can be closed.</p>
      <div className="block-form">
        <DatePicker id="block-date" label="Date" value={date} min={today} onChange={setDate} />
        <div>
          <label className="field-label" htmlFor="block-time">Time</label>
          <select id="block-time" className="field-input" value={time} onChange={(e) => setTime(e.target.value)}>
            <option value="">Whole day</option>
            {SLOTS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="block-reason-field">
          <label className="field-label" htmlFor="block-reason">Reason</label>
          <input id="block-reason" className="field-input" maxLength={60} placeholder="Holiday, meeting, busy" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <BusyButton label="Set as unavailable" className="primary-button block-add" disabled={!date || !reason.trim() || busy} onClick={add}>Set as unavailable</BusyButton>
      </div>
      {blocked.length ? <ul className="block-list">{blocked.map((b) => <li className="block-row" key={b.id}>
        <span className="block-when"><strong>{day(b.date)}</strong><span>{b.time ?? 'Whole day'}</span></span>
        <span className="block-reason">{b.reason}</span>
        <BusyButton label="Remove" disabled={busy} onClick={() => run(() => selectedTeacher ? unblockTeacherSlot(b.id) : unblockSlot(b.id), 'Time available again')}>Remove</BusyButton>
      </li>)}</ul> : <p className="empty-copy">Every time is available.</p>}
    </div>
  </div>
}

export function UserRow({ u, self, depts, run, busy }: { u: Profile; self: boolean; depts: string[]; run: Run; busy: boolean }) {
  const [role, setRole] = useState<Role>(u.role)
  const [dept, setDept] = useState(u.department ?? depts[0])
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [typedEmail, setTypedEmail] = useState('')
  const changed = role !== u.role || (role === 'approver' && dept !== u.department)
  const closeDelete = () => { setConfirmDelete(false); setTypedEmail('') }
  return <div className="request-row"><span className={`avatar avatar-${tone(u.full_name.length)}`}>{u.full_name.trim() ? initials(u.full_name) : u.email.slice(0, 1).toUpperCase()}</span>
    <span className="request-person"><strong>{u.full_name || 'Name not provided'}</strong><span>{u.email}</span></span>
    <span className="request-detail user-detail"><select aria-label={`Role for ${u.email}`} className="field-input" value={role} disabled={self || busy} onChange={(e) => setRole(e.target.value as Role)}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
      {role === 'approver' && <select aria-label={`Office for ${u.email}`} className="field-input" value={dept} disabled={self || busy} onChange={(e) => setDept(e.target.value)}>{depts.map((d) => <option key={d}>{d}</option>)}</select>}</span>
    <span className="row-actions">{!self && u.role !== 'admin' && <BusyButton label={u.authorized ? 'Revoke' : 'Authorize'} disabled={busy} onClick={() => run(() => setAuthorized(u.id, !u.authorized), u.authorized ? 'Access revoked' : 'Account authorized')}>{u.authorized ? 'Revoke' : 'Authorize'}</BusyButton>}<BusyButton label="Save changes" disabled={!changed || busy} onClick={() => run(() => setUserRole(u.id, role, dept), 'Account permissions updated')}>Save changes</BusyButton>
      {!self && <button type="button" className={`secondary-button${confirmDelete ? '' : ' danger'}`} disabled={busy} aria-expanded={confirmDelete} onClick={() => confirmDelete ? closeDelete() : setConfirmDelete(true)}>{confirmDelete ? 'Keep account' : 'Delete account'}</button>}</span>
    {confirmDelete && <div className="account-delete-confirm" role="group" aria-label={`Confirm deletion of ${u.email}`}>
      <p>Delete this account, its appointments, and associated records permanently. Type <strong>{u.email}</strong> to confirm.</p>
      <div className="account-delete-controls"><input type="text" className="field-input" value={typedEmail} aria-label={`Type ${u.email} to confirm deletion`} placeholder="Enter account email" spellCheck={false} autoComplete="off" onChange={(e) => setTypedEmail(e.target.value)} />
        <BusyButton label={`Permanently delete ${u.email}`} className="secondary-button danger" disabled={busy || typedEmail.trim() !== u.email} onClick={() => run(() => deleteAccount(u.id), 'Account and associated records deleted')}>Delete permanently</BusyButton>
        <button type="button" className="secondary-button" onClick={closeDelete} disabled={busy}>Cancel</button>
      </div>
    </div>}
  </div>
}

export function Offices({ departments, run, busy, refreshing }: { departments: Dept[]; run: Run; busy: boolean; refreshing: boolean }) {
  const [name, setName] = useState('')
  const open = departments.filter((d) => d.active).length
  const add = () => run(async () => { const r = await saveOffice(name, true); if (!r.error) setName(''); return r }, 'Office added')
  return <div className="panel">
    <div className="panel-heading"><div><h2>{departments.length} {departments.length === 1 ? 'office' : 'offices'}</h2><p className="panel-sub">{open} taking appointments</p></div></div>
    {refreshing ? <SkeletonRows rows={Math.min(Math.max(departments.length, 2), 5)} label="Refreshing offices" /> : <ul className="office-list">{departments.map((d) => <li className={`office-row ${d.active ? '' : 'office-row-off'}`} key={d.name}>
      <span className="office-name"><strong>{d.name}</strong><span className={`office-state ${d.active ? 'office-state-on' : ''}`}><i />{d.active ? 'Taking appointments' : 'Not taking appointments'}</span></span>
      <BusyButton label={d.active ? 'Deactivate' : 'Activate'} className="secondary-button office-toggle" disabled={busy} onClick={() => run(() => saveOffice(d.name, !d.active), d.active ? 'Office deactivated' : 'Office activated')}>{d.active ? 'Deactivate' : 'Activate'}</BusyButton>
    </li>)}</ul>}
    <div className="office-add">
      <label className="field-label" htmlFor="o-name">Add an office</label>
      <div className="office-add-row">
        <input id="o-name" className="field-input" placeholder="Office name" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !busy) add() }} />
        <BusyButton label="Add office" className="primary-button" disabled={!name.trim() || busy} onClick={add}>Add office</BusyButton>
      </div>
      <p className="muted-note">New offices start with appointment slots at 9, 10 and 11 AM, and 1, 2, 3, 4 and 5 PM, Monday to Friday.</p>
    </div>
  </div>
}
