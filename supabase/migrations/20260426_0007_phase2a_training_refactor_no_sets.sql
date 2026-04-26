-- Fase 2A (decisiones definitivas v2): entrenamiento sin sets + sesión rápida.
-- Cambios:
-- - exercises: renombre de campos a *_sugeridas / *_sugerido
-- - unicidad por usuario en nombre (case-insensitive + trim + colapsar espacios)
-- - workout_session_exercises: agrega series/reps/peso reales + completion + snapshots
--   y los inicializa automáticamente desde exercises al insertar.
-- - elimina workout_sets (no se usa)
begin;

-- ==========================================================
-- Helpers: normalización de nombre para unicidad
-- ==========================================================

create or replace function public.normalize_name(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '')
$$;

-- ==========================================================
-- exercises: campos sugeridos + unicidad robusta
-- ==========================================================

-- Renombres (si vienen de la migración 0006)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='series_recomendadas'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='series_sugeridas'
  ) then
    alter table public.exercises rename column series_recomendadas to series_sugeridas;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='reps_recomendadas'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='reps_sugeridas'
  ) then
    alter table public.exercises rename column reps_recomendadas to reps_sugeridas;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='peso_recomendado'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='exercises' and column_name='peso_sugerido'
  ) then
    alter table public.exercises rename column peso_recomendado to peso_sugerido;
  end if;
end $$;

-- Normalizamos valores existentes (nombre)
update public.exercises
set nombre = public.normalize_name(nombre)
where nombre is not null;

-- Reemplazar índice unique anterior por expresión normalizada
drop index if exists public.uniq_exercises_user_nombre_ci;
drop index if exists public.uniq_exercises_user_name_ci;
drop index if exists public.uniq_exercises_user_nombre_ci;

create unique index if not exists uniq_exercises_user_nombre_norm
on public.exercises(user_id, lower(public.normalize_name(nombre)));

-- Asegura que nombre no sea vacío post-normalización
alter table public.exercises
  drop constraint if exists exercises_nombre_not_blank,
  add constraint exercises_nombre_not_blank
  check (public.normalize_name(nombre) is not null);

-- Trigger para normalizar nombre en insert/update
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

-- ==========================================================
-- routines: unicidad robusta
-- ==========================================================

update public.routines
set nombre = public.normalize_name(nombre)
where nombre is not null;

drop index if exists public.uniq_routines_user_nombre_ci;
drop index if exists public.uniq_routines_user_name_ci;
drop index if exists public.uniq_routines_user_nombre_ci;

create unique index if not exists uniq_routines_user_nombre_norm
on public.routines(user_id, lower(public.normalize_name(nombre)));

alter table public.routines
  drop constraint if exists routines_nombre_not_blank,
  add constraint routines_nombre_not_blank
  check (public.normalize_name(nombre) is not null);

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

-- ==========================================================
-- workout_session_exercises: campos reales + completion
-- ==========================================================

alter table public.workout_session_exercises
  add column if not exists series_reales integer,
  add column if not exists reps_reales integer,
  add column if not exists peso_real numeric(8,2),
  add column if not exists is_completed boolean not null default false,
  add column if not exists completed_at timestamptz;

-- Backfill: si existen filas viejas, inicializamos reales con sugeridos del exercise si están null
update public.workout_session_exercises se
set
  series_reales = coalesce(se.series_reales, e.series_sugeridas),
  reps_reales = coalesce(se.reps_reales, e.reps_sugeridas),
  peso_real = coalesce(se.peso_real, e.peso_sugerido)
from public.exercises e
where e.id = se.exercise_id;

-- Trigger: al insertar en workout_session_exercises, setea snapshots + precarga reales
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

  if new.series_reales is null then
    new.series_reales := v_ex.series_sugeridas;
  end if;
  if new.reps_reales is null then
    new.reps_reales := v_ex.reps_sugeridas;
  end if;
  if new.peso_real is null then
    new.peso_real := v_ex.peso_sugerido;
  end if;

  -- completion bookkeeping
  if new.is_completed is true and new.completed_at is null then
    new.completed_at := now();
  end if;
  if new.is_completed is false then
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

-- Trigger: si se actualiza is_completed, mantenemos completed_at consistente
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

-- Checks simples (no negativos)
alter table public.workout_session_exercises
  drop constraint if exists workout_session_exercises_series_reales_check;
alter table public.workout_session_exercises
  add constraint workout_session_exercises_series_reales_check
  check (series_reales is null or series_reales >= 0);

alter table public.workout_session_exercises
  drop constraint if exists workout_session_exercises_reps_reales_check;
alter table public.workout_session_exercises
  add constraint workout_session_exercises_reps_reales_check
  check (reps_reales is null or reps_reales >= 0);

alter table public.workout_session_exercises
  drop constraint if exists workout_session_exercises_peso_real_check;
alter table public.workout_session_exercises
  add constraint workout_session_exercises_peso_real_check
  check (peso_real is null or peso_real >= 0);

-- ==========================================================
-- Eliminar workout_sets (ya no se usa)
-- ==========================================================

do $$
begin
  -- Si la tabla no existe (por ejemplo porque ya se eliminó en una reparación previa),
  -- no intentamos dropear policies/triggers asociados.
  if to_regclass('public.workout_sets') is not null then
    -- Dropear policies si existieran (por si quedaron de versiones anteriores)
    execute 'drop policy if exists workout_sets_select_own on public.workout_sets';
    execute 'drop policy if exists workout_sets_insert_own on public.workout_sets';
    execute 'drop policy if exists workout_sets_update_own on public.workout_sets';
    execute 'drop policy if exists workout_sets_delete_own on public.workout_sets';

    execute 'drop trigger if exists tr_workout_sets_owner on public.workout_sets';
    execute 'drop table if exists public.workout_sets';
  end if;

  -- Función puede existir aunque la tabla no exista.
  execute 'drop function if exists public.workout_sets_enforce_owner()';
end $$;

commit;

