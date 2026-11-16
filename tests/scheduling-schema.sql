create role anon;
create role authenticated;
create role service_role;

create table public.profiles (id uuid primary key, role text not null default 'student');
create table public.departments (name text primary key, active boolean not null default true);
create table public.availability (
  department text not null, weekday smallint not null, "time" text not null,
  primary key (department, weekday, "time")
);
create table public.appointments (
  id bigint generated always as identity primary key,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  requester_type text not null,
  department text not null,
  teacher_name text,
  date date not null,
  "time" text not null,
  purpose text not null,
  status text not null default 'Pending'
    check (status in ('Pending','Approved','Rescheduled','Rejected','Cancelled')),
  created_at timestamptz not null default now()
);
create unique index one_booking_per_slot on public.appointments (department,date,"time")
  where status in ('Approved','Rescheduled');
create unique index one_open_request_per_requester_slot
  on public.appointments (requester_id,department,date,"time")
  where status in ('Pending','Approved','Rescheduled');
create table public.blocked_slots (
  id bigint generated always as identity primary key,
  department text not null,
  date date not null,
  "time" text,
  reason text not null,
  created_by uuid references public.profiles(id) on delete set null
);

insert into public.profiles (id)
select ('00000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid
from generate_series(1,8) g;

insert into public.departments (name,active) values ('College of IT',true),('Registrar''s Office',true);
insert into public.availability (department,weekday,"time")
select d.name,w,t."time"
from public.departments d
cross join generate_series(1,5) w
cross join (values ('9:00 AM'),('10:00 AM'),('11:00 AM'),('1:00 PM'),('2:00 PM'),('3:00 PM'),('4:00 PM'),('5:00 PM')) t("time");
