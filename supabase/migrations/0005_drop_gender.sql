alter table public.profiles drop constraint if exists profiles_gender_check;
alter table public.profiles drop column if exists gender;

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, role, authorized)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email,
    case when new.raw_user_meta_data->>'type' in ('student','faculty','visitor') then new.raw_user_meta_data->>'type' else 'student' end,
    coalesce(new.raw_user_meta_data->>'type', '') <> 'visitor');
  return new;
end $$;
