update public.departments set name = 'Registrar''s Office' where name = 'Records and Credentials';
update public.profiles set department = 'Registrar''s Office' where department = 'Records and Credentials';
update public.appointments set department = 'Registrar''s Office' where department = 'Records and Credentials';
update public.visitors set department = 'Registrar''s Office' where department = 'Records and Credentials';
update public.availability set department = 'Registrar''s Office' where department = 'Records and Credentials';

insert into public.departments (name) values ('Accounting Office') on conflict (name) do nothing;

insert into public.availability (department, weekday, time)
select 'Accounting Office', w, t from generate_series(1, 5) as w,
  unnest(array['9:00 AM','10:00 AM','11:00 AM','1:00 PM','2:00 PM','3:00 PM']) as t
on conflict do nothing;
