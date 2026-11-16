
create role anon;
create role authenticated;
create role service_role;
create schema auth;
grant usage on schema auth,public to authenticated,anon,service_role;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant execute on function auth.uid() to authenticated,anon,service_role;

create table public.profiles (
  id uuid primary key, full_name text not null, email text not null,
  role text not null, department text, authorized boolean not null default false
);
create table public.account_requests (
  id uuid primary key, email text not null, full_name text not null,
  requested_role text not null, school_id text, status text not null default 'pending',
  linked_user_id uuid, reviewed_by uuid,
  reviewed_at timestamptz, created_at timestamptz not null default now(),
  constraint account_requests_status_check check(status in ('pending','approved','rejected'))
);
create table public.appointments (id bigint primary key,requester_id uuid,department text);
create table public.visitors (id bigint primary key,department text);
create table public.blocked_slots (id bigint primary key,department text);
create table public.availability (department text,weekday integer,"time" text);
create table public.email_log (id bigint primary key);

create function public.handle_new_user() returns trigger language plpgsql security definer
as $$ begin return new; end $$;
create function public.my_role() returns text language sql stable security definer
as $$ select role from public.profiles where id=auth.uid() $$;
create function public.my_dept() returns text language sql stable security definer
as $$ select department from public.profiles where id=auth.uid() $$;

alter table public.profiles enable row level security;
alter table public.appointments enable row level security;
alter table public.visitors enable row level security;
alter table public.blocked_slots enable row level security;
alter table public.availability enable row level security;
alter table public.email_log enable row level security;
create table public.departments (name text primary key);
alter table public.departments enable row level security;

create policy "own or admin" on public.profiles for select
  using(id=auth.uid() or public.my_role()='admin');
create policy "own, office or admin" on public.appointments for select
  using(requester_id=auth.uid() or public.my_role()='admin'
    or (public.my_role()='approver' and department=public.my_dept()));
create policy "staff" on public.visitors for select
  using(public.my_role()='admin' or (public.my_role()='approver' and department=public.my_dept()));
create policy "staff read blocks" on public.blocked_slots for select
  using(public.my_role()='admin' or (public.my_role()='approver' and department=public.my_dept()));
create policy "admin" on public.email_log for select using(public.my_role()='admin');
create policy "signed in" on public.departments for select using(auth.uid() is not null);
create policy "signed in" on public.availability for select using(auth.uid() is not null);
grant select on public.profiles,public.appointments,public.visitors,public.blocked_slots,
  public.availability,public.departments,public.email_log to authenticated,anon;

insert into public.profiles(id,full_name,email,role,department,authorized) values
('00000000-0000-4000-8000-000000000001','Admin','admin@invalid.example','admin',null,true),
('00000000-0000-4000-8000-000000000002','Student','student@invalid.example','student',null,true),
('00000000-0000-4000-8000-000000000003','Revoked','revoked@invalid.example','approver','College of IT',false),
('00000000-0000-4000-8000-000000000004','New applicant','new@invalid.example','student',null,false);
insert into public.appointments(id,requester_id,department) values
(1,'00000000-0000-4000-8000-000000000002','College of IT'),
(2,'00000000-0000-4000-8000-000000000003','College of IT');
insert into public.account_requests(id,email,full_name,requested_role) values
('11111111-1111-4111-8111-111111111111','new@invalid.example','New applicant','student');
insert into public.departments(name) values ('College of IT');
insert into public.availability(department,weekday,"time") values ('College of IT',1,'9:00 AM');
