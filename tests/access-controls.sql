
do $test$
declare
  v_request public.account_requests;
  v_approved boolean;
  v_status text;
  v_authorized boolean;
begin
  v_request:=public.claim_account_review(
    '11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000001');
  if v_request.id is null or v_request.status<>'processing' then
    raise exception 'CLAIM_FAILED';
  end if;
  if (public.claim_account_review(
    '11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000001')).id is not null then
    raise exception 'DUPLICATE_CLAIM_ALLOWED';
  end if;
  v_approved:=public.complete_account_review(
    '11111111-1111-4111-8111-111111111111',
    '00000000-0000-4000-8000-000000000001',v_request.reviewed_at,
    '00000000-0000-4000-8000-000000000004');
  if not v_approved then raise exception 'APPROVAL_FAILED'; end if;
  select status into v_status from public.account_requests where id=v_request.id;
  select authorized into v_authorized from public.profiles where id='00000000-0000-4000-8000-000000000004';
  if v_status<>'approved' or not v_authorized then raise exception 'APPROVAL_NOT_ATOMIC'; end if;
  if public.claim_account_review(
    '11111111-1111-4111-8111-111111111111','00000000-0000-4000-8000-000000000001') is not null then
    raise exception 'APPROVED_REQUEST_RECLAIMED';
  end if;
  if has_function_privilege('anon','public.handle_new_user()','EXECUTE') then
    raise exception 'TRIGGER_EXPOSED_TO_ANON';
  end if;
  if has_function_privilege('authenticated','public.claim_account_review(uuid,uuid)','EXECUTE') then
    raise exception 'CLAIM_EXPOSED_TO_AUTHENTICATED';
  end if;
end $test$;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',false);
do $test$ begin
  if public.my_role() is not null or (select count(*) from public.appointments)<>0
    or (select count(*) from public.departments)<>0 then
    raise exception 'REVOKED_ACCOUNT_STILL_HAS_ACCESS';
  end if;
end $test$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',false);
do $test$ begin
  if public.my_role() <> 'student' or (select count(*) from public.appointments)<>1 then
    raise exception 'AUTHORIZED_REQUESTER_LOST_OWN_APPOINTMENTS';
  end if;
end $test$;
reset role;

set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',false);
do $test$ begin
  if public.my_role() <> 'admin' or (select count(*) from public.appointments)<>2 then
    raise exception 'AUTHORIZED_ADMIN_LOST_APPOINTMENT_ACCESS';
  end if;
end $test$;
reset role;
