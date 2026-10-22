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
