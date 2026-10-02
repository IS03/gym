-- Minimal, disposable Training schema for the local PostgreSQL test runner.
-- Not a production migration. Production functions/triggers are loaded from
-- their actual migrations by the runner; no mock implementations of RPCs.
create role anon;
create role authenticated;
create schema auth;
create schema extensions;
create extension pgcrypto with schema extensions;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
create table auth.users (id uuid primary key, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz, raw_app_meta_data jsonb,
  raw_user_meta_data jsonb, created_at timestamptz, updated_at timestamptz);
create type public.muscle_group as enum ('pecho','espalda','piernas','hombros','bíceps','tríceps','abdomen','cardio');
create table public.day_logs (id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id), log_date date not null, unique(user_id,log_date));
create table public.exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  nombre text not null, grupo_muscular public.muscle_group, muscle_group_label text,
  implement text, weight_mode text, series_sugeridas integer, reps_sugeridas integer,
  peso_sugerido numeric(8,2), rir_sugerido smallint, descanso_min_sugerido_segundos integer,
  descanso_max_sugerido_segundos integer, notes text, is_active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now(), unique(user_id,nombre)
);
create table public.routines (id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id), nombre text, is_active boolean default true);
create table public.routine_exercises (id uuid primary key default gen_random_uuid(),
  routine_id uuid references public.routines(id), exercise_id uuid references public.exercises(id),
  exercise_order integer, next_adjustment text default 'maintain', next_adjustment_note text,
  rest_min_seconds integer, rest_max_seconds integer, notes text);
create table public.routine_exercise_sets (id uuid primary key default gen_random_uuid(),
  user_id uuid, routine_exercise_id uuid references public.routine_exercises(id) on delete cascade,
  set_number integer, target_reps integer, target_weight_kg numeric(8,2), target_rir smallint, notes text);
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  day_log_id uuid references public.day_logs(id), routine_id uuid references public.routines(id),
  routine_name_snapshot text, session_name text, status text not null default 'in_progress'
    check(status in ('in_progress','completed','discarded')),
  started_at timestamptz default now(), ended_at timestamptz,
  energy_level smallint, performance_level smallint, pain_level smallint, pain_note text,
  abs_completed boolean default false, treadmill_minutes numeric, treadmill_distance_km numeric,
  treadmill_speed_kmh numeric, treadmill_incline_percent numeric, notes text,
  updated_at timestamptz default now(), created_at timestamptz default now()
);
create unique index uniq_workout_sessions_user_in_progress on public.workout_sessions(user_id) where status='in_progress';
create table public.workout_session_exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  workout_session_id uuid references public.workout_sessions(id) on delete cascade,
  routine_exercise_id uuid references public.routine_exercises(id), exercise_id uuid references public.exercises(id),
  exercise_order integer check(exercise_order between 1 and 10000), source_type text default 'extra',
  nombre_snapshot text not null, grupo_muscular_snapshot public.muscle_group,
  muscle_group_label_snapshot text, implement_snapshot text, weight_mode_snapshot text,
  rest_min_seconds_snapshot integer, rest_max_seconds_snapshot integer,
  planned_sets_count integer default 1 check(planned_sets_count between 1 and 50),
  next_adjustment_snapshot text default 'maintain', next_adjustment_note_snapshot text,
  decision text default 'maintain', decision_note text, apply_to_routine boolean default false,
  routine_note_snapshot text, notes text, series_reales integer, reps_reales integer, peso_real numeric(8,2),
  is_completed boolean default false, completed_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(workout_session_id,exercise_order) deferrable initially deferred
);
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id),
  workout_session_exercise_id uuid references public.workout_session_exercises(id) on delete cascade,
  set_number integer check(set_number between 1 and 50), target_reps integer,
  target_weight_kg numeric(8,2), target_rir smallint, actual_reps integer,
  actual_weight_kg numeric(8,2), is_completed boolean default false, completed_at timestamptz,
  notes text, created_at timestamptz default now(), updated_at timestamptz default now(),
  unique(workout_session_exercise_id,set_number)
);
grant usage on schema public, auth, extensions to authenticated;
grant execute on function auth.uid() to authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
-- Policies match the Training rebuild's direct-owner RLS. The ledger is loaded
-- afterward from its actual migration, with no grants or client policies.
do $$
declare t text;
begin
  foreach t in array array['day_logs','exercises','routines','workout_sessions','workout_session_exercises','workout_sets'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('create policy owner on public.%I to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()))',t);
  end loop;
end;
$$;
