-- For databases created before gender existed. Safe to run more than once.
alter table public.profiles add column if not exists gender text;
alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles add constraint profiles_gender_check check (gender in ('male','female'));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, gender, role, authorized)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email,
    case when new.raw_user_meta_data->>'gender' in ('male','female') then new.raw_user_meta_data->>'gender' end,
    case when new.raw_user_meta_data->>'type' in ('student','faculty','visitor') then new.raw_user_meta_data->>'type' else 'student' end,
    coalesce(new.raw_user_meta_data->>'type', '') <> 'visitor');
  return new;
end $$;
