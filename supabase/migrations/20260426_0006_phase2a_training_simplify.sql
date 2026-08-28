-- Fase 2A (definición cerrada): simplificación del modelo de entrenamiento.
-- Objetivo: ajustar tablas existentes a campos mínimos + workout_sets mínimo.
-- Nota: esta migración asume que ya existe la migración 20260426_0005_phase2a_training.sql.
begin;

-- ==========================================================
-- Types
-- ==========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'muscle_group') then
    create type public.muscle_group as enum (
      'pecho',
      'espalda',
      'piernas',
      'hombros',
      'bíceps',
      'tríceps',
      'abdomen',
      'cardio'
    );
  end if;
end $$;

-- ==========================================================
-- Drop triggers/functions that referenced removed columns
-- ==========================================================

-- IMPORTANTE:
-- Antes de dropear columnas (p. ej. user_id) hay que dropear policies que dependan de esas columnas.
-- Si no, Postgres rechaza el ALTER TABLE (error 2BP01).

-- Policies que dependían de workout_sessions.user_id / workout_session_exercises.user_id / workout_sets.user_id
drop policy if exists workout_sessions_select_own on public.workout_sessions;
drop policy if exists workout_sessions_insert_own on public.workout_sessions;
drop policy if exists workout_sessions_update_own on public.workout_sessions;
drop policy if exists workout_sessions_delete_own on public.workout_sessions;

drop policy if exists workout_session_exercises_select_own on public.workout_session_exercises;
drop policy if exists workout_session_exercises_insert_own on public.workout_session_exercises;
drop policy if exists workout_session_exercises_update_own on public.workout_session_exercises;
drop policy if exists workout_session_exercises_delete_own on public.workout_session_exercises;

drop policy if exists workout_sets_select_own on public.workout_sets;
drop policy if exists workout_sets_insert_own on public.workout_sets;
drop policy if exists workout_sets_update_own on public.workout_sets;
drop policy if exists workout_sets_delete_own on public.workout_sets;

drop trigger if exists tr_workout_sessions_owner on public.workout_sessions;
drop function if exists public.workout_sessions_enforce_owner();

drop trigger if exists tr_workout_session_exercises_owner on public.workout_session_exercises;
drop function if exists public.workout_session_exercises_enforce_owner();

drop trigger if exists tr_workout_sets_owner on public.workout_sets;
drop function if exists public.workout_sets_enforce_owner();

drop trigger if exists tr_routine_exercises_owner on public.routine_exercises;
drop function if exists public.routine_exercises_enforce_owner();

-- ==========================================================
-- exercises -> modelo cerrado
-- ==========================================================

do $$
begin
  -- Si la tabla viene de 0005, puede tener `name`. Si ya se aplicó otra migración, puede existir solo `nombre`.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name = 'name'
  ) then
    alter table public.exercises rename column name to nombre;
  end if;
end $$;

-- category/exercise_type/defaults/notes no van en esta fase
alter table public.exercises
  drop column if exists category,
  drop column if exists exercise_type,
  drop column if exists default_rest_seconds,
  drop column if exists notes;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name = 'default_sets'
  ) then
    alter table public.exercises rename column default_sets to series_recomendadas;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name = 'default_reps'
  ) then
    alter table public.exercises rename column default_reps to reps_recomendadas;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'exercises'
      and column_name = 'default_weight_kg'
  ) then
    alter table public.exercises rename column default_weight_kg to peso_recomendado;
  end if;
end $$;

alter table public.exercises
  add column if not exists grupo_muscular public.muscle_group;

-- Reglas mínimas: recomendaciones >= 0 si existen
alter table public.exercises
  drop constraint if exists exercises_series_recomendadas_check;
alter table public.exercises
  add constraint exercises_series_recomendadas_check
  check (series_recomendadas is null or series_recomendadas >= 0);

alter table public.exercises
  drop constraint if exists exercises_reps_recomendadas_check;
alter table public.exercises
  add constraint exercises_reps_recomendadas_check
  check (reps_recomendadas is null or reps_recomendadas >= 0);

alter table public.exercises
  drop constraint if exists exercises_peso_recomendado_check;
alter table public.exercises
  add constraint exercises_peso_recomendado_check
  check (peso_recomendado is null or peso_recomendado >= 0);

-- Actualizar índice unique (por nombre)
drop index if exists public.uniq_exercises_user_name_ci;
create unique index if not exists uniq_exercises_user_nombre_ci
on public.exercises(user_id, lower(nombre));

-- ==========================================================
-- routines -> modelo cerrado
-- ==========================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'routines'
      and column_name = 'name'
  ) then
    alter table public.routines rename column name to nombre;
  end if;
end $$;

alter table public.routines
  drop column if exists routine_type,
  drop column if exists notes;

drop index if exists public.uniq_routines_user_name_ci;
create unique index if not exists uniq_routines_user_nombre_ci
on public.routines(user_id, lower(nombre));

-- ==========================================================
-- routine_exercises -> sin orden manual ni defaults
-- ==========================================================

alter table public.routine_exercises
  drop constraint if exists routine_exercises_unique_order;

alter table public.routine_exercises
  drop column if exists exercise_order,
  drop column if exists default_sets,
  drop column if exists default_reps,
  drop column if exists default_rest_seconds,
  drop column if exists default_weight_kg,
  drop column if exists default_duration_seconds,
  drop column if exists default_distance_meters,
  drop column if exists default_speed_kmh,
  drop column if exists default_incline_percent,
  drop column if exists notes;

drop index if exists public.idx_routine_exercises_routine_order;
create index if not exists idx_routine_exercises_routine_created_at
on public.routine_exercises(routine_id, created_at asc);

-- Integridad: el exercise debe ser del mismo usuario que la rutina
create or replace function public.routine_exercises_enforce_owner_min()
returns trigger
language plpgsql
as $$
declare
  v_routine_user uuid;
  v_exercise_user uuid;
begin
  select user_id into v_routine_user from public.routines where id = new.routine_id;
  if v_routine_user is null then
    raise exception 'routine_id inválido';
  end if;
  select user_id into v_exercise_user from public.exercises where id = new.exercise_id;
  if v_exercise_user is null then
    raise exception 'exercise_id inválido';
  end if;
  if v_routine_user <> v_exercise_user then
    raise exception 'routine_exercises debe referenciar exercise del mismo usuario';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_routine_exercises_owner_min on public.routine_exercises;
create trigger tr_routine_exercises_owner_min
before insert or update of routine_id, exercise_id on public.routine_exercises
for each row
execute function public.routine_exercises_enforce_owner_min();

-- ==========================================================
-- workout_sessions -> sin user_id / sin metadatos extra
-- ==========================================================

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'workout_sessions'
      and column_name = 'base_routine_id'
  ) then
    alter table public.workout_sessions rename column base_routine_id to routine_id;
  end if;
end $$;

alter table public.workout_sessions
  drop constraint if exists workout_sessions_unique_order;

alter table public.workout_sessions
  drop column if exists user_id,
  drop column if exists title,
  drop column if exists session_order,
  drop column if exists started_at,
  drop column if exists ended_at,
  drop column if exists notes;

drop index if exists public.idx_workout_sessions_user_day;
drop index if exists public.idx_workout_sessions_day_order;
drop index if exists public.idx_workout_sessions_active;

create index if not exists idx_workout_sessions_day_created
on public.workout_sessions(day_log_id, created_at desc);

-- ==========================================================
-- workout_session_exercises -> mínimo + snapshots requeridos
-- ==========================================================

alter table public.workout_session_exercises
  rename column exercise_name_snapshot to nombre_snapshot;

alter table public.workout_session_exercises
  rename column category_snapshot to grupo_muscular_snapshot_text;

alter table public.workout_session_exercises
  drop constraint if exists workout_session_exercises_unique_order;

alter table public.workout_session_exercises
  drop column if exists user_id,
  drop column if exists routine_exercise_id,
  drop column if exists exercise_type_snapshot,
  drop column if exists source_type,
  drop column if exists exercise_order,
  drop column if exists notes;

-- Cambiamos grupo_muscular_snapshot a enum (nuevo)
alter table public.workout_session_exercises
  add column if not exists grupo_muscular_snapshot public.muscle_group;

-- Backfill best-effort desde texto antiguo si existía (si no existía, queda null)
update public.workout_session_exercises
set grupo_muscular_snapshot = case grupo_muscular_snapshot_text
  when 'pecho' then 'pecho'::public.muscle_group
  when 'espalda' then 'espalda'::public.muscle_group
  when 'piernas' then 'piernas'::public.muscle_group
  when 'hombros' then 'hombros'::public.muscle_group
  when 'bíceps' then 'bíceps'::public.muscle_group
  when 'tríceps' then 'tríceps'::public.muscle_group
  when 'abdomen' then 'abdomen'::public.muscle_group
  when 'cardio' then 'cardio'::public.muscle_group
  else null
end
where grupo_muscular_snapshot is null;

alter table public.workout_session_exercises
  drop column if exists grupo_muscular_snapshot_text;

-- Aseguramos updated_at (modelo cerrado lo pide)
alter table public.workout_session_exercises
  add column if not exists updated_at timestamptz not null default now();

-- Trigger updated_at
drop trigger if exists tr_workout_session_exercises_updated_at on public.workout_session_exercises;
create trigger tr_workout_session_exercises_updated_at
before update on public.workout_session_exercises
for each row
execute function public.set_updated_at();

create index if not exists idx_workout_session_exercises_session_created
on public.workout_session_exercises(workout_session_id, created_at asc);

create index if not exists idx_workout_session_exercises_exercise_created
on public.workout_session_exercises(exercise_id, created_at desc);

-- ==========================================================
-- workout_sets -> mínimo
-- ==========================================================

alter table public.workout_sets
  rename column weight_kg to weight;

alter table public.workout_sets
  drop column if exists user_id,
  drop column if exists rest_seconds,
  drop column if exists duration_seconds,
  drop column if exists distance_meters,
  drop column if exists speed_kmh,
  drop column if exists incline_percent,
  drop column if exists rpe,
  drop column if exists notes;

alter table public.workout_sets
  alter column weight type numeric(8,2);

-- ==========================================================
-- RLS rework (sin user_id en tablas de sesión)
-- ==========================================================

-- workout_sessions: ownership deriva por day_logs.user_id
drop policy if exists workout_sessions_select_own on public.workout_sessions;
create policy workout_sessions_select_own
on public.workout_sessions
for select
to authenticated
using (
  exists (
    select 1 from public.day_logs d
    where d.id = day_log_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_sessions_insert_own on public.workout_sessions;
create policy workout_sessions_insert_own
on public.workout_sessions
for insert
to authenticated
with check (
  exists (
    select 1 from public.day_logs d
    where d.id = day_log_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_sessions_update_own on public.workout_sessions;
create policy workout_sessions_update_own
on public.workout_sessions
for update
to authenticated
using (
  exists (
    select 1 from public.day_logs d
    where d.id = day_log_id and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.day_logs d
    where d.id = day_log_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_sessions_delete_own on public.workout_sessions;
create policy workout_sessions_delete_own
on public.workout_sessions
for delete
to authenticated
using (
  exists (
    select 1 from public.day_logs d
    where d.id = day_log_id and d.user_id = auth.uid()
  )
);

-- workout_session_exercises: ownership deriva por workout_session -> day_log
drop policy if exists workout_session_exercises_select_own on public.workout_session_exercises;
create policy workout_session_exercises_select_own
on public.workout_session_exercises
for select
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions s
    join public.day_logs d on d.id = s.day_log_id
    where s.id = workout_session_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_session_exercises_insert_own on public.workout_session_exercises;
create policy workout_session_exercises_insert_own
on public.workout_session_exercises
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workout_sessions s
    join public.day_logs d on d.id = s.day_log_id
    where s.id = workout_session_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_session_exercises_update_own on public.workout_session_exercises;
create policy workout_session_exercises_update_own
on public.workout_session_exercises
for update
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions s
    join public.day_logs d on d.id = s.day_log_id
    where s.id = workout_session_id and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_sessions s
    join public.day_logs d on d.id = s.day_log_id
    where s.id = workout_session_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_session_exercises_delete_own on public.workout_session_exercises;
create policy workout_session_exercises_delete_own
on public.workout_session_exercises
for delete
to authenticated
using (
  exists (
    select 1
    from public.workout_sessions s
    join public.day_logs d on d.id = s.day_log_id
    where s.id = workout_session_id and d.user_id = auth.uid()
  )
);

-- workout_sets: ownership deriva por workout_session_exercise -> session -> day_log
drop policy if exists workout_sets_select_own on public.workout_sets;
create policy workout_sets_select_own
on public.workout_sets
for select
to authenticated
using (
  exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.workout_session_id
    join public.day_logs d on d.id = s.day_log_id
    where se.id = workout_session_exercise_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own
on public.workout_sets
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.workout_session_id
    join public.day_logs d on d.id = s.day_log_id
    where se.id = workout_session_exercise_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own
on public.workout_sets
for update
to authenticated
using (
  exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.workout_session_id
    join public.day_logs d on d.id = s.day_log_id
    where se.id = workout_session_exercise_id and d.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.workout_session_id
    join public.day_logs d on d.id = s.day_log_id
    where se.id = workout_session_exercise_id and d.user_id = auth.uid()
  )
);

drop policy if exists workout_sets_delete_own on public.workout_sets;
create policy workout_sets_delete_own
on public.workout_sets
for delete
to authenticated
using (
  exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sessions s on s.id = se.workout_session_id
    join public.day_logs d on d.id = s.day_log_id
    where se.id = workout_session_exercise_id and d.user_id = auth.uid()
  )
);

commit;

