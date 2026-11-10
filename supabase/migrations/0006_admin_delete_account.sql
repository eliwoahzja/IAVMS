create or replace function public.admin_delete_account(p_target_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_role text;
begin
  select email, role into v_email, v_role
  from public.profiles where id = p_target_id for update;
  if not found then return false; end if;
  if v_role = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'Cannot delete the last administrator.';
  end if;
  delete from public.email_log
  where appointment_id in (select id from public.appointments where requester_id = p_target_id)
    or lower(to_email) = lower(v_email);
  delete from public.visitors
  where appointment_id in (select id from public.appointments where requester_id = p_target_id)
    or created_by = p_target_id;
  delete from public.blocked_slots where created_by = p_target_id;
  delete from auth.users where id = p_target_id;
  if not found then raise exception 'The authentication account was not found.'; end if;
  return true;
end;
$$;
revoke all on function public.admin_delete_account(uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_account(uuid) to service_role;
