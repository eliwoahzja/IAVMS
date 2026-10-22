
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'student' check (role in ('student','faculty','visitor','approver','admin')),
  department text,
  authorized boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.appointments (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  requester_type text not null,
  department text not null,
  date date not null,
  time text not null,
  purpose text not null,
  status text not null default 'Pending' check (status in ('Pending','Approved','Rescheduled','Rejected','Cancelled')),
  created_at timestamptz not null default now()
);

create unique index one_booking_per_slot on public.appointments (department, date, time) where status in ('Approved','Rescheduled');
create table public.visitors (
  id bigint generated always as identity primary key,
  name text not null, purpose text not null, department text not null,
  appointment_id bigint references public.appointments(id) on delete set null,
  arrived_at timestamptz, left_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table public.departments (name text primary key, active boolean not null default true);
create table public.blocked_slots (
  id bigint generated always as identity primary key,
  department text not null,
  date date not null,
  time text,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint blocked_slot_reason_length check (char_length(btrim(reason)) between 1 and 60)
);
create unique index one_block_per_slot on public.blocked_slots (department, date, coalesce(time, 'All day'));
create index blocked_slots_by_date on public.blocked_slots (department, date);
create table public.availability (
  department text not null, weekday smallint not null check (weekday between 0 and 6), time text not null,
  primary key (department, weekday, time)
);
create table public.email_log (
  id bigint generated always as identity primary key,
  appointment_id bigint references public.appointments(id) on delete set null,
  to_email text not null, event text not null, status text not null, detail text,
  created_at timestamptz not null default now()
);

alter table public.appointments add constraint appointment_purpose_length check (char_length(btrim(purpose)) between 1 and 500) not valid;
alter table public.visitors add constraint visitor_name_length check (char_length(btrim(name)) between 1 and 120) not valid;
alter table public.visitors add constraint visitor_purpose_length check (char_length(btrim(purpose)) between 1 and 500) not valid;
alter table public.profiles add constraint profile_name_length check (char_length(full_name) <= 160) not valid;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, authorized)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email,
    case when new.raw_user_meta_data->>'type' in ('student','faculty','visitor') then new.raw_user_meta_data->>'type' else 'student' end,
    coalesce(new.raw_user_meta_data->>'type', '') <> 'visitor');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.my_role() returns text language sql stable security definer set search_path = public as $$ select role from public.profiles where id = auth.uid() $$;
create function public.my_dept() returns text language sql stable security definer set search_path = public as $$ select department from public.profiles where id = auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.visitors enable row level security;
alter table public.availability enable row level security;
alter table public.email_log enable row level security;
alter table public.departments enable row level security;
alter table public.blocked_slots enable row level security;
create policy "signed in" on public.departments for select using (auth.uid() is not null);

create policy "own or admin" on public.profiles for select using (id = auth.uid() or public.my_role() = 'admin');
create policy "own, office or admin" on public.appointments for select using (requester_id = auth.uid() or public.my_role() = 'admin' or (public.my_role() = 'approver' and department = public.my_dept()));
create policy "staff" on public.visitors for select using (public.my_role() = 'admin' or (public.my_role() = 'approver' and department = public.my_dept()));
create policy "staff read blocks" on public.blocked_slots for select using (public.my_role() = 'admin' or (public.my_role() = 'approver' and department = public.my_dept()));
create policy "signed in" on public.availability for select using (auth.uid() is not null);
create policy "admin" on public.email_log for select using (public.my_role() = 'admin');

insert into public.departments (name) values ('Admission'), ('Registrar''s Office'), ('Accounting Office'), ('Guidance and Counseling'), ('Student Services and Affairs'), ('College of IT'), ('Principal''s Office');

insert into public.availability
select d.name, w, t from public.departments d, generate_series(1,5) as w,
  unnest(array['9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM']) as t;

create or replace function public.purge_expired_records(retention_months int default 24)
returns table (visitors_removed bigint, emails_removed bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - (retention_months || ' months')::interval;
  v bigint;
  e bigint;
begin
  delete from public.visitors where created_at < cutoff;
  get diagnostics v = row_count;
  delete from public.email_log where created_at < cutoff;
  get diagnostics e = row_count;
  return query select v, e;
end $$;

revoke all on function public.purge_expired_records(int) from public;
revoke all on function public.purge_expired_records(int) from anon;
revoke all on function public.purge_expired_records(int) from authenticated;
grant execute on function public.purge_expired_records(int) to service_role;

