-- Reconstrucción robusta del módulo de entrenamiento.
--
-- Principios:
-- - Es una migración aditiva: conserva catálogo, rutinas y sesiones existentes.
-- - Las rutinas son plantillas; cada sesión guarda snapshots inmutables.
-- - Cada serie planificada/real es una fila independiente.
-- - La rutina solo cambia desde una sesión si el usuario lo pide explícitamente.
-- - Las operaciones compuestas se ejecutan en funciones transaccionales invoker.

begin;

-- ==========================================================
-- Catálogo y plantillas
-- ==========================================================

alter table public.exercises
  add column if not exists source_key text,
  add column if not exists muscle_group_label text,
  add column if not exists implement text,
  add column if not exists weight_mode text,
  add column if not exists notes text;

create unique index if not exists uniq_exercises_user_source_key
on public.exercises (user_id, source_key)
where source_key is not null;

alter table public.routines
  add column if not exists source_key text,
  add column if not exists routine_order integer not null default 1,
  add column if not exists notes text;

alter table public.routines
  drop constraint if exists routines_order_check;
alter table public.routines
  add constraint routines_order_check
  check (routine_order between 1 and 1000);

create unique index if not exists uniq_routines_user_source_key
on public.routines (user_id, source_key)
where source_key is not null;

alter table public.routine_exercises
  add column if not exists exercise_order integer,
  add column if not exists next_adjustment text not null default 'maintain',
  add column if not exists notes text,
  add column if not exists updated_at timestamptz not null default now();

with ordered as (
  select
    id,
    row_number() over (
      partition by routine_id
      order by created_at asc, id asc
    )::integer as position
  from public.routine_exercises
)
update public.routine_exercises re
set exercise_order = ordered.position
from ordered
where ordered.id = re.id
  and re.exercise_order is null;

alter table public.routine_exercises
  alter column exercise_order set default 1,
  alter column exercise_order set not null;

alter table public.routine_exercises
  drop constraint if exists routine_exercises_order_check,
  drop constraint if exists routine_exercises_adjustment_check,
  drop constraint if exists routine_exercises_unique_order;

alter table public.routine_exercises
  add constraint routine_exercises_order_check
    check (exercise_order between 1 and 10000),
  add constraint routine_exercises_adjustment_check
    check (next_adjustment in ('maintain', 'increase_weight', 'increase_reps', 'custom')),
  add constraint routine_exercises_unique_order
    unique (routine_id, exercise_order)
    deferrable initially deferred;

-- Compatibilidad con la app anterior, que no enviaba exercise_order.
create or replace function public.routine_exercises_assign_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.exercise_order is null or exists (
    select 1
    from public.routine_exercises existing
    where existing.routine_id = new.routine_id
      and existing.exercise_order = new.exercise_order
  ) then
    select coalesce(max(existing.exercise_order), 0) + 1
    into new.exercise_order
    from public.routine_exercises existing
    where existing.routine_id = new.routine_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_routine_exercises_assign_order on public.routine_exercises;
create trigger tr_routine_exercises_assign_order
before insert on public.routine_exercises
for each row execute function public.routine_exercises_assign_order();

drop trigger if exists tr_routine_exercises_updated_at on public.routine_exercises;
create trigger tr_routine_exercises_updated_at
before update on public.routine_exercises
for each row execute function public.set_updated_at();

create table if not exists public.routine_exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_exercise_id uuid not null references public.routine_exercises(id) on delete cascade,
  set_number integer not null check (set_number between 1 and 50),
  target_reps integer check (target_reps is null or target_reps between 0 and 1000),
  target_weight_kg numeric(8,2) check (
    target_weight_kg is null or target_weight_kg between 0 and 9999.99
  ),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint routine_exercise_sets_unique_number
    unique (routine_exercise_id, set_number)
);

create index if not exists idx_routine_exercise_sets_parent
on public.routine_exercise_sets (routine_exercise_id, set_number);

create index if not exists idx_routine_exercise_sets_user_parent
on public.routine_exercise_sets (user_id, routine_exercise_id, set_number);

drop trigger if exists tr_routine_exercise_sets_updated_at on public.routine_exercise_sets;
create trigger tr_routine_exercise_sets_updated_at
before update on public.routine_exercise_sets
for each row execute function public.set_updated_at();

create or replace function public.routine_exercise_sets_sync_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select r.user_id into v_owner
  from public.routine_exercises re
  join public.routines r on r.id = re.routine_id
  where re.id = new.routine_exercise_id;

  if v_owner is null then
    raise exception 'routine_exercise_id inválido';
  end if;

  new.user_id := v_owner;
  return new;
end;
$$;

drop trigger if exists tr_routine_exercise_sets_sync_owner on public.routine_exercise_sets;
create trigger tr_routine_exercise_sets_sync_owner
before insert or update of routine_exercise_id, user_id
on public.routine_exercise_sets
for each row execute function public.routine_exercise_sets_sync_owner();

-- Backfill de objetivos para rutinas preexistentes que solo tenían un valor global.
insert into public.routine_exercise_sets (
  user_id,
  routine_exercise_id,
  set_number,
  target_reps,
  target_weight_kg
)
select
  r.user_id,
  re.id,
  generated.set_number,
  e.reps_sugeridas,
  e.peso_sugerido
from public.routine_exercises re
join public.routines r on r.id = re.routine_id
join public.exercises e on e.id = re.exercise_id
cross join lateral generate_series(1, greatest(coalesce(e.series_sugeridas, 1), 1))
  as generated(set_number)
where not exists (
  select 1
  from public.routine_exercise_sets existing
  where existing.routine_exercise_id = re.id
);

-- Una relación creada por la app anterior también recibe objetivos utilizables.
create or replace function public.routine_exercises_create_default_sets()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
  v_sets integer;
  v_reps integer;
  v_weight numeric;
begin
  select
    r.user_id,
    greatest(coalesce(e.series_sugeridas, 1), 1),
    e.reps_sugeridas,
    e.peso_sugerido
  into v_owner, v_sets, v_reps, v_weight
  from public.routines r
  join public.exercises e on e.id = new.exercise_id
  where r.id = new.routine_id;

  insert into public.routine_exercise_sets (
    user_id,
    routine_exercise_id,
    set_number,
    target_reps,
    target_weight_kg
  )
  select v_owner, new.id, generated, v_reps, v_weight
  from generate_series(1, v_sets) generated
  on conflict (routine_exercise_id, set_number) do nothing;

  return new;
end;
$$;

drop trigger if exists tr_routine_exercises_create_default_sets
on public.routine_exercises;
create trigger tr_routine_exercises_create_default_sets
after insert on public.routine_exercises
for each row execute function public.routine_exercises_create_default_sets();

-- ==========================================================
-- Sesiones y snapshots
-- ==========================================================

alter table public.workout_sessions
  add column if not exists routine_name_snapshot text,
  add column if not exists session_name text,
  add column if not exists started_at timestamptz,
  add column if not exists energy_level smallint,
  add column if not exists performance_level smallint,
  add column if not exists pain_level smallint,
  add column if not exists pain_note text,
  add column if not exists abs_completed boolean not null default false,
  add column if not exists treadmill_minutes numeric(6,2),
  add column if not exists treadmill_distance_km numeric(7,2),
  add column if not exists treadmill_speed_kmh numeric(6,2),
  add column if not exists treadmill_incline_percent numeric(5,2),
  add column if not exists notes text;

update public.workout_sessions
set started_at = created_at
where started_at is null;

alter table public.workout_sessions
  alter column started_at set default now(),
  alter column started_at set not null,
  drop constraint if exists workout_sessions_energy_check,
  drop constraint if exists workout_sessions_performance_check,
  drop constraint if exists workout_sessions_pain_check,
  drop constraint if exists workout_sessions_treadmill_check;

alter table public.workout_sessions
  add constraint workout_sessions_energy_check
    check (energy_level is null or energy_level between 1 and 5),
  add constraint workout_sessions_performance_check
    check (performance_level is null or performance_level between 1 and 5),
  add constraint workout_sessions_pain_check
    check (pain_level is null or pain_level between 0 and 10),
  add constraint workout_sessions_treadmill_check check (
    (treadmill_minutes is null or treadmill_minutes between 0 and 1440)
    and (treadmill_distance_km is null or treadmill_distance_km between 0 and 1000)
    and (treadmill_speed_kmh is null or treadmill_speed_kmh between 0 and 100)
    and (
      treadmill_incline_percent is null
      or treadmill_incline_percent between 0 and 100
    )
  );

alter table public.workout_session_exercises
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists routine_exercise_id uuid
    references public.routine_exercises(id) on delete set null,
  add column if not exists exercise_order integer,
  add column if not exists source_type text not null default 'extra',
  add column if not exists muscle_group_label_snapshot text,
  add column if not exists implement_snapshot text,
  add column if not exists weight_mode_snapshot text,
  add column if not exists planned_sets_count integer,
  add column if not exists next_adjustment_snapshot text not null default 'maintain',
  add column if not exists decision text not null default 'maintain',
  add column if not exists decision_note text,
  add column if not exists apply_to_routine boolean not null default false,
  add column if not exists notes text;

update public.workout_session_exercises se
set user_id = ws.user_id
from public.workout_sessions ws
where ws.id = se.workout_session_id
  and se.user_id is null;

with ordered as (
  select
    id,
    row_number() over (
      partition by workout_session_id
      order by created_at asc, id asc
    )::integer as position
  from public.workout_session_exercises
)
update public.workout_session_exercises se
set exercise_order = ordered.position
from ordered
where ordered.id = se.id
  and se.exercise_order is null;

update public.workout_session_exercises
set planned_sets_count = greatest(coalesce(series_reales, 1), 1)
where planned_sets_count is null;

alter table public.workout_session_exercises
  alter column user_id set not null,
  alter column exercise_order set default 1,
  alter column exercise_order set not null,
  alter column planned_sets_count set default 1,
  alter column planned_sets_count set not null,
  drop constraint if exists workout_session_exercises_order_check,
  drop constraint if exists workout_session_exercises_source_check,
  drop constraint if exists workout_session_exercises_planned_sets_check,
  drop constraint if exists workout_session_exercises_adjustment_check,
  drop constraint if exists workout_session_exercises_decision_check,
  drop constraint if exists workout_session_exercises_unique_order;

alter table public.workout_session_exercises
  add constraint workout_session_exercises_order_check
    check (exercise_order between 1 and 10000),
  add constraint workout_session_exercises_source_check
    check (source_type in ('routine', 'extra', 'manual_new')),
  add constraint workout_session_exercises_planned_sets_check
    check (planned_sets_count between 1 and 50),
  add constraint workout_session_exercises_adjustment_check
    check (next_adjustment_snapshot in ('maintain', 'increase_weight', 'increase_reps', 'custom')),
  add constraint workout_session_exercises_decision_check
    check (decision in ('maintain', 'increase_weight', 'increase_reps', 'custom')),
  add constraint workout_session_exercises_unique_order
    unique (workout_session_id, exercise_order)
    deferrable initially deferred;

-- Compatibilidad con la app anterior, que ordenaba solo por created_at.
create or replace function public.workout_session_exercises_assign_order()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.exercise_order is null or exists (
    select 1
    from public.workout_session_exercises existing
    where existing.workout_session_id = new.workout_session_id
      and existing.exercise_order = new.exercise_order
  ) then
    select coalesce(max(existing.exercise_order), 0) + 1
    into new.exercise_order
    from public.workout_session_exercises existing
    where existing.workout_session_id = new.workout_session_id;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_workout_session_exercises_assign_order
on public.workout_session_exercises;
create trigger tr_workout_session_exercises_assign_order
before insert on public.workout_session_exercises
for each row execute function public.workout_session_exercises_assign_order();

create index if not exists idx_workout_session_exercises_user_session
on public.workout_session_exercises (user_id, workout_session_id, exercise_order);

create index if not exists idx_workout_session_exercises_routine_exercise
on public.workout_session_exercises (routine_exercise_id)
where routine_exercise_id is not null;

create or replace function public.workout_session_exercises_init_robust()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_session public.workout_sessions;
  v_exercise public.exercises;
begin
  select * into v_session
  from public.workout_sessions
  where id = new.workout_session_id;

  select * into v_exercise
  from public.exercises
  where id = new.exercise_id;

  if v_session.id is null or v_exercise.id is null then
    raise exception 'Sesión o ejercicio inválido';
  end if;
  if v_session.user_id <> v_exercise.user_id then
    raise exception 'El ejercicio y la sesión deben pertenecer al mismo usuario';
  end if;

  new.user_id := v_session.user_id;
  new.nombre_snapshot := coalesce(nullif(new.nombre_snapshot, ''), v_exercise.nombre);
  new.grupo_muscular_snapshot := coalesce(
    new.grupo_muscular_snapshot,
    v_exercise.grupo_muscular
  );
  new.muscle_group_label_snapshot := coalesce(
    new.muscle_group_label_snapshot,
    v_exercise.muscle_group_label
  );
  new.implement_snapshot := coalesce(new.implement_snapshot, v_exercise.implement);
  new.weight_mode_snapshot := coalesce(new.weight_mode_snapshot, v_exercise.weight_mode);
  new.series_reales := coalesce(new.series_reales, v_exercise.series_sugeridas);
  new.reps_reales := coalesce(new.reps_reales, v_exercise.reps_sugeridas);
  new.peso_real := coalesce(new.peso_real, v_exercise.peso_sugerido);
  new.planned_sets_count := greatest(
    coalesce(new.planned_sets_count, v_exercise.series_sugeridas, 1),
    1
  );

  if new.routine_exercise_id is not null and not exists (
    select 1
    from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = new.routine_exercise_id
      and r.user_id = v_session.user_id
  ) then
    raise exception 'El ejercicio de rutina no pertenece al usuario';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_workout_session_exercises_init on public.workout_session_exercises;
drop trigger if exists tr_workout_session_exercises_init_robust on public.workout_session_exercises;
create trigger tr_workout_session_exercises_init_robust
before insert or update of workout_session_id, exercise_id, user_id
on public.workout_session_exercises
for each row execute function public.workout_session_exercises_init_robust();

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_exercise_id uuid not null
    references public.workout_session_exercises(id) on delete cascade,
  set_number integer not null check (set_number between 1 and 50),
  target_reps integer check (target_reps is null or target_reps between 0 and 1000),
  target_weight_kg numeric(8,2) check (
    target_weight_kg is null or target_weight_kg between 0 and 9999.99
  ),
  actual_reps integer check (actual_reps is null or actual_reps between 0 and 1000),
  actual_weight_kg numeric(8,2) check (
    actual_weight_kg is null or actual_weight_kg between 0 and 9999.99
  ),
  is_completed boolean not null default false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workout_sets_unique_number
    unique (workout_session_exercise_id, set_number)
);

create index if not exists idx_workout_sets_parent
on public.workout_sets (workout_session_exercise_id, set_number);

create index if not exists idx_workout_sets_user_completed
on public.workout_sets (user_id, is_completed, updated_at desc);

drop trigger if exists tr_workout_sets_updated_at on public.workout_sets;
create trigger tr_workout_sets_updated_at
before update on public.workout_sets
for each row execute function public.set_updated_at();

create or replace function public.workout_sets_sync_owner_and_completion()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner
  from public.workout_session_exercises
  where id = new.workout_session_exercise_id;

  if v_owner is null then
    raise exception 'workout_session_exercise_id inválido';
  end if;

  new.user_id := v_owner;
  if new.is_completed then
    new.completed_at := coalesce(new.completed_at, now());
  else
    new.completed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_workout_sets_sync_owner on public.workout_sets;
create trigger tr_workout_sets_sync_owner
before insert or update of workout_session_exercise_id, user_id, is_completed
on public.workout_sets
for each row execute function public.workout_sets_sync_owner_and_completion();

-- Backfill de series para sesiones anteriores. Es solo compatibilidad; el historial
-- viejo sigue siendo secundario y conserva los totales que ya existían.
insert into public.workout_sets (
  user_id,
  workout_session_exercise_id,
  set_number,
  target_reps,
  target_weight_kg,
  actual_reps,
  actual_weight_kg,
  is_completed,
  completed_at
)
select
  se.user_id,
  se.id,
  generated.set_number,
  se.reps_reales,
  se.peso_real,
  se.reps_reales,
  se.peso_real,
  se.is_completed,
  se.completed_at
from public.workout_session_exercises se
cross join lateral generate_series(1, greatest(coalesce(se.series_reales, 1), 1))
  as generated(set_number)
where not exists (
  select 1
  from public.workout_sets existing
  where existing.workout_session_exercise_id = se.id
);

-- Puente de compatibilidad con la versión productiva anterior: al crear una
-- ejecución sin filas de series, genera las filas; al editar sus totales,
-- mantiene esas filas utilizables por el modelo nuevo.
create or replace function public.workout_session_exercises_create_default_sets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.workout_sets (
    user_id,
    workout_session_exercise_id,
    set_number,
    target_reps,
    target_weight_kg,
    actual_reps,
    actual_weight_kg,
    is_completed
  )
  select
    new.user_id,
    new.id,
    generated,
    new.reps_reales,
    new.peso_real,
    new.reps_reales,
    new.peso_real,
    new.is_completed
  from generate_series(1, greatest(coalesce(new.series_reales, 1), 1)) generated
  on conflict (workout_session_exercise_id, set_number) do nothing;
  return new;
end;
$$;

drop trigger if exists tr_workout_session_exercises_create_default_sets
on public.workout_session_exercises;
create trigger tr_workout_session_exercises_create_default_sets
after insert on public.workout_session_exercises
for each row execute function public.workout_session_exercises_create_default_sets();

create or replace function public.workout_session_exercises_sync_legacy_sets()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sets integer := greatest(coalesce(new.series_reales, 1), 1);
begin
  delete from public.workout_sets
  where workout_session_exercise_id = new.id
    and set_number > v_sets;

  insert into public.workout_sets (
    user_id,
    workout_session_exercise_id,
    set_number,
    target_reps,
    target_weight_kg,
    actual_reps,
    actual_weight_kg,
    is_completed
  )
  select
    new.user_id,
    new.id,
    generated,
    new.reps_reales,
    new.peso_real,
    new.reps_reales,
    new.peso_real,
    new.is_completed
  from generate_series(1, v_sets) generated
  on conflict (workout_session_exercise_id, set_number) do update
  set
    actual_reps = excluded.actual_reps,
    actual_weight_kg = excluded.actual_weight_kg,
    is_completed = excluded.is_completed;

  return new;
end;
$$;

drop trigger if exists tr_workout_session_exercises_sync_legacy_sets
on public.workout_session_exercises;
create trigger tr_workout_session_exercises_sync_legacy_sets
after update of series_reales, reps_reales, peso_real, is_completed
on public.workout_session_exercises
for each row execute function public.workout_session_exercises_sync_legacy_sets();

-- ==========================================================
-- RLS y permisos explícitos
-- ==========================================================

alter table public.routine_exercise_sets enable row level security;
alter table public.workout_sets enable row level security;

-- Optimiza también las policies heredadas de la versión anterior.
drop policy if exists exercises_select_own on public.exercises;
create policy exercises_select_own
on public.exercises for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists exercises_insert_own on public.exercises;
create policy exercises_insert_own
on public.exercises for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists exercises_update_own on public.exercises;
create policy exercises_update_own
on public.exercises for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists routines_select_own on public.routines;
create policy routines_select_own
on public.routines for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists routines_insert_own on public.routines;
create policy routines_insert_own
on public.routines for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists routines_update_own on public.routines;
create policy routines_update_own
on public.routines for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists routine_exercises_select_own on public.routine_exercises;
create policy routine_exercises_select_own
on public.routine_exercises for select to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = (select auth.uid())
  )
);

drop policy if exists routine_exercises_insert_own on public.routine_exercises;
create policy routine_exercises_insert_own
on public.routine_exercises for insert to authenticated
with check (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = (select auth.uid())
  )
);

drop policy if exists routine_exercises_update_own on public.routine_exercises;
create policy routine_exercises_update_own
on public.routine_exercises for update to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = (select auth.uid())
  )
);

drop policy if exists routine_exercises_delete_own on public.routine_exercises;
create policy routine_exercises_delete_own
on public.routine_exercises for delete to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = (select auth.uid())
  )
);

drop policy if exists workout_sessions_select_own on public.workout_sessions;
create policy workout_sessions_select_own
on public.workout_sessions for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists workout_sessions_insert_own on public.workout_sessions;
create policy workout_sessions_insert_own
on public.workout_sessions for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists workout_sessions_update_own on public.workout_sessions;
create policy workout_sessions_update_own
on public.workout_sessions for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists workout_sessions_delete_own on public.workout_sessions;
create policy workout_sessions_delete_own
on public.workout_sessions for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists routine_exercise_sets_select_own on public.routine_exercise_sets;
create policy routine_exercise_sets_select_own
on public.routine_exercise_sets for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists routine_exercise_sets_insert_own on public.routine_exercise_sets;
create policy routine_exercise_sets_insert_own
on public.routine_exercise_sets for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists routine_exercise_sets_update_own on public.routine_exercise_sets;
create policy routine_exercise_sets_update_own
on public.routine_exercise_sets for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists routine_exercise_sets_delete_own on public.routine_exercise_sets;
create policy routine_exercise_sets_delete_own
on public.routine_exercise_sets for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists workout_sets_select_own on public.workout_sets;
create policy workout_sets_select_own
on public.workout_sets for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own
on public.workout_sets for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own
on public.workout_sets for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists workout_sets_delete_own on public.workout_sets;
create policy workout_sets_delete_own
on public.workout_sets for delete to authenticated
using (user_id = (select auth.uid()));

-- Ahora workout_session_exercises vuelve a tener owner directo.
drop policy if exists workout_session_exercises_select_own on public.workout_session_exercises;
create policy workout_session_exercises_select_own
on public.workout_session_exercises for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists workout_session_exercises_insert_own on public.workout_session_exercises;
create policy workout_session_exercises_insert_own
on public.workout_session_exercises for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists workout_session_exercises_update_own on public.workout_session_exercises;
create policy workout_session_exercises_update_own
on public.workout_session_exercises for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists workout_session_exercises_delete_own on public.workout_session_exercises;
create policy workout_session_exercises_delete_own
on public.workout_session_exercises for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.routine_exercise_sets from anon;
revoke all on table public.workout_sets from anon;
grant select, insert, update, delete on table public.routine_exercise_sets to authenticated;
grant select, insert, update, delete on table public.workout_sets to authenticated;

-- ==========================================================
-- Operaciones transaccionales
-- ==========================================================

create or replace function public.start_workout_session(
  p_day_log_id uuid,
  p_routine_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session_id uuid;
  v_routine_name text;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1 from public.day_logs
    where id = p_day_log_id and user_id = v_user_id
  ) then
    raise exception 'Fecha inválida o ajena';
  end if;

  if exists (
    select 1 from public.workout_sessions
    where user_id = v_user_id and status = 'in_progress'
  ) then
    raise exception 'Ya existe una sesión en curso';
  end if;

  if p_routine_id is not null then
    select nombre into v_routine_name
    from public.routines
    where id = p_routine_id
      and user_id = v_user_id
      and is_active;

    if v_routine_name is null then
      raise exception 'Rutina inválida o archivada';
    end if;
  end if;

  insert into public.workout_sessions (
    user_id,
    day_log_id,
    routine_id,
    routine_name_snapshot,
    session_name,
    status,
    started_at
  ) values (
    v_user_id,
    p_day_log_id,
    p_routine_id,
    v_routine_name,
    coalesce(v_routine_name, 'Sesión libre'),
    'in_progress',
    now()
  )
  returning id into v_session_id;

  if p_routine_id is not null then
    insert into public.workout_session_exercises (
      user_id,
      workout_session_id,
      routine_exercise_id,
      exercise_id,
      nombre_snapshot,
      grupo_muscular_snapshot,
      muscle_group_label_snapshot,
      implement_snapshot,
      weight_mode_snapshot,
      source_type,
      exercise_order,
      planned_sets_count,
      next_adjustment_snapshot,
      decision,
      notes
    )
    select
      v_user_id,
      v_session_id,
      re.id,
      e.id,
      e.nombre,
      e.grupo_muscular,
      e.muscle_group_label,
      e.implement,
      e.weight_mode,
      'routine',
      re.exercise_order,
      greatest(
        coalesce(nullif(count(res.id), 0), e.series_sugeridas, 1),
        1
      )::integer,
      re.next_adjustment,
      re.next_adjustment,
      re.notes
    from public.routine_exercises re
    join public.exercises e on e.id = re.exercise_id
    left join public.routine_exercise_sets res on res.routine_exercise_id = re.id
    where re.routine_id = p_routine_id
    group by re.id, e.id
    order by re.exercise_order;

    insert into public.workout_sets (
      user_id,
      workout_session_exercise_id,
      set_number,
      target_reps,
      target_weight_kg,
      actual_reps,
      actual_weight_kg
    )
    select
      v_user_id,
      se.id,
      generated.set_number,
      coalesce(res.target_reps, e.reps_sugeridas),
      coalesce(res.target_weight_kg, e.peso_sugerido),
      coalesce(res.target_reps, e.reps_sugeridas),
      coalesce(res.target_weight_kg, e.peso_sugerido)
    from public.workout_session_exercises se
    join public.exercises e on e.id = se.exercise_id
    cross join lateral generate_series(1, se.planned_sets_count)
      as generated(set_number)
    left join public.routine_exercise_sets res
      on res.routine_exercise_id = se.routine_exercise_id
      and res.set_number = generated.set_number
    where se.workout_session_id = v_session_id
    on conflict (workout_session_exercise_id, set_number) do update
    set
      target_reps = excluded.target_reps,
      target_weight_kg = excluded.target_weight_kg,
      actual_reps = excluded.actual_reps,
      actual_weight_kg = excluded.actual_weight_kg;
  end if;

  return v_session_id;
end;
$$;

create or replace function public.append_workout_exercise(
  p_session_id uuid,
  p_exercise_id uuid,
  p_source_type text default 'extra'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_exercise public.exercises;
  v_session_exercise_id uuid;
  v_order integer;
  v_sets integer;
begin
  if p_source_type not in ('extra', 'manual_new') then
    raise exception 'Origen inválido';
  end if;

  if not exists (
    select 1 from public.workout_sessions
    where id = p_session_id
      and user_id = v_user_id
      and status = 'in_progress'
  ) then
    raise exception 'La sesión no existe o ya finalizó';
  end if;

  select * into v_exercise
  from public.exercises
  where id = p_exercise_id and user_id = v_user_id and is_active;

  if v_exercise.id is null then
    raise exception 'Ejercicio inválido o archivado';
  end if;

  select coalesce(max(exercise_order), 0) + 1 into v_order
  from public.workout_session_exercises
  where workout_session_id = p_session_id;

  v_sets := greatest(coalesce(v_exercise.series_sugeridas, 1), 1);

  insert into public.workout_session_exercises (
    user_id,
    workout_session_id,
    exercise_id,
    nombre_snapshot,
    grupo_muscular_snapshot,
    muscle_group_label_snapshot,
    implement_snapshot,
    weight_mode_snapshot,
    source_type,
    exercise_order,
    planned_sets_count
  ) values (
    v_user_id,
    p_session_id,
    v_exercise.id,
    v_exercise.nombre,
    v_exercise.grupo_muscular,
    v_exercise.muscle_group_label,
    v_exercise.implement,
    v_exercise.weight_mode,
    p_source_type,
    v_order,
    v_sets
  )
  returning id into v_session_exercise_id;

  insert into public.workout_sets (
    user_id,
    workout_session_exercise_id,
    set_number,
    target_reps,
    target_weight_kg,
    actual_reps,
    actual_weight_kg
  )
  select
    v_user_id,
    v_session_exercise_id,
    generated,
    v_exercise.reps_sugeridas,
    v_exercise.peso_sugerido,
    v_exercise.reps_sugeridas,
    v_exercise.peso_sugerido
  from generate_series(1, v_sets) generated
  on conflict (workout_session_exercise_id, set_number) do update
  set
    target_reps = excluded.target_reps,
    target_weight_kg = excluded.target_weight_kg,
    actual_reps = excluded.actual_reps,
    actual_weight_kg = excluded.actual_weight_kg;

  return v_session_exercise_id;
end;
$$;

create or replace function public.save_workout_exercise(
  p_session_exercise_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.workout_session_exercises;
  v_sets_count integer;
  v_updated_at timestamptz;
begin
  select se.* into v_row
  from public.workout_session_exercises se
  join public.workout_sessions ws on ws.id = se.workout_session_id
  where se.id = p_session_exercise_id
    and se.user_id = v_user_id
    and ws.status = 'in_progress'
  for update of se;

  if v_row.id is null then
    raise exception 'El ejercicio no existe o la sesión ya finalizó';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using
      errcode = '40001',
      message = 'El ejercicio cambió en otro dispositivo. Recargá antes de guardar.';
  end if;

  if jsonb_typeof(p_payload -> 'sets') <> 'array' then
    raise exception 'sets debe ser un array';
  end if;
  v_sets_count := jsonb_array_length(p_payload -> 'sets');
  if v_sets_count < 1 or v_sets_count > 50 then
    raise exception 'La cantidad de series debe estar entre 1 y 50';
  end if;

  update public.workout_session_exercises
  set
    planned_sets_count = v_sets_count,
    series_reales = v_sets_count,
    reps_reales = nullif(p_payload #>> '{sets,0,actual_reps}', '')::integer,
    peso_real = nullif(p_payload #>> '{sets,0,actual_weight_kg}', '')::numeric,
    is_completed = coalesce((p_payload ->> 'is_completed')::boolean, false),
    decision = coalesce(nullif(p_payload ->> 'decision', ''), 'maintain'),
    decision_note = nullif(p_payload ->> 'decision_note', ''),
    apply_to_routine = case
      when routine_exercise_id is null then false
      else coalesce((p_payload ->> 'apply_to_routine')::boolean, false)
    end,
    notes = nullif(p_payload ->> 'notes', '')
  where id = p_session_exercise_id
  returning updated_at into v_updated_at;

  delete from public.workout_sets
  where workout_session_exercise_id = p_session_exercise_id;

  insert into public.workout_sets (
    user_id,
    workout_session_exercise_id,
    set_number,
    target_reps,
    target_weight_kg,
    actual_reps,
    actual_weight_kg,
    is_completed,
    notes
  )
  select
    v_user_id,
    p_session_exercise_id,
    item.set_number,
    item.target_reps,
    item.target_weight_kg,
    item.actual_reps,
    item.actual_weight_kg,
    coalesce(item.is_completed, false),
    nullif(item.notes, '')
  from jsonb_to_recordset(p_payload -> 'sets') as item(
    set_number integer,
    target_reps integer,
    target_weight_kg numeric,
    actual_reps integer,
    actual_weight_kg numeric,
    is_completed boolean,
    notes text
  );

  if (select count(*) from public.workout_sets
      where workout_session_exercise_id = p_session_exercise_id) <> v_sets_count then
    raise exception 'Las series deben tener números únicos';
  end if;
  if exists (
    select 1
    from (
      select
        min(set_number) as first_number,
        max(set_number) as last_number,
        count(*)::integer as total
      from public.workout_sets
      where workout_session_exercise_id = p_session_exercise_id
    ) numbered
    where numbered.first_number <> 1
      or numbered.last_number <> numbered.total
  ) then
    raise exception 'Las series deben estar numeradas en orden desde 1';
  end if;

  return v_updated_at;
end;
$$;

create or replace function public.save_routine_exercise(
  p_routine_exercise_id uuid,
  p_payload jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_sets_count integer;
  v_updated_at timestamptz;
begin
  if not exists (
    select 1
    from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = p_routine_exercise_id and r.user_id = v_user_id
  ) then
    raise exception 'Ejercicio de rutina inválido';
  end if;

  if jsonb_typeof(p_payload -> 'sets') <> 'array' then
    raise exception 'sets debe ser un array';
  end if;
  v_sets_count := jsonb_array_length(p_payload -> 'sets');
  if v_sets_count < 1 or v_sets_count > 50 then
    raise exception 'La cantidad de series debe estar entre 1 y 50';
  end if;

  update public.routine_exercises
  set
    next_adjustment = coalesce(nullif(p_payload ->> 'next_adjustment', ''), 'maintain'),
    notes = nullif(p_payload ->> 'notes', '')
  where id = p_routine_exercise_id
  returning updated_at into v_updated_at;

  delete from public.routine_exercise_sets
  where routine_exercise_id = p_routine_exercise_id;

  insert into public.routine_exercise_sets (
    user_id,
    routine_exercise_id,
    set_number,
    target_reps,
    target_weight_kg,
    notes
  )
  select
    v_user_id,
    p_routine_exercise_id,
    item.set_number,
    item.target_reps,
    item.target_weight_kg,
    nullif(item.notes, '')
  from jsonb_to_recordset(p_payload -> 'sets') as item(
    set_number integer,
    target_reps integer,
    target_weight_kg numeric,
    notes text
  );

  if exists (
    select 1
    from (
      select
        min(set_number) as first_number,
        max(set_number) as last_number,
        count(*)::integer as total
      from public.routine_exercise_sets
      where routine_exercise_id = p_routine_exercise_id
    ) numbered
    where numbered.first_number <> 1
      or numbered.last_number <> numbered.total
  ) then
    raise exception 'Las series deben estar numeradas en orden desde 1';
  end if;

  return v_updated_at;
end;
$$;

create or replace function public.move_routine_exercise(
  p_routine_exercise_id uuid,
  p_direction integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current public.routine_exercises;
  v_other public.routine_exercises;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Dirección inválida';
  end if;

  select re.* into v_current
  from public.routine_exercises re
  join public.routines r on r.id = re.routine_id
  where re.id = p_routine_exercise_id and r.user_id = v_user_id;

  if v_current.id is null then
    raise exception 'Ejercicio de rutina inválido';
  end if;

  if p_direction = -1 then
    select * into v_other
    from public.routine_exercises
    where routine_id = v_current.routine_id
      and exercise_order < v_current.exercise_order
    order by exercise_order desc
    limit 1;
  else
    select * into v_other
    from public.routine_exercises
    where routine_id = v_current.routine_id
      and exercise_order > v_current.exercise_order
    order by exercise_order asc
    limit 1;
  end if;

  if v_other.id is null then
    return;
  end if;

  -- Ambos movimientos concurrentes toman los locks en el mismo orden.
  perform 1
  from public.routine_exercises
  where id in (v_current.id, v_other.id)
  order by id
  for update;

  select * into v_current
  from public.routine_exercises
  where id = v_current.id;
  select * into v_other
  from public.routine_exercises
  where id = v_other.id;

  set constraints routine_exercises_unique_order deferred;
  update public.routine_exercises
  set exercise_order = case
    when id = v_current.id then v_other.exercise_order
    when id = v_other.id then v_current.exercise_order
  end
  where id in (v_current.id, v_other.id);
end;
$$;

create or replace function public.finish_workout_session(
  p_session_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.workout_sessions;
  v_exercise record;
begin
  select * into v_session
  from public.workout_sessions
  where id = p_session_id
    and user_id = v_user_id
    and status = 'in_progress'
  for update;

  if v_session.id is null then
    raise exception 'La sesión no existe o ya finalizó';
  end if;

  if not exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sets ws
      on ws.workout_session_exercise_id = se.id
    where se.workout_session_id = p_session_id
      and se.is_completed
      and ws.is_completed
  ) then
    raise exception 'Marcá y guardá al menos una serie antes de finalizar';
  end if;

  for v_exercise in
    select *
    from public.workout_session_exercises
    where workout_session_id = p_session_id
      and apply_to_routine
      and routine_exercise_id is not null
  loop
    if exists (
      select 1
      from public.workout_sets ws
      where ws.workout_session_exercise_id = v_exercise.id
        and ws.is_completed
    ) then
      delete from public.routine_exercise_sets
      where routine_exercise_id = v_exercise.routine_exercise_id;

      insert into public.routine_exercise_sets (
        user_id,
        routine_exercise_id,
        set_number,
        target_reps,
        target_weight_kg,
        notes
      )
      select
        v_user_id,
        v_exercise.routine_exercise_id,
        row_number() over (order by ws.set_number)::integer,
        coalesce(ws.actual_reps, ws.target_reps),
        coalesce(ws.actual_weight_kg, ws.target_weight_kg),
        ws.notes
      from public.workout_sets ws
      where ws.workout_session_exercise_id = v_exercise.id
        and ws.is_completed;

      update public.routine_exercises
      set
        next_adjustment = v_exercise.decision,
        notes = coalesce(v_exercise.decision_note, notes)
      where id = v_exercise.routine_exercise_id;
    end if;
  end loop;

  update public.workout_sessions
  set
    session_name = coalesce(nullif(p_metadata ->> 'session_name', ''), session_name),
    energy_level = nullif(p_metadata ->> 'energy_level', '')::smallint,
    performance_level = nullif(p_metadata ->> 'performance_level', '')::smallint,
    pain_level = nullif(p_metadata ->> 'pain_level', '')::smallint,
    pain_note = nullif(p_metadata ->> 'pain_note', ''),
    abs_completed = coalesce((p_metadata ->> 'abs_completed')::boolean, false),
    treadmill_minutes = nullif(p_metadata ->> 'treadmill_minutes', '')::numeric,
    treadmill_distance_km = nullif(p_metadata ->> 'treadmill_distance_km', '')::numeric,
    treadmill_speed_kmh = nullif(p_metadata ->> 'treadmill_speed_kmh', '')::numeric,
    treadmill_incline_percent = nullif(
      p_metadata ->> 'treadmill_incline_percent',
      ''
    )::numeric,
    notes = nullif(p_metadata ->> 'notes', ''),
    status = 'completed',
    ended_at = now()
  where id = p_session_id;

  return p_session_id;
end;
$$;

create or replace function public.import_training_plan(p_plan jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_routine jsonb;
  v_exercise jsonb;
  v_set jsonb;
  v_routine_id uuid;
  v_exercise_id uuid;
  v_routine_exercise_id uuid;
  v_routines integer := 0;
  v_exercises integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if jsonb_typeof(p_plan -> 'routines') <> 'array'
    or jsonb_array_length(p_plan -> 'routines') not between 1 and 20 then
    raise exception 'Plan inválido';
  end if;
  if exists (
    select 1 from public.workout_sessions
    where user_id = v_user_id and status = 'in_progress'
  ) then
    raise exception 'Finalizá o cancelá la sesión activa antes de importar rutinas';
  end if;

  for v_routine in select value from jsonb_array_elements(p_plan -> 'routines')
  loop
    if nullif(v_routine ->> 'source_key', '') is null
      or nullif(v_routine ->> 'name', '') is null then
      raise exception 'Rutina sin identificador o nombre';
    end if;

    select id into v_routine_id
    from public.routines
    where user_id = v_user_id
      and (
        source_key = v_routine ->> 'source_key'
        or lower(public.normalize_name(nombre)) =
          lower(public.normalize_name(v_routine ->> 'name'))
      )
    order by (source_key = v_routine ->> 'source_key') desc
    limit 1;

    if v_routine_id is null then
      insert into public.routines (
        user_id, source_key, nombre, color, routine_order, notes, is_active
      ) values (
        v_user_id,
        v_routine ->> 'source_key',
        v_routine ->> 'name',
        nullif(v_routine ->> 'color', ''),
        (v_routine ->> 'order')::integer,
        nullif(v_routine ->> 'notes', ''),
        true
      ) returning id into v_routine_id;
    else
      update public.routines
      set
        source_key = v_routine ->> 'source_key',
        nombre = v_routine ->> 'name',
        color = nullif(v_routine ->> 'color', ''),
        routine_order = (v_routine ->> 'order')::integer,
        notes = nullif(v_routine ->> 'notes', ''),
        is_active = true
      where id = v_routine_id;
    end if;

    delete from public.routine_exercises where routine_id = v_routine_id;
    v_routines := v_routines + 1;

    if jsonb_typeof(v_routine -> 'exercises') <> 'array'
      or jsonb_array_length(v_routine -> 'exercises') not between 1 and 100 then
      raise exception 'Rutina sin ejercicios válidos';
    end if;

    for v_exercise in select value from jsonb_array_elements(v_routine -> 'exercises')
    loop
      if jsonb_typeof(v_exercise -> 'sets') <> 'array'
        or jsonb_array_length(v_exercise -> 'sets') not between 1 and 50 then
        raise exception 'Ejercicio sin series válidas';
      end if;

      select id into v_exercise_id
      from public.exercises
      where user_id = v_user_id
        and (
          source_key = v_exercise ->> 'source_key'
          or lower(public.normalize_name(nombre)) =
            lower(public.normalize_name(v_exercise ->> 'name'))
        )
      order by (source_key = v_exercise ->> 'source_key') desc
      limit 1;

      if v_exercise_id is null then
        insert into public.exercises (
          user_id,
          source_key,
          nombre,
          grupo_muscular,
          muscle_group_label,
          implement,
          weight_mode,
          series_sugeridas,
          reps_sugeridas,
          peso_sugerido,
          notes,
          is_active
        ) values (
          v_user_id,
          v_exercise ->> 'source_key',
          v_exercise ->> 'name',
          nullif(v_exercise ->> 'legacy_group', '')::public.muscle_group,
          nullif(v_exercise ->> 'muscle_group', ''),
          nullif(v_exercise ->> 'implement', ''),
          nullif(v_exercise ->> 'weight_mode', ''),
          jsonb_array_length(v_exercise -> 'sets'),
          nullif(v_exercise #>> '{sets,0,reps}', '')::integer,
          nullif(v_exercise #>> '{sets,0,weight_kg}', '')::numeric,
          nullif(v_exercise ->> 'notes', ''),
          true
        ) returning id into v_exercise_id;
      else
        update public.exercises
        set
          source_key = v_exercise ->> 'source_key',
          nombre = v_exercise ->> 'name',
          grupo_muscular = nullif(v_exercise ->> 'legacy_group', '')::public.muscle_group,
          muscle_group_label = nullif(v_exercise ->> 'muscle_group', ''),
          implement = nullif(v_exercise ->> 'implement', ''),
          weight_mode = nullif(v_exercise ->> 'weight_mode', ''),
          series_sugeridas = jsonb_array_length(v_exercise -> 'sets'),
          reps_sugeridas = nullif(v_exercise #>> '{sets,0,reps}', '')::integer,
          peso_sugerido = nullif(v_exercise #>> '{sets,0,weight_kg}', '')::numeric,
          notes = nullif(v_exercise ->> 'notes', ''),
          is_active = true
        where id = v_exercise_id;
      end if;

      insert into public.routine_exercises (
        routine_id,
        exercise_id,
        exercise_order,
        next_adjustment,
        notes
      ) values (
        v_routine_id,
        v_exercise_id,
        (v_exercise ->> 'order')::integer,
        coalesce(nullif(v_exercise ->> 'next_adjustment', ''), 'maintain'),
        nullif(v_exercise ->> 'routine_notes', '')
      ) returning id into v_routine_exercise_id;

      for v_set in select value from jsonb_array_elements(v_exercise -> 'sets')
      loop
        insert into public.routine_exercise_sets (
          user_id,
          routine_exercise_id,
          set_number,
          target_reps,
          target_weight_kg
        ) values (
          v_user_id,
          v_routine_exercise_id,
          (v_set ->> 'set_number')::integer,
          nullif(v_set ->> 'reps', '')::integer,
          nullif(v_set ->> 'weight_kg', '')::numeric
        )
        on conflict (routine_exercise_id, set_number) do update
        set
          target_reps = excluded.target_reps,
          target_weight_kg = excluded.target_weight_kg;
      end loop;

      v_exercises := v_exercises + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'routines', v_routines,
    'exercises', v_exercises
  );
end;
$$;

revoke all on function public.start_workout_session(uuid, uuid) from public, anon;
revoke all on function public.append_workout_exercise(uuid, uuid, text) from public, anon;
revoke all on function public.save_workout_exercise(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.save_routine_exercise(uuid, jsonb) from public, anon;
revoke all on function public.move_routine_exercise(uuid, integer) from public, anon;
revoke all on function public.finish_workout_session(uuid, jsonb) from public, anon;
revoke all on function public.import_training_plan(jsonb) from public, anon;

grant execute on function public.start_workout_session(uuid, uuid) to authenticated;
grant execute on function public.append_workout_exercise(uuid, uuid, text) to authenticated;
grant execute on function public.save_workout_exercise(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.save_routine_exercise(uuid, jsonb) to authenticated;
grant execute on function public.move_routine_exercise(uuid, integer) to authenticated;
grant execute on function public.finish_workout_session(uuid, jsonb) to authenticated;
grant execute on function public.import_training_plan(jsonb) to authenticated;

commit;
