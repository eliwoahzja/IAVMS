create unique index if not exists one_open_request_per_requester_slot
on public.appointments (requester_id, department, date, "time")
where status in ('Pending', 'Approved', 'Rescheduled');

create index if not exists appointment_pending_submission_order
on public.appointments (department, date, "time", created_at, id)
where status = 'Pending';
