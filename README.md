# SPCC Appointment and Visitor Management

Web-Based Institutional Appointment and Visitor Management System with Semi-Automated
Scheduling, Department-Based Approval, and Email Notifications for Systems Plus Computer
College – Caloocan. Next.js (App Router), Supabase (accounts, Postgres, row level security)
and a configurable SMTP or Resend email transport.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. Copy `.env.example` to `.env.local`, or add the same variables in Vercel:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `EMAIL_PROVIDER`, SMTP settings or `RESEND_API_KEY`, and `EMAIL_FROM`.
3. Students, faculty and visitors submit an access request instead of creating credentials immediately. Administrators review identity and approve the request in the **Access requests** tab. Grant existing accounts staff access with:

```sql
update public.profiles set role = 'admin' where email = 'you@spcc.ph';
```

For a fresh installation, run `supabase/schema.sql` and then the migrations in
`supabase/migrations/` from `0008` through `0013`, in ascending order. For an existing
IAVMS database, run only unapplied migrations and do not rerun the base schema.
The `0011_teacher_scheduling_and_atomic_guards.sql` migration separates College of IT
teacher capacity and installs the database transaction guards. The migration is already
applied to the connected IAVMS Supabase project.

## Email notifications with SMTP or Resend

Appointment email templates remain in `lib/email/messages.ts`. Transport and delivery logging are in `lib/email/delivery.ts`. Existing appointment actions and the `email_log` table work with either provider.

Choose your delivery method in `.env.local` on the computer running IAVMS. The app runs locally; Vercel is optional for preview only. Restart the Next.js server after changing environment variables.

### Custom SMTP (Maileroo, Gmail, school mail, or another provider)

Install dependencies with `npm install` after pulling the latest source. The SMTP client uses Nodemailer over authenticated TLS.

```dotenv
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-smtp-username
SMTP_PASS=your-smtp-password
EMAIL_FROM="SPCC Appointments <your-authorized-sender@example.com>"
```

- Set `SMTP_HOST` to your provider's hostname, not the address of the local website.
- Port `587` uses STARTTLS and is required to upgrade to an encrypted connection. Port `465` uses TLS immediately: set `SMTP_PORT=465` and `SMTP_SECURE=true`.
- The sender must be an address the provider authorizes. Enter provider-issued credentials in `.env.local`; do not put them in GitHub.
- Maileroo's SMTP relay uses `smtp.maileroo.com` with port `587` (STARTTLS) or `465` (TLS), and a full sending-email address as its username. Maileroo requires a verified sending domain for normal outbound delivery. Its sandbox/test inbox is not regular delivery to students.
- If you have no custom domain, use an email provider that permits SMTP submission from an account you own, such as a supported Gmail account with an application password where enabled, or an institution-approved SMTP account. Use its verified From address, not `onboarding@resend.dev`.

### Resend API (optional)

```dotenv
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_YOUR_PRIVATE_KEY
EMAIL_FROM="SPCC Appointments <onboarding@resend.dev>"
```

Resend's onboarding sender supports limited testing, not production delivery to arbitrary student addresses. Normal sending also requires a verified domain.

### Behavior and checks

- With `EMAIL_PROVIDER=smtp`, IAVMS sends through the configured SMTP relay.
- With `EMAIL_PROVIDER=resend`, IAVMS uses the existing Resend API.
- With `EMAIL_PROVIDER=disabled`, the email is recorded as skipped.
- Without `EMAIL_PROVIDER`, SMTP is selected when `SMTP_HOST` is present; otherwise the Resend integration is used.
- If credentials are missing, email is logged as `skipped`. If the provider rejects delivery, the attempt is logged as `failed`.
- `sent` means the SMTP server or Resend accepted the message, not guaranteed inbox delivery. Review the provider's activity logs to confirm delivery.
- A notification failure does not reverse or silently change an appointment decision.

Never expose `SMTP_PASS`, `SUPABASE_SERVICE_ROLE_KEY` or `RESEND_API_KEY` to the browser. Do not prefix these secrets with `NEXT_PUBLIC_`.

## Users and roles

| Role | Created by | Can do |
| --- | --- | --- |
| Student, faculty member | Account request, administrator verification, emailed activation link | Submit appointments, track status, view own history, cancel own open requests |
| External visitor | Account request, administrator approval, emailed activation link | Same as above, once authorized |
| Department approver | An admin, with an office assigned | Review, approve, reject and reschedule requests for that office; configure its slots; keep its visitor log |
| Administrator | An admin | Every office, plus offices, users, reports and the email log |

Approvers are not self-service: a school administrator first approves a requester account,
then assigns the approver role and office in **Users**.

## Administrator-approved account requests

The existing email and password login remains available. First-time users choose **Activate account**,
enter their name, email twice, role and school ID (students and faculty), and wait for administrator approval.
Requests are stored in `account_requests` with RLS enabled and no public table grants. Administrators
must verify the applicant's identity against official school records before approving. An email address
or self-entered ID is not enrollment proof.

Approval creates a Supabase Auth invitation or approves an existing unauthorized account. The activation
email uses the existing `EMAIL_PROVIDER` transport (SMTP Maileroo or Resend). The user sets their own
password through a time-limited link and then signs in. **Never send plaintext passwords by email.**
If email transport fails, the request stays pending for retry; a created invited account remains unauthorized.
Approval uses the service-role key only in server actions, never in the browser.
Every activation email attempt now appears in the administrator **Email delivery** tab, with status
`sent`, `skipped`, or `failed`. `sent` only indicates provider acceptance, not guaranteed
arrival in the recipient's inbox. Approved users remain visible in **Access requests** so
administrators can resend a time-limited password-setup email when an earlier link is lost.
Resends require an approved and authorized matching user account and are limited to once
per minute for provider-accepted messages. The administrator should verify provider delivery
logs, spam folders, and domain authentication settings when messages show `sent` but do
not appear in the inbox.

Set `APP_URL` in `.env.local` to the trusted, reachable origin of the app. For example, on the same
development device use `APP_URL=http://localhost:3000`. Recipients on a different device cannot
open localhost on your device. For email activation outside your computer, use a reachable
HTTPS domain such as a deployment you control, configured as `APP_URL`, and allow that
site URL in Supabase Authentication settings. The activation handler is `/auth/confirm`.
This app uses email/password authentication and administrator-approved activation.
It does not use Google OAuth. SPCC Student Portal credentials are separate from IAVMS credentials
unless an authorized institutional integration is configured.

For a publicly deployed version, add CAPTCHA and edge rate limiting to the unauthenticated
access-request form before accepting untrusted high-volume traffic.

## Appointment rules

- **Pending slots.** A pending request does not block a slot. Only `Approved` and `Rescheduled`
  bookings block one, enforced by the `one_booking_per_slot` index in the database. The booking
  screen shows a slot as *Request pending* when someone else is waiting on it, and lets the
  approver see that before deciding.
- **One open request per slot.** A requester cannot hold two open requests for the same office,
  date and time. Both the server validation and the `one_open_request_per_requester_slot`
  database index reject duplicates, including two submissions from separate browser tabs.
- **Submission order.** Pending requests are displayed to administrators and department
  approvers in server-recorded submission order (`created_at`, then appointment ID).
  Submission times include milliseconds. A timestamp documents when the database recorded
  the request; it does not measure internet connection speed or grant automatic priority.
- **Approval concurrency.** Approval, rejection, rescheduling and cancellation update
  records only if their status has not changed since staff read them. If another action wins
  the race, the system requests a refresh and does not send duplicate notifications.
  The confirmed-slot unique index remains the final safeguard against double-booking.
- **Human approval.** Nothing is approved automatically. Approvers decide, and the database
  rejects a second approval into the same slot.
- **Cancellations.** A requester can cancel their own pending, approved or rescheduled request;
  an administrator can cancel any. Cancelling closes the request and frees the slot.
- **Rescheduling.** An approver can move a request in their own office to another open slot,
  whether it is pending, approved or rescheduled. The new slot must be open and must not already
  hold a confirmed booking; the change is emailed to the requester.
- **Blocked times.** An approver can close a whole day for a holiday, or a single slot for a
  meeting, on a specific date, with a short reason. Blocked times appear closed in booking and
  rescheduling and cannot be requested. Blocking does not cancel appointments that are already
  approved — reschedule or cancel those first.
- **Rejection.** Available on pending requests only.
- **Dates.** Requests cannot be made for a past date or a weekend. Approving a request whose date
  has passed is refused.

## Visitor records

Visitor records are a log. They record a name, purpose, destination office, optional appointment
reference and arrival and departure times. They never authorize physical entry — campus security
decides who enters the building. Only approvers of the destination office and administrators can
see or stamp them.

## Security model

- Every mutation is a server action that re-reads the session with `auth.getUser()`, loads the
  caller's profile and checks the role and office before touching data. Hiding a button is never
  the only check.
- Row level security grants `select` per role and owner, and grants **no** write policies, so the
  public anon key cannot insert or change any row. Writes happen only inside server actions with
  the service role key, which never reaches the browser.
- `proxy.ts` refreshes the Supabase session cookie on navigation.
- Emails identify the appointment by code, office, date and time only.

## Data privacy (RA 10173)

- **Collected:** name, email, role, office for staff, appointment purpose with office, date and
  time, and visitor arrival and departure times. Nothing else is asked for at sign-up.
- **Purpose:** scheduling appointments, deciding on them, and logging campus visits.
- **Consent:** the sign-up form requires an explicit consent tick, and the server rejects
  registrations without it.
- **Access:** record visibility follows the role table above, enforced in row level security and
  re-checked in every server action.
- **Retention:** visitor records and the email log are kept for 24 months, then removed by
  `select * from public.purge_expired_records();`. The function is executable by the service role
  only. Appointment history is retained as an institutional record.
- **Deletion:** administrators can delete another account in the Users tab by confirming its email. The server verifies the administrator role and calls `admin_delete_account` through the service role. The database removes the account, its appointments, linked visitor and email records, and records created by the user in one transaction. Administrators cannot delete themselves, and the last administrator is protected.

## Accessibility

Targets WCAG 2.2 AA. Keyboard access to every control, visible focus rings, a skip link to the
main content, labelled inputs, `fieldset`/`legend` grouping, `role="alert"` for errors and
`role="status"` for confirmations, 44 px touch targets, `inert` for off-screen drawers and
dialogs, and honoured `prefers-reduced-motion`, `prefers-reduced-transparency` and
`prefers-contrast` settings.

## Evaluation against ISO/IEC 25010:2023

| Characteristic | How it is addressed | How to check it |
| --- | --- | --- |
| Functional suitability | Request, approval, scheduling, notification and visitor functions map to the objectives; role rules in `app/actions.ts` and RLS | Walk each role through its task list |
| Performance efficiency | Filtering and sorting done in one pass per page; no polling; server components fetch once | Load the Summary and Appointments tabs on the school network |
| Interaction capability | Predictable navigation, one primary action per screen, keyboard and screen reader support | Task completion with representative users |
| Reliability | Server-side validation, database constraints, idempotent visit stamping, email failures recorded in the log instead of lost | Submit duplicate and conflicting requests |
| Security | Session validation on every action, service role isolated to the server, RLS on every table | Attempt a direct REST write with the anon key |
| Maintainability | Typed server actions, shared constants, migrations per change | Review `supabase/migrations` |

## Interface notes

System font, rem-based type, sticky top bar. On phones, dialogs are bottom sheets: drag the
handle to dismiss, and the release velocity decides. Reduced motion, reduced transparency and
higher contrast preferences are handled.

## Troubleshooting outbound email

Open **Email delivery** in the administrator dashboard and choose **Send test to my email**
to submit a diagnostic message to the signed-in administrator's own email address. This action
requires an authorized administrator, limits accepted diagnostic messages to one per minute,
and records the attempt in `email_log` without exposing SMTP credentials.

If an account has been approved but the user did not receive their setup link, open
**Access requests**, locate the approved account, and choose **Resend activation email**.
The action sends a fresh time-limited password-setup link to the already approved and linked
email address. The existing account and bookings remain unchanged.

For Maileroo, check **Domains → your sending domain → Overview → Sending → Logs** and inspect
the message's delivery events. Confirm whether it was delivered, bounced, delayed, or suppressed.
The app's `sent` status means SMTP accepted the message, not that it reached an inbox.
If no entry appears in `email_log`, check whether the action ran and whether the local
development server loaded `.env.local`. Confirm `EMAIL_PROVIDER=smtp`, the Maileroo
SMTP configuration, and the verified `EMAIL_FROM` address. Restart Next.js after changing
environment variables. A `localhost` link is only usable on the host device. For recipients
on different devices, configure `APP_URL` with a reachable HTTPS deployment.

## Teacher scheduling and concurrency safeguards

College of IT appointments now reserve capacity per selected teacher. Two different
teachers may have confirmed appointments at the same time, while each teacher is limited
to one confirmed student per time slot. Older confirmed College of IT appointments without
a teacher assignment continue to reserve their whole department slot. Other offices retain
one confirmed appointment per department and time slot.

**Office hours → College of IT → Schedule to manage** lets authorized administrators and
the assigned department approver adjust department-wide availability or each teacher's
weekly schedule and date-specific closures. Teacher availability initially mirrors the
department's existing weekly hours, and must be maintained by responsible staff. Selecting
a teacher does not integrate automatically with that teacher's external calendar.

The `iavms_schedule_guard` PostgreSQL trigger serializes appointment and schedule changes
using a transaction-scoped advisory lock per department. It rejects bookings in closed,
past, teacher-unavailable or already-confirmed slots, and refuses to close, disable or
deactivate resources with future confirmed appointments. Approval remains an explicit
department decision; pending requests do not reserve capacity.

Automated checks run in GitHub Actions via `.github/workflows/iavms-checks.yml`:
TypeScript type checking and separate PostgreSQL integration tests in
`tests/scheduling-concurrency.mjs`. The tests create a disposable PostgreSQL database
and exercise simultaneous approvals, independent teacher bookings, legacy bookings,
blocking, weekly-hour changes, office deactivation and cancellation.
They use no production records or credentials.

The previous Chapter 3 documentation and diagrams have not been changed.

## Authorization and account activation safeguards

The `0012_authorization_and_activation_consistency.sql` migration is already applied to
the connected IAVMS Supabase project. It requires `profiles.authorized=true` for
direct appointment, visitor, office-hours and email-log access, even if a previously
authorized account retains an unexpired authentication token. Revoked approvers
are also excluded from appointment email notifications.

New account approvals use a database-backed claim to prevent concurrent
administrator approvals. The claim expires after ten minutes if a server
crash leaves an account request in `processing`; an administrator may retry
that review from **Access requests**. Completing an approval atomically updates
the account's authorization and the request's reviewed status. Only after this
commit does the application send the activation email.

If email delivery is skipped or rejected, the account stays **approved**,
and an administrator can use **Resend activation email**. This avoids
automatically resending an email to an account whose authorization may already
have succeeded. Existing rejected applicants may resubmit corrected details
after a short cooldown; submissions for existing pending/approved requests
do not create duplicate records.

The CI workflow includes an isolated PostgreSQL authorization job. Its test
fixtures check that revoked accounts lose direct data access, authorized
requesters can still view their own records, concurrent claim attempts do not
both succeed, and the final approval operation updates both records together.

These changes do not include any Chapter 3 or capstone diagram edits.

The `0013_limit_role_helpers_to_signed_in_users.sql` migration removes anonymous
execution access to the database role helper functions and keeps authorized
users' normal row-level access intact. It is applied to the connected project.
