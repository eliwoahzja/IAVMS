'use client'

import { reviewAccessRequest } from '@/app/actions'
import { BusyButton, ConfirmButton, type Run } from '@/components/dashboard/shared'
import type { AccountRequest } from '@/lib/types'

export function AccessRequests({ requests, run, busy }: { requests: AccountRequest[]; run: Run; busy: boolean }) {
  const pending = requests.filter(r => r.status === 'pending')
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
  </section>
}
