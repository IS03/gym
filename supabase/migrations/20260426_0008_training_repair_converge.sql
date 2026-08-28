-- Reparación/convergencia de esquema de entrenamiento hacia la versión final (sin sets).
-- Objetivo: llevar la DB a un estado consistente aunque 0005/0006 se hayan aplicado parcialmente.
-- Estado final esperado:
-- - exercises: nombre, grupo_muscular, series_sugeridas, reps_sugeridas, peso_sugerido, is_active, timestamps + unicidad normalizada
-- - routines: nombre, is_active, timestamps + unicidad normalizada
-- - routine_exercises: (routine_id, exercise_id, created_at) sin orden manual
-- - workout_sessions: (day_log_id, routine_id, created_at, updated_at)
-- - workout_session_exercises: snapshots + reales + completion + timestamps
-- - NO workout_sets
begin;

-- ==========================================================
-- Types
-- ==========================================================
do $$
begin
  if not exists (select 1 from pg_type where typname = 'muscle_group') then
    create type public.muscle_group as enum (
      'pecho','espalda','piernas','hombros','bíceps','tríceps','abdomen','cardio'
    );
  end if;
end $$;

-- ==========================================================
-- Helpers: normalización de nombres (trim + colapsa espacios)
-- ==========================================================
create or replace function public.normalize_name(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '')
$$;

-- ==========================================================
-- exercises: asegurar columnas finales
-- ==========================================================

-- Renombrar name -> nombre si aplica
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='nombre'
  ) then
    alter table public.exercises rename column name to nombre;
  end if;
end $$;

-- Asegurar grupo_muscular
alter table public.exercises
  add column if not exists grupo_muscular public.muscle_group;

-- Renombrar columnas de sugeridos desde variantes previas
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='default_sets')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='series_sugeridas')
  then
    alter table public.exercises rename column default_sets to series_sugeridas;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='series_recomendadas')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='series_sugeridas')
  then
    alter table public.exercises rename column series_recomendadas to series_sugeridas;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='default_reps')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='reps_sugeridas')
  then
    alter table public.exercises rename column default_reps to reps_sugeridas;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='reps_recomendadas')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='reps_sugeridas')
  then
    alter table public.exercises rename column reps_recomendadas to reps_sugeridas;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='default_weight_kg')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='peso_sugerido')
  then
    alter table public.exercises rename column default_weight_kg to peso_sugerido;
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='peso_recomendado')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='peso_sugerido')
  then
    alter table public.exercises rename column peso_recomendado to peso_sugerido;
  end if;
end $$;

-- Normalizar nombre existente
update public.exercises
set nombre = public.normalize_name(nombre)
where nombre is not null;

-- Trigger normalización
create or replace function public.trg_exercises_normalize_nombre()
returns trigger
language plpgsql
as $$
begin
  new.nombre := public.normalize_name(new.nombre);
  return new;
end;
$$;

drop trigger if exists tr_exercises_normalize_nombre on public.exercises;
create trigger tr_exercises_normalize_nombre
before insert or update of nombre on public.exercises
for each row
execute function public.trg_exercises_normalize_nombre();

-- Unicidad robusta por usuario
drop index if exists public.uniq_exercises_user_name_ci;
drop index if exists public.uniq_exercises_user_nombre_ci;
drop index if exists public.uniq_exercises_user_nombre_norm;
create unique index if not exists uniq_exercises_user_nombre_norm
on public.exercises(user_id, lower(public.normalize_name(nombre)));

alter table public.exercises
  drop constraint if exists exercises_nombre_not_blank;
alter table public.exercises
  add constraint exercises_nombre_not_blank
  check (public.normalize_name(nombre) is not null);

-- ==========================================================
-- routines: asegurar nombre + unicidad robusta
-- ==========================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='routines' and column_name='name'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='routines' and column_name='nombre'
  ) then
    alter table public.routines rename column name to nombre;
  end if;
end $$;

update public.routines
set nombre = public.normalize_name(nombre)
where nombre is not null;

create or replace function public.trg_routines_normalize_nombre()
returns trigger
language plpgsql
as $$
begin
  new.nombre := public.normalize_name(new.nombre);
  return new;
end;
$$;

drop trigger if exists tr_routines_normalize_nombre on public.routines;
create trigger tr_routines_normalize_nombre
before insert or update of nombre on public.routines
for each row
execute function public.trg_routines_normalize_nombre();

drop index if exists public.uniq_routines_user_name_ci;
drop index if exists public.uniq_routines_user_nombre_ci;
drop index if exists public.uniq_routines_user_nombre_norm;
create unique index if not exists uniq_routines_user_nombre_norm
on public.routines(user_id, lower(public.normalize_name(nombre)));

alter table public.routines
  drop constraint if exists routines_nombre_not_blank;
alter table public.routines
  add constraint routines_nombre_not_blank
  check (public.normalize_name(nombre) is not null);

-- ==========================================================
-- routine_exercises: asegurar sin orden/manual/defaults
-- (si hay columnas extra, no las tocamos acá; la app solo usa routine_id/exercise_id/created_at)
-- ==========================================================
drop index if exists public.idx_routine_exercises_routine_order;
create index if not exists idx_routine_exercises_routine_created_at
on public.routine_exercises(routine_id, created_at asc);

-- ==========================================================
-- workout_sessions: asegurar routine_id (si venía como base_routine_id)
-- ==========================================================
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_sessions' and column_name='base_routine_id')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_sessions' and column_name='routine_id')
  then
    alter table public.workout_sessions rename column base_routine_id to routine_id;
  end if;
end $$;

-- ==========================================================
-- workout_session_exercises: converger nombres de snapshots + agregar reales/completion
-- ==========================================================
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_session_exercises' and column_name='exercise_name_snapshot')
     and not exists (select 1 from information_schema.columns where table_schema='public' and table_name='workout_session_exercises' and column_name='nombre_snapshot')
  then
    alter table public.workout_session_exercises rename column exercise_name_snapshot to nombre_snapshot;
  end if;
end $$;

-- grupo muscular snapshot: si existe como texto viejo, lo mantenemos; si no, asumimos columna enum ya existe o la creamos.
alter table public.workout_session_exercises
  add column if not exists grupo_muscular_snapshot public.muscle_group;

alter table public.workout_session_exercises
  add column if not exists series_reales integer,
  add column if not exists reps_reales integer,
  add column if not exists peso_real numeric(8,2),
  add column if not exists is_completed boolean not null default false,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

-- Trigger updated_at si set_updated_at existe
drop trigger if exists tr_workout_session_exercises_updated_at on public.workout_session_exercises;
create trigger tr_workout_session_exercises_updated_at
before update on public.workout_session_exercises
for each row
execute function public.set_updated_at();

-- Inicialización desde exercises (snapshots + reales)
create or replace function public.trg_workout_session_exercises_init()
returns trigger
language plpgsql
as $$
declare
  v_ex public.exercises;
begin
  select * into v_ex from public.exercises where id = new.exercise_id;
  if v_ex.id is null then
    raise exception 'exercise_id inválido';
  end if;

  if new.nombre_snapshot is null or new.nombre_snapshot = '' then
    new.nombre_snapshot := v_ex.nombre;
  end if;
  if new.grupo_muscular_snapshot is null then
    new.grupo_muscular_snapshot := v_ex.grupo_muscular;
  end if;

  if new.series_reales is null then new.series_reales := v_ex.series_sugeridas; end if;
  if new.reps_reales is null then new.reps_reales := v_ex.reps_sugeridas; end if;
  if new.peso_real is null then new.peso_real := v_ex.peso_sugerido; end if;

  if new.is_completed and new.completed_at is null then
    new.completed_at := now();
  end if;
  if not new.is_completed then
    new.completed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_workout_session_exercises_init on public.workout_session_exercises;
create trigger tr_workout_session_exercises_init
before insert on public.workout_session_exercises
for each row
execute function public.trg_workout_session_exercises_init();

create or replace function public.trg_workout_session_exercises_completion()
returns trigger
language plpgsql
as $$
begin
  if new.is_completed is distinct from old.is_completed then
    if new.is_completed then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_workout_session_exercises_completion on public.workout_session_exercises;
create trigger tr_workout_session_exercises_completion
before update of is_completed, completed_at on public.workout_session_exercises
for each row
execute function public.trg_workout_session_exercises_completion();

-- ==========================================================
-- Eliminar workout_sets (no se usa)
-- ==========================================================
drop table if exists public.workout_sets;

commit;

