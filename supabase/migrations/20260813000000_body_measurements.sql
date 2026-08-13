-- Seguimiento corporal: medidas históricas independientes del peso diario.
begin;

create table if not exists public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  waist_cm numeric(5,2),
  chest_cm numeric(5,2),
  arm_cm numeric(5,2),
  thigh_cm numeric(5,2),
  hip_cm numeric(5,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint body_measurements_one_or_more_values check (
    waist_cm is not null
    or chest_cm is not null
    or arm_cm is not null
    or thigh_cm is not null
    or hip_cm is not null
  ),
  constraint body_measurements_values_in_range check (
    (waist_cm is null or (waist_cm > 0 and waist_cm <= 500))
    and (chest_cm is null or (chest_cm > 0 and chest_cm <= 500))
    and (arm_cm is null or (arm_cm > 0 and arm_cm <= 500))
    and (thigh_cm is null or (thigh_cm > 0 and thigh_cm <= 500))
    and (hip_cm is null or (hip_cm > 0 and hip_cm <= 500))
  ),
  constraint body_measurements_user_date_unique unique (user_id, measured_on)
);

-- La restricción única también es un índice B-tree utilizable para ownership y
-- lecturas por fecha (incluido el orden descendente).

drop trigger if exists tr_body_measurements_updated_at on public.body_measurements;
create trigger tr_body_measurements_updated_at
before update on public.body_measurements
for each row
execute function public.set_updated_at();

grant select, insert, update, delete on public.body_measurements to authenticated;

alter table public.body_measurements enable row level security;

drop policy if exists body_measurements_select_own on public.body_measurements;
create policy body_measurements_select_own
on public.body_measurements
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists body_measurements_insert_own on public.body_measurements;
create policy body_measurements_insert_own
on public.body_measurements
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists body_measurements_update_own on public.body_measurements;
create policy body_measurements_update_own
on public.body_measurements
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists body_measurements_delete_own on public.body_measurements;
create policy body_measurements_delete_own
on public.body_measurements
for delete
to authenticated
using ((select auth.uid()) = user_id);

commit;
