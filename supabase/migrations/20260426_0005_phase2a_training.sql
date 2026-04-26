-- Fase 2A: entrenamiento (catálogo, rutinas, sesiones, sets, historial por ejercicio).
-- Reglas clave:
-- - Separación: ejercicios (catálogo) vs rutinas (plantillas) vs sesiones (ejecución del día).
-- - Sesiones pueden iniciarse desde rutina (copia) o libres.
-- - Borrar ejercicio de una sesión borra solo la ejecución (no el catálogo).
begin;

-- ==========================================================
-- Tables
-- ==========================================================

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text,
  exercise_type text not null check (exercise_type in ('strength', 'abs', 'cardio', 'mobility', 'other')),

  default_sets integer check (default_sets is null or (default_sets >= 0 and default_sets <= 50)),
  default_reps integer check (default_reps is null or (default_reps >= 0 and default_reps <= 1000)),
  default_rest_seconds integer check (default_rest_seconds is null or (default_rest_seconds >= 0 and default_rest_seconds <= 36000)),
  default_weight_kg numeric(8,2) check (default_weight_kg is null or (default_weight_kg >= 0 and default_weight_kg <= 9999.99)),

  notes text,
  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Evita duplicados obvios por usuario (case-insensitive) sin bloquear "variantes" a futuro.
create unique index if not exists uniq_exercises_user_name_ci
on public.exercises(user_id, lower(name));

create index if not exists idx_exercises_user_active on public.exercises(user_id, is_active);

create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  routine_type text not null check (routine_type in ('strength', 'abs', 'cardio', 'mixed')),
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_routines_user_name_ci
on public.routines(user_id, lower(name));

create index if not exists idx_routines_user_active on public.routines(user_id, is_active);

create table if not exists public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  exercise_order integer not null default 1 check (exercise_order >= 1 and exercise_order <= 10000),

  -- Defaults específicos de rutina (opcionales).
  default_sets integer check (default_sets is null or (default_sets >= 0 and default_sets <= 50)),
  default_reps integer check (default_reps is null or (default_reps >= 0 and default_reps <= 1000)),
  default_rest_seconds integer check (default_rest_seconds is null or (default_rest_seconds >= 0 and default_rest_seconds <= 36000)),
  default_weight_kg numeric(8,2) check (default_weight_kg is null or (default_weight_kg >= 0 and default_weight_kg <= 9999.99)),

  -- Cardio defaults (opcionales).
  default_duration_seconds integer check (default_duration_seconds is null or (default_duration_seconds >= 0 and default_duration_seconds <= 360000)),
  default_distance_meters numeric(10,2) check (default_distance_meters is null or (default_distance_meters >= 0 and default_distance_meters <= 1000000)),
  default_speed_kmh numeric(6,2) check (default_speed_kmh is null or (default_speed_kmh >= 0 and default_speed_kmh <= 100)),
  default_incline_percent numeric(5,2) check (default_incline_percent is null or (default_incline_percent >= 0 and default_incline_percent <= 100)),

  notes text,
  created_at timestamptz not null default now(),

  constraint routine_exercises_unique_order unique (routine_id, exercise_order)
);

create index if not exists idx_routine_exercises_routine_order
on public.routine_exercises(routine_id, exercise_order);

create index if not exists idx_routine_exercises_exercise
on public.routine_exercises(exercise_id);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_log_id uuid not null references public.day_logs(id) on delete cascade,
  base_routine_id uuid references public.routines(id) on delete set null,

  title text,
  session_order integer not null default 1 check (session_order >= 1 and session_order <= 10000),
  started_at timestamptz,
  ended_at timestamptz,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint workout_sessions_unique_order unique (day_log_id, session_order)
);

create index if not exists idx_workout_sessions_user_day
on public.workout_sessions(user_id, day_log_id);

create index if not exists idx_workout_sessions_day_order
on public.workout_sessions(day_log_id, session_order);

-- Sesión "activa": ended_at is null (útil para continuar)
create index if not exists idx_workout_sessions_active
on public.workout_sessions(user_id, created_at desc)
where ended_at is null;

create table if not exists public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_id uuid not null references public.workout_sessions(id) on delete cascade,
  routine_exercise_id uuid references public.routine_exercises(id) on delete set null,
  exercise_id uuid not null references public.exercises(id) on delete restrict,

  -- Snapshots para preservar historia y evitar acoplar a catálogo/rutina.
  exercise_name_snapshot text not null,
  category_snapshot text,
  exercise_type_snapshot text not null check (exercise_type_snapshot in ('strength', 'abs', 'cardio', 'mobility', 'other')),
  source_type text not null check (source_type in ('routine', 'extra', 'manual_new')),

  exercise_order integer not null default 1 check (exercise_order >= 1 and exercise_order <= 10000),
  notes text,
  created_at timestamptz not null default now(),

  constraint workout_session_exercises_unique_order unique (workout_session_id, exercise_order)
);

create index if not exists idx_workout_session_exercises_session_order
on public.workout_session_exercises(workout_session_id, exercise_order);

-- Para historial por ejercicio (joins vía session -> day_log)
create index if not exists idx_workout_session_exercises_exercise
on public.workout_session_exercises(exercise_id, created_at desc);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  workout_session_exercise_id uuid not null references public.workout_session_exercises(id) on delete cascade,
  set_number integer not null check (set_number >= 1 and set_number <= 1000),

  reps integer check (reps is null or (reps >= 0 and reps <= 10000)),
  weight_kg numeric(8,2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 9999.99)),
  rest_seconds integer check (rest_seconds is null or (rest_seconds >= 0 and rest_seconds <= 36000)),

  duration_seconds integer check (duration_seconds is null or (duration_seconds >= 0 and duration_seconds <= 360000)),
  distance_meters numeric(10,2) check (distance_meters is null or (distance_meters >= 0 and distance_meters <= 1000000)),
  speed_kmh numeric(6,2) check (speed_kmh is null or (speed_kmh >= 0 and speed_kmh <= 100)),
  incline_percent numeric(5,2) check (incline_percent is null or (incline_percent >= 0 and incline_percent <= 100)),
  rpe numeric(4,1) check (rpe is null or (rpe >= 0 and rpe <= 10)),

  notes text,
  created_at timestamptz not null default now(),

  constraint workout_sets_unique_number unique (workout_session_exercise_id, set_number)
);

create index if not exists idx_workout_sets_exercise_set_number
on public.workout_sets(workout_session_exercise_id, set_number);

-- ==========================================================
-- updated_at triggers (reusa public.set_updated_at de Fase 1)
-- ==========================================================

drop trigger if exists tr_exercises_updated_at on public.exercises;
create trigger tr_exercises_updated_at
before update on public.exercises
for each row
execute function public.set_updated_at();

drop trigger if exists tr_routines_updated_at on public.routines;
create trigger tr_routines_updated_at
before update on public.routines
for each row
execute function public.set_updated_at();

drop trigger if exists tr_workout_sessions_updated_at on public.workout_sessions;
create trigger tr_workout_sessions_updated_at
before update on public.workout_sessions
for each row
execute function public.set_updated_at();

-- ==========================================================
-- Integridad: ownership y coherencia usuario <-> day_log / rutina / ejercicio
-- ==========================================================

-- workout_sessions.user_id debe coincidir con day_logs.user_id
create or replace function public.workout_sessions_enforce_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.day_logs where id = new.day_log_id;
  if v_owner is null then
    raise exception 'day_log_id inválido';
  end if;
  if new.user_id <> v_owner then
    raise exception 'workout_sessions.user_id debe coincidir con day_logs.user_id';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_workout_sessions_owner on public.workout_sessions;
create trigger tr_workout_sessions_owner
before insert or update of user_id, day_log_id on public.workout_sessions
for each row
execute function public.workout_sessions_enforce_owner();

-- routine_exercises: el exercise debe pertenecer al mismo usuario que la rutina
create or replace function public.routine_exercises_enforce_owner()
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

drop trigger if exists tr_routine_exercises_owner on public.routine_exercises;
create trigger tr_routine_exercises_owner
before insert or update of routine_id, exercise_id on public.routine_exercises
for each row
execute function public.routine_exercises_enforce_owner();

-- workout_session_exercises.user_id debe coincidir con workout_sessions.user_id
-- y el exercise debe ser del mismo usuario. Si hay routine_exercise_id, debe pertenecer a la misma rutina base (si existe) o al mismo usuario.
create or replace function public.workout_session_exercises_enforce_owner()
returns trigger
language plpgsql
as $$
declare
  v_session_user uuid;
  v_exercise_user uuid;
  v_routine_exercise_user uuid;
begin
  select user_id into v_session_user from public.workout_sessions where id = new.workout_session_id;
  if v_session_user is null then
    raise exception 'workout_session_id inválido';
  end if;
  if new.user_id <> v_session_user then
    raise exception 'workout_session_exercises.user_id debe coincidir con workout_sessions.user_id';
  end if;

  select user_id into v_exercise_user from public.exercises where id = new.exercise_id;
  if v_exercise_user is null then
    raise exception 'exercise_id inválido';
  end if;
  if v_exercise_user <> v_session_user then
    raise exception 'workout_session_exercises debe referenciar exercise del mismo usuario';
  end if;

  if new.routine_exercise_id is not null then
    select r.user_id into v_routine_exercise_user
    from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = new.routine_exercise_id;

    if v_routine_exercise_user is null then
      raise exception 'routine_exercise_id inválido';
    end if;
    if v_routine_exercise_user <> v_session_user then
      raise exception 'routine_exercise_id debe pertenecer al mismo usuario';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists tr_workout_session_exercises_owner on public.workout_session_exercises;
create trigger tr_workout_session_exercises_owner
before insert or update of user_id, workout_session_id, exercise_id, routine_exercise_id on public.workout_session_exercises
for each row
execute function public.workout_session_exercises_enforce_owner();

-- workout_sets.user_id debe coincidir con workout_session_exercises.user_id
create or replace function public.workout_sets_enforce_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.workout_session_exercises where id = new.workout_session_exercise_id;
  if v_owner is null then
    raise exception 'workout_session_exercise_id inválido';
  end if;
  if new.user_id <> v_owner then
    raise exception 'workout_sets.user_id debe coincidir con workout_session_exercises.user_id';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_workout_sets_owner on public.workout_sets;
create trigger tr_workout_sets_owner
before insert or update of user_id, workout_session_exercise_id on public.workout_sets
for each row
execute function public.workout_sets_enforce_owner();

-- ==========================================================
-- RLS
-- ==========================================================

alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.routine_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_session_exercises enable row level security;
alter table public.workout_sets enable row level security;

-- exercises
drop policy if exists exercises_select_own on public.exercises;
create policy exercises_select_own
on public.exercises
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists exercises_insert_own on public.exercises;
create policy exercises_insert_own
on public.exercises
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists exercises_update_own on public.exercises;
create policy exercises_update_own
on public.exercises
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- routines
drop policy if exists routines_select_own on public.routines;
create policy routines_select_own
on public.routines
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists routines_insert_own on public.routines;
create policy routines_insert_own
on public.routines
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists routines_update_own on public.routines;
create policy routines_update_own
on public.routines
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- routine_exercises (deriva ownership desde routines)
drop policy if exists routine_exercises_select_own on public.routine_exercises;
create policy routine_exercises_select_own
on public.routine_exercises
for select
to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  )
);

drop policy if exists routine_exercises_insert_own on public.routine_exercises;
create policy routine_exercises_insert_own
on public.routine_exercises
for insert
to authenticated
with check (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  )
);

drop policy if exists routine_exercises_update_own on public.routine_exercises;
create policy routine_exercises_update_own
on public.routine_exercises
for update
to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  )
);

drop policy if exists routine_exercises_delete_own on public.routine_exercises;
create policy routine_exercises_delete_own
on public.routine_exercises
for delete
to authenticated
using (
  exists (
    select 1 from public.routines r
    where r.id = routine_id and r.user_id = auth.uid()
  )
);

-- workout_sessions
drop policy if exists workout_sessions_select_own on public.workout_sessions;
create policy workout_sessions_select_own
on public.workout_sessions
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists workout_sessions_insert_own on public.workout_sessions;
create policy workout_sessions_insert_own
on public.workout_sessions
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists workout_sessions_update_own on public.workout_sessions;
create policy workout_sessions_update_own
on public.workout_sessions
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists workout_sessions_delete_own on public.workout_sessions;
create policy workout_sessions_delete_own
on public.workout_sessions
for delete
to authenticated
using (user_id = auth.uid());

-- workout_session_exercises
drop policy if exists workout_session_exercises_select_own on public.workout_session_exercises;
create policy workout_session_exercises_select_own
on public.workout_session_exercises
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists workout_session_exercises_insert_own on public.workout_session_exercises;
create policy workout_session_exercises_insert_own
on public.workout_session_exercises
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists workout_session_exercises_update_own on public.workout_session_exercises;
create policy workout_session_exercises_update_own
on public.workout_session_exercises
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists workout_session_exercises_delete_own on public.workout_session_exercises;
create policy workout_session_exercises_delete_own
on public.workout_session_exercises
for delete
to authenticated
using (user_id = auth.uid());

-- workout_sets
drop policy if exists workout_sets_select_own on public.workout_sets;
create policy workout_sets_select_own
on public.workout_sets
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists workout_sets_insert_own on public.workout_sets;
create policy workout_sets_insert_own
on public.workout_sets
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists workout_sets_update_own on public.workout_sets;
create policy workout_sets_update_own
on public.workout_sets
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists workout_sets_delete_own on public.workout_sets;
create policy workout_sets_delete_own
on public.workout_sets
for delete
to authenticated
using (user_id = auth.uid());

-- Catálogo: no queremos hard delete desde app (se archiva con is_active).
revoke delete on public.exercises from authenticated;
revoke delete on public.routines from authenticated;

commit;

