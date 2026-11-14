alter table public.appointments
add column if not exists teacher_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'appointments_teacher_scope_check'
      and conrelid = 'public.appointments'::regclass
  ) then
    alter table public.appointments
    add constraint appointments_teacher_scope_check
    check (
      teacher_name is null
      or (
        department = 'College of IT'
        and char_length(btrim(teacher_name)) between 1 and 120
      )
    );
  end if;
end
$$;

insert into public.availability (department, weekday, time)
select d.name, w.day, t.slot
from public.departments d
cross join generate_series(1, 5) as w(day)
cross join (values ('4:00 PM'), ('5:00 PM')) as t(slot)
on conflict (department, weekday, time) do nothing;
