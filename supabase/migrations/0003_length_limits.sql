alter table public.appointments
  add constraint appointment_purpose_length check (char_length(btrim(purpose)) between 1 and 500) not valid;
alter table public.visitors
  add constraint visitor_name_length check (char_length(btrim(name)) between 1 and 120) not valid;
alter table public.visitors
  add constraint visitor_purpose_length check (char_length(btrim(purpose)) between 1 and 500) not valid;
alter table public.profiles
  add constraint profile_name_length check (char_length(full_name) <= 160) not valid;
