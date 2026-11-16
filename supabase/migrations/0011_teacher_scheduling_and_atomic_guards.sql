
create table if not exists public.teacher_availability (
  department text not null default 'College of IT' check (department = 'College of IT'),
  teacher_name text not null check (length(btrim(teacher_name)) between 2 and 120),
  weekday smallint not null check (weekday between 1 and 5),
  "time" text not null,
  primary key (department, teacher_name, weekday, "time")
);
create table if not exists public.teacher_blocked_slots (
  id bigint generated always as identity primary key,
  department text not null default 'College of IT' check (department = 'College of IT'),
  teacher_name text not null check (length(btrim(teacher_name)) between 2 and 120),
  date date not null,
  "time" text,
  reason text not null check (length(btrim(reason)) between 1 and 60),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists one_teacher_block_per_slot
 on public.teacher_blocked_slots (department,teacher_name,date,coalesce("time",'All day'));
create index if not exists teacher_blocks_by_date
 on public.teacher_blocked_slots (department,teacher_name,date);

insert into public.teacher_availability (department,teacher_name,weekday,"time")
select a.department, t.teacher_name, a.weekday, a."time"
from public.availability a
cross join (values
 ('Ms. Juvy Ilustrisimo'),('Mr. Febrick Quiza'),
 ('Mr. Dominick Intacto'),('Mr. Ralph Baga'),('Ms. Angelica Perioles')
) t(teacher_name)
where a.department='College of IT'
on conflict do nothing;

alter table public.teacher_availability enable row level security;
alter table public.teacher_blocked_slots enable row level security;
revoke all on public.teacher_availability, public.teacher_blocked_slots from public, anon, authenticated;
grant select,insert,update,delete on public.teacher_availability, public.teacher_blocked_slots to service_role;
grant usage,select on all sequences in schema public to service_role;

drop index if exists public.one_booking_per_slot;
create unique index one_booking_per_slot
 on public.appointments (department,date,"time")
 where status in ('Approved','Rescheduled')
 and (department <> 'College of IT' or teacher_name is null);
create unique index if not exists one_teacher_booking_per_slot
 on public.appointments (department,teacher_name,date,"time")
 where status in ('Approved','Rescheduled')
 and department='College of IT' and teacher_name is not null;

create or replace function public.iavms_schedule_guard()
returns trigger language plpgsql set search_path = '' as $body$
declare
  dept text;
  current_ph timestamp := timezone('Asia/Manila', clock_timestamp());
  mins integer;
  is_active boolean;
begin
  if TG_TABLE_NAME = 'departments' then
    dept := NEW.name;
  elsif TG_OP = 'DELETE' then
    dept := OLD.department;
  else
    dept := NEW.department;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('iavms-office:' || dept, 0));

  if TG_TABLE_NAME = 'appointments' then
    if TG_OP = 'DELETE' then return OLD; end if;
    if TG_OP = 'UPDATE' and NEW.department is distinct from OLD.department then
      raise exception using errcode='P0001',message='OFFICE_IMMUTABLE';
    end if;
    if NEW.status not in ('Pending','Approved','Rescheduled') then return NEW; end if;
    if TG_OP = 'UPDATE' then
      if NEW.status = OLD.status and NEW.date = OLD.date
        and NEW."time" = OLD."time"
        and NEW.teacher_name is not distinct from OLD.teacher_name then
        return NEW;
      end if;
    end if;

    mins := case NEW."time"
      when '9:00 AM' then 540 when '10:00 AM' then 600 when '11:00 AM' then 660
      when '1:00 PM' then 780 when '2:00 PM' then 840 when '3:00 PM' then 900
      when '4:00 PM' then 960 when '5:00 PM' then 1020 else null end;
    if mins is null then
      raise exception using errcode='P0001',message='INVALID_SLOT';
    end if;
    if NEW.date < current_ph::date or (NEW.date = current_ph::date and
      mins <= (extract(hour from current_ph)::integer * 60 + extract(minute from current_ph)::integer)) then
      raise exception using errcode='P0001',message='SLOT_PASSED';
    end if;
    select d.active into is_active from public.departments d where d.name=NEW.department;
    if not coalesce(is_active,false) then
      raise exception using errcode='P0001',message='OFFICE_CLOSED';
    end if;
    if not exists (
      select 1 from public.availability av
      where av.department=NEW.department and av.weekday=extract(isodow from NEW.date)
        and av."time"=NEW."time"
    ) then
      raise exception using errcode='P0001',message='SLOT_CLOSED';
    end if;
    if NEW.department='College of IT' and NEW.teacher_name is not null then
      if not exists (
        select 1 from public.teacher_availability av
        where av.department=NEW.department and av.teacher_name=NEW.teacher_name
          and av.weekday=extract(isodow from NEW.date) and av."time"=NEW."time"
      ) then
        raise exception using errcode='P0001',message='TEACHER_UNAVAILABLE';
      end if;
      if exists (
        select 1 from public.teacher_blocked_slots b
        where b.department=NEW.department and b.teacher_name=NEW.teacher_name
          and b.date=NEW.date and (b."time" is null or b."time"=NEW."time")
      ) then
        raise exception using errcode='P0001',message='TEACHER_UNAVAILABLE';
      end if;
    end if;
    if exists (
      select 1 from public.blocked_slots b
      where b.department=NEW.department and b.date=NEW.date
        and (b."time" is null or b."time"=NEW."time")
    ) then
      raise exception using errcode='P0001',message='SLOT_CLOSED';
    end if;
    if exists (
      select 1 from public.appointments a
      where a.id is distinct from NEW.id and a.department=NEW.department
        and a.date=NEW.date and a."time"=NEW."time"
        and a.status in ('Approved','Rescheduled')
        and (NEW.department <> 'College of IT' or NEW.teacher_name is null
          or a.teacher_name is null or a.teacher_name=NEW.teacher_name)
    ) then
      raise exception using errcode='P0001',message='SLOT_BOOKED';
    end if;
    return NEW;
  end if;

  if TG_TABLE_NAME = 'blocked_slots' or TG_TABLE_NAME = 'teacher_blocked_slots' then
    if TG_OP = 'DELETE' then return OLD; end if;
    if NEW.date < current_ph::date then
      raise exception using errcode='P0001',message='SLOT_PASSED';
    end if;
    if TG_TABLE_NAME='blocked_slots' then
      if exists (
        select 1 from public.appointments a
        where a.department=NEW.department and a.date=NEW.date
          and (NEW."time" is null or a."time"=NEW."time")
          and a.status in ('Approved','Rescheduled')
      ) then
        raise exception using errcode='P0001',message='CONFIRMED_APPOINTMENTS_EXIST';
      end if;
    else
      if exists (
        select 1 from public.appointments a
        where a.department=NEW.department and a.date=NEW.date
          and (NEW."time" is null or a."time"=NEW."time")
          and a.status in ('Approved','Rescheduled')
          and (a.teacher_name is null or a.teacher_name=NEW.teacher_name)
      ) then
        raise exception using errcode='P0001',message='CONFIRMED_APPOINTMENTS_EXIST';
      end if;
    end if;
    return NEW;
  end if;

  if TG_TABLE_NAME = 'availability' or TG_TABLE_NAME = 'teacher_availability' then
    if TG_OP = 'DELETE' then
      if TG_TABLE_NAME='availability' then
        if exists (
          select 1 from public.appointments a
          where a.department=OLD.department and a.status in ('Approved','Rescheduled')
            and a.date >= current_ph::date and a."time"=OLD."time"
            and extract(isodow from a.date)=OLD.weekday
        ) then
          raise exception using errcode='P0001',message='CONFIRMED_APPOINTMENTS_EXIST';
        end if;
      else
        if exists (
          select 1 from public.appointments a
          where a.department=OLD.department and a.teacher_name=OLD.teacher_name
            and a.status in ('Approved','Rescheduled')
            and a.date >= current_ph::date and a."time"=OLD."time"
            and extract(isodow from a.date)=OLD.weekday
        ) then
          raise exception using errcode='P0001',message='CONFIRMED_APPOINTMENTS_EXIST';
        end if;
      end if;
      return OLD;
    end if;
    if TG_OP = 'UPDATE' then
      if TG_TABLE_NAME='availability' then
        if (OLD.department,OLD.weekday,OLD."time") is distinct from
          (NEW.department,NEW.weekday,NEW."time") and exists (
          select 1 from public.appointments a
          where a.department=OLD.department and a.status in ('Approved','Rescheduled')
            and a.date >= current_ph::date and a."time"=OLD."time"
            and extract(isodow from a.date)=OLD.weekday
        ) then
          raise exception using errcode='P0001',message='CONFIRMED_APPOINTMENTS_EXIST';
        end if;
      else
        if (OLD.department,OLD.teacher_name,OLD.weekday,OLD."time") is distinct from
          (NEW.department,NEW.teacher_name,NEW.weekday,NEW."time") and exists (
          select 1 from public.appointments a
          where a.department=OLD.department and a.teacher_name=OLD.teacher_name
            and a.status in ('Approved','Rescheduled')
            and a.date >= current_ph::date and a."time"=OLD."time"
            and extract(isodow from a.date)=OLD.weekday
        ) then
          raise exception using errcode='P0001',message='CONFIRMED_APPOINTMENTS_EXIST';
        end if;
      end if;
    end if;
    return NEW;
  end if;

  if TG_TABLE_NAME = 'departments' then
    if OLD.active and not NEW.active and exists (
      select 1 from public.appointments a
      where a.department=NEW.name and a.date >= current_ph::date
        and a.status in ('Approved','Rescheduled')
    ) then
      raise exception using errcode='P0001',message='CONFIRMED_APPOINTMENTS_EXIST';
    end if;
    return NEW;
  end if;
  return NEW;
end
$body$;

revoke all on function public.iavms_schedule_guard() from public, anon, authenticated;

drop trigger if exists guard_appointment_schedule on public.appointments;
create trigger guard_appointment_schedule
 before insert or update or delete on public.appointments
 for each row execute function public.iavms_schedule_guard();

drop trigger if exists guard_department_blocks on public.blocked_slots;
create trigger guard_department_blocks
 before insert or update or delete on public.blocked_slots
 for each row execute function public.iavms_schedule_guard();

drop trigger if exists guard_teacher_blocks on public.teacher_blocked_slots;
create trigger guard_teacher_blocks
 before insert or update or delete on public.teacher_blocked_slots
 for each row execute function public.iavms_schedule_guard();

drop trigger if exists guard_department_weekly_hours on public.availability;
create trigger guard_department_weekly_hours
 before insert or update or delete on public.availability
 for each row execute function public.iavms_schedule_guard();

drop trigger if exists guard_teacher_weekly_hours on public.teacher_availability;
create trigger guard_teacher_weekly_hours
 before insert or update or delete on public.teacher_availability
 for each row execute function public.iavms_schedule_guard();

drop trigger if exists guard_department_deactivation on public.departments;
create trigger guard_department_deactivation
 before update on public.departments
 for each row execute function public.iavms_schedule_guard();
