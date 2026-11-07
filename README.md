# SPCC Appointment and Visitor Management

Web-Based Institutional Appointment and Visitor Management System with Semi-Automated
Scheduling, Department-Based Approval, and Email Notifications for Systems Plus Computer
College – Caloocan. Next.js (App Router), Supabase (accounts, Postgres, row level security)
and Resend (email).

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. Copy `.env.example` to `.env.local`, or add the same variables in Vercel:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `RESEND_API_KEY`, `EMAIL_FROM`.
3. Register an account in the app. Sign-up only creates requesters; grant staff access with:

```sql
update public.profiles set role = 'admin' where email = 'you@spcc.ph';
```

An existing database that predates `supabase/migrations/` needs each file in that folder run
once, in order (`0001_gender.sql` … `0005_drop_gender.sql`). They are written to be repeatable;
`0005` removes the gender column that `0001` added, because the field is not part of the study.

## Email notifications with Resend

IAVMS sends transactional messages when a request is submitted, approved, rejected, rescheduled or cancelled. It also alerts the assigned department approvers about new requests. If no approver is assigned to an office, administrators receive the review notification instead.

1. Open [Resend](https://resend.com/) and create an API key with permission to send emails.
2. For delivery to SPCC students, staff and visitors, add a domain you control under [Domains](https://resend.com/domains). Copy the DKIM, SPF and any other DNS records Resend requests to your domain's DNS settings. Wait for the domain's sending status to become verified.
3. Set these values in `.env.local` for local development, or in the hosting provider's server-side environment settings:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-IAVMS-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_IAVMS_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_IAVMS_SERVER_SECRET
RESEND_API_KEY=re_YOUR_RESEND_API_KEY
EMAIL_FROM="SPCC Appointments <notifications@YOUR_VERIFIED_DOMAIN>"
```

4. Restart the development server after changing `.env.local`. Redeploy after changing hosted environment variables.
5. Submit an appointment request using a permitted test account. Check the `Email delivery` tab for `sent`, `skipped` or `failed`. The `sent` status means Resend accepted the request, not necessarily that the recipient opened or received the email. For delivery events, check the Resend dashboard.

The `onboarding@resend.dev` sender is intended only for testing to the email address associated with the Resend account. Verify your own domain before expecting notifications to reach other users. If `RESEND_API_KEY` is absent, IAVMS still saves the appointment but records email delivery as `skipped`. A failed email does not undo the appointment decision.

The service role key and Resend API key belong only in server-side variables. Never commit them to GitHub or prefix them with `NEXT_PUBLIC_`.


## Users and roles

| Role | Created by | Can do |
| --- | --- | --- |
| Student, faculty member | Self sign-up | Submit requests, track status, view own history, cancel own open requests |
| External visitor | Self sign-up, then authorized by an admin | Same as above, once authorized |
| Department approver | An admin, with an office assigned | Review, approve, reject and reschedule requests for that office; configure its slots; keep its visitor log |
| Administrator | An admin | Every office, plus offices, users, reports and the email log |

Approvers are not self-service: an account signs up as student, faculty or visitor, then an
administrator assigns the approver role and office in **Users**.

## Appointment rules

- **Pending slots.** A pending request does not block a slot. Only `Approved` and `Rescheduled`
  bookings block one, enforced by the `one_booking_per_slot` index in the database. The booking
  screen shows a slot as *Request pending* when someone else is waiting on it, and lets the
  approver see that before deciding.
- **One open request per slot.** A requester cannot hold two open requests for the same office,
  date and time; the server rejects the second.
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
- **Deletion:** deleting an account removes the profile and its appointments through the cascade
  on `profiles.id`.

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
