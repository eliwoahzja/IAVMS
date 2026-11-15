create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  requested_role text not null check (requested_role in ('student','faculty','visitor')),
  school_id text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  linked_user_id uuid references auth.users(id) on delete set null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint account_request_email_length check (char_length(email) between 5 and 254),
  constraint account_request_name_length check (char_length(btrim(full_name)) between 2 and 160),
  constraint account_request_school_id_length check (school_id is null or char_length(btrim(school_id)) between 2 and 60)
);
create unique index if not exists account_requests_email_unique on public.account_requests (lower(email));
create index if not exists account_requests_status_created on public.account_requests (status, created_at desc);
alter table public.account_requests enable row level security;
revoke all on public.account_requests from public, anon, authenticated;
grant select, insert, update on public.account_requests to service_role;
alter table public.profiles alter column authorized set default false;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, authorized)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email,'@',1)),
    new.email,
    case when new.raw_user_meta_data->>'type' in ('student','faculty','visitor') then new.raw_user_meta_data->>'type' else 'student' end,
    false
  );
  return new;
end $$;