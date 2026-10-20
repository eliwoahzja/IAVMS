# SPCC Appointment and Visitor Management

Next.js + Supabase (accounts, database, access rules) + Resend (email).

1. Supabase: create a project, run `supabase/schema.sql` in the SQL Editor.
2. Copy `.env.example` to `.env.local`, or add the same variables in Vercel.
3. Create an account in the app, then run the `update ... set role = 'admin'` line at the bottom of schema.sql.

## Booking rules
- A pending request does not block a slot. Only approved or rescheduled bookings do, and the database enforces that.
- Requesters can cancel pending, approved or rescheduled appointments.
- Approvers approve or reject pending requests, and can reschedule pending, approved or rescheduled ones in their own office.
- External visitor accounts must be authorized by an admin before they can book.
- Visitor records are logs. They do not authorize physical entry.

## Interface notes
- System font, rem-based type, sticky translucent top bar.
- On phones, dialogs are bottom sheets. Drag the handle to dismiss; the release velocity decides, and a grab mid-flight does not jump.
- Reduced-motion users get short cross-fades. Reduced-transparency and high-contrast preferences are handled.
