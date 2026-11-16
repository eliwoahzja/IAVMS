
create or replace function public.my_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.authorized = true
$$;
create or replace function public.my_dept()
returns text
language sql stable security definer set search_path = ''
as $$
  select p.department from public.profiles p where p.id = (select auth.uid()) and p.authorized = true
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop policy if exists "own, office or admin" on public.appointments;
create policy "own, office or admin" on public.appointments for select to authenticated
using (
  (select public.my_role()) is not null
  and (
    requester_id = (select auth.uid())
    or (select public.my_role()) = 'admin'
    or ((select public.my_role()) = 'approver' and department = (select public.my_dept()))
  )
);

drop policy if exists "staff" on public.visitors;
create policy "staff" on public.visitors for select to authenticated
using ((select public.my_role()) = 'admin' or ((select public.my_role()) = 'approver' and department = (select public.my_dept())));

drop policy if exists "staff read blocks" on public.blocked_slots;
create policy "staff read blocks" on public.blocked_slots for select to authenticated
using ((select public.my_role()) = 'admin' or ((select public.my_role()) = 'approver' and department = (select public.my_dept())));

drop policy if exists "admin" on public.email_log;
create policy "admin" on public.email_log for select to authenticated
using ((select public.my_role()) = 'admin');

drop policy if exists "signed in" on public.departments;
create policy "signed in" on public.departments for select to authenticated
using ((select public.my_role()) is not null);

drop policy if exists "signed in" on public.availability;
create policy "signed in" on public.availability for select to authenticated
using ((select public.my_role()) is not null);

alter table public.account_requests drop constraint if exists account_requests_status_check;
alter table public.account_requests add constraint account_requests_status_check
check (status in ('pending','processing','approved','rejected'));

create or replace function public.claim_account_review(p_request_id uuid,p_reviewer uuid)
returns public.account_requests
language plpgsql security definer set search_path = ''
as $$
declare v_request public.account_requests;
begin
  if not exists (select 1 from public.profiles where id=p_reviewer and role='admin' and authorized) then
    raise exception 'Unauthorized reviewer';
  end if;
  update public.account_requests
  set status='processing', reviewed_by=p_reviewer, reviewed_at=clock_timestamp()
  where id=p_request_id
    and (status='pending' or (status='processing' and reviewed_at < now() - interval '10 minutes'))
  returning * into v_request;
  return v_request;
end $$;

create or replace function public.release_account_review(
  p_request_id uuid, p_reviewer uuid, p_claimed_at timestamptz
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_rows integer;
begin
  if not exists (select 1 from public.profiles where id=p_reviewer and role='admin' and authorized) then
    raise exception 'Unauthorized reviewer';
  end if;
  update public.account_requests
  set status='pending', reviewed_by=null, reviewed_at=null
  where id=p_request_id and status='processing'
    and reviewed_by=p_reviewer and reviewed_at=p_claimed_at;
  get diagnostics v_rows = row_count;
  return v_rows = 1;
end $$;

create or replace function public.complete_account_review(
  p_request_id uuid, p_reviewer uuid, p_claimed_at timestamptz, p_user uuid
)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_request public.account_requests;
declare v_rows integer;
begin
  if not exists (select 1 from public.profiles where id=p_reviewer and role='admin' and authorized) then
    raise exception 'Unauthorized reviewer';
  end if;
  select * into v_request from public.account_requests
  where id=p_request_id and status='processing'
    and reviewed_by=p_reviewer and reviewed_at=p_claimed_at
  for update;
  if not found then return false; end if;
  update public.profiles
  set full_name=v_request.full_name, role=v_request.requested_role, authorized=true
  where id=p_user and lower(email)=lower(v_request.email) and authorized=false;
  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'Account identity or authorization does not match the pending request';
  end if;
  update public.account_requests
  set status='approved', linked_user_id=p_user, reviewed_at=clock_timestamp()
  where id=p_request_id and status='processing';
  return true;
end $$;

revoke all on function public.claim_account_review(uuid,uuid) from public, anon, authenticated;
revoke all on function public.release_account_review(uuid,uuid,timestamptz) from public, anon, authenticated;
revoke all on function public.complete_account_review(uuid,uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.claim_account_review(uuid,uuid) to service_role;
grant execute on function public.release_account_review(uuid,uuid,timestamptz) to service_role;
grant execute on function public.complete_account_review(uuid,uuid,timestamptz,uuid) to service_role;
