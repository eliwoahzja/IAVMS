-- Run once in Supabase: SQL Editor > New query > paste > Run.
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
-- The database itself refuses two confirmed bookings for the same office, date and time.
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
create policy "signed in" on public.departments for select using (auth.uid() is not null);
-- Reads are limited by role. All writes go through server actions using the service key.
create policy "own or admin" on public.profiles for select using (id = auth.uid() or public.my_role() = 'admin');
create policy "own, office or admin" on public.appointments for select using (requester_id = auth.uid() or public.my_role() = 'admin' or (public.my_role() = 'approver' and department = public.my_dept()));
create policy "staff" on public.visitors for select using (public.my_role() = 'admin' or (public.my_role() = 'approver' and department = public.my_dept()));
create policy "signed in" on public.availability for select using (auth.uid() is not null);
create policy "admin" on public.email_log for select using (public.my_role() = 'admin');

-- Offices listed on spcc.edu.ph/contacts. Admins can add or deactivate offices in the app.
insert into public.departments (name) values ('Admission'), ('Records and Credentials'), ('Guidance and Counseling'), ('Student Services and Affairs'), ('College of IT'), ('Principal''s Office');
-- Default availability: Monday to Friday, every slot, every office.
insert into public.availability
select d.name, w, t from public.departments d, generate_series(1,5) as w,
  unnest(array['9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM']) as t;

-- After you create your own account in the app, make yourself admin:
-- update public.profiles set role = 'admin' where email = 'YOUR-EMAIL';
