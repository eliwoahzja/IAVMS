'use client'

import { reviewAccessRequest, resendActivationEmail } from '@/app/actions'
import { BusyButton, ConfirmButton, type Run } from '@/components/dashboard/shared'
import type { AccountRequest } from '@/lib/types'

export function AccessRequests({ requests, run, busy }: { requests: AccountRequest[]; run: Run; busy: boolean }) {
  const pending = requests.filter(r => r.status === 'pending')
  const processing = requests.filter(r => r.status === 'processing')
  const approved = requests.filter(r => r.status === 'approved')
  return <section className="panel">
    <div className="panel-heading"><div><h2>Account access requests</h2><p className="panel-sub">{pending.length} awaiting administrator review. Verify identities against school records before approval.</p></div></div>
    <div className="request-list">
      {pending.length ? pending.map(r => <div className="request-row" key={r.id}>
        <span className="request-person"><strong>{r.full_name}</strong><span>{r.email}</span><span className="request-meta">{r.requested_role === 'student' ? 'Student' : r.requested_role === 'faculty' ? 'Faculty' : 'External visitor'}{r.school_id ? ' · ID: ' + r.school_id : ''}</span></span>
        <span className="request-detail"><strong>Pending verification</strong><span>Submitted {new Date(r.created_at).toLocaleDateString('en-PH')}</span></span>
        <span className="row-actions">
          <BusyButton label="Approve account request" className="primary-button" disabled={busy} onClick={() => run(() => reviewAccessRequest(r.id, 'approve'), 'Account approved and activation sent')}>Approve &amp; email</BusyButton>
          <ConfirmButton label="Reject" confirmLabel="Confirm reject" disabled={busy} onConfirm={() => run(() => reviewAccessRequest(r.id, 'reject'), 'Request rejected')} />
        </span>
      </div>) : <p className="empty-copy">No pending account requests.</p>}
    </div>
    {processing.length > 0 && <div className="request-list" role="status">
      {processing.map(r => <div className="request-row" key={r.id}>
        <span className="request-person"><strong>{r.full_name}</strong><span>{r.email}</span></span>
        <span className="request-detail"><strong>Review in progress</strong><span>Processing started {r.reviewed_at ? new Date(r.reviewed_at).toLocaleString('en-PH') : 'recently'}. A stalled review is retryable after 10 minutes.</span></span>
        <span className="row-actions">
          <BusyButton label="Retry account review" className="secondary-button" disabled={busy} onClick={() => run(() => reviewAccessRequest(r.id, 'approve'), 'Account approved and activation sent')}>Retry approval</BusyButton>
        </span>
      </div>)}
    </div>}
    <div className="panel-heading" style={{ marginTop: 24 }}><div><h2>Approved accounts</h2><p className="panel-sub">If an activation email never arrived, send a fresh password-setup link to the approved address. Provider acceptance does not guarantee inbox delivery.</p></div></div>
    <div className="request-list">
      {approved.length ? approved.map(r => <div className="request-row" key={r.id}>
        <span className="request-person"><strong>{r.full_name}</strong><span>{r.email}</span></span>
        <span className="request-detail"><strong>Approved</strong><span>Request submitted {new Date(r.created_at).toLocaleDateString('en-PH')}</span></span>
        <span className="row-actions">
          <BusyButton label="Resend account activation email" className="secondary-button" disabled={busy} onClick={() => run(() => resendActivationEmail(r.id), 'Password setup email accepted. Check Email delivery for details.')}>Resend activation email</BusyButton>
        </span>
      </div>) : <p className="empty-copy">No approved requests yet.</p>}
    </div>
  </section>
}
