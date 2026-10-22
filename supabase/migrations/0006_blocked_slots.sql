create table if not exists public.blocked_slots (
  id bigint generated always as identity primary key,
  department text not null,
  date date not null,
  time text,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint blocked_slot_reason_length check (char_length(btrim(reason)) between 1 and 60)
);

create unique index if not exists one_block_per_slot
  on public.blocked_slots (department, date, coalesce(time, 'All day'));
create index if not exists blocked_slots_by_date on public.blocked_slots (department, date);

alter table public.blocked_slots enable row level security;

drop policy if exists "staff read blocks" on public.blocked_slots;
create policy "staff read blocks" on public.blocked_slots for select
  using (public.my_role() = 'admin' or (public.my_role() = 'approver' and department = public.my_dept()));
