
drop policy if exists "own or admin" on public.profiles;
create policy "own or admin" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.my_role()) = 'admin');

revoke execute on function public.my_role() from public, anon;
revoke execute on function public.my_dept() from public, anon;
grant execute on function public.my_role() to authenticated;
grant execute on function public.my_dept() to authenticated;
