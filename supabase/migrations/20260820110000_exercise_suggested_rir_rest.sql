-- Defaults opcionales del catálogo. Se copian sólo al crear una configuración
-- de rutina o un ejercicio de sesión; luego cada snapshot queda independiente.
begin;

alter table public.exercises
  add column if not exists rir_sugerido smallint,
  add column if not exists descanso_min_sugerido_segundos integer,
  add column if not exists descanso_max_sugerido_segundos integer;

alter table public.exercises
  drop constraint if exists exercises_rir_sugerido_check,
  drop constraint if exists exercises_descanso_sugerido_check;

alter table public.exercises
  add constraint exercises_rir_sugerido_check
    check (rir_sugerido is null or rir_sugerido between 0 and 10),
  add constraint exercises_descanso_sugerido_check
    check (
      (descanso_min_sugerido_segundos is null and descanso_max_sugerido_segundos is null)
      or (
        descanso_min_sugerido_segundos between 0 and 3600
        and descanso_max_sugerido_segundos between 0 and 3600
        and descanso_min_sugerido_segundos <= descanso_max_sugerido_segundos
      )
    );

comment on column public.exercises.rir_sugerido is
  'Default opcional de catálogo; no es la fuente canónica de una rutina.';
comment on column public.exercises.descanso_min_sugerido_segundos is
  'Descanso mínimo sugerido al crear una configuración nueva.';
comment on column public.exercises.descanso_max_sugerido_segundos is
  'Descanso máximo sugerido al crear una configuración nueva.';

create or replace function public.routine_exercises_apply_exercise_defaults()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rest_min integer;
  v_rest_max integer;
begin
  if new.rest_min_seconds is null and new.rest_max_seconds is null then
    select
      e.descanso_min_sugerido_segundos,
      e.descanso_max_sugerido_segundos
    into v_rest_min, v_rest_max
    from public.exercises e
    where e.id = new.exercise_id;

    new.rest_min_seconds := v_rest_min;
    new.rest_max_seconds := v_rest_max;
  end if;
  return new;
end;
$$;

drop trigger if exists tr_routine_exercises_apply_exercise_defaults
on public.routine_exercises;
create trigger tr_routine_exercises_apply_exercise_defaults
before insert on public.routine_exercises
for each row execute function public.routine_exercises_apply_exercise_defaults();

create or replace function public.routine_exercises_create_default_sets()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_sets integer;
  v_reps integer;
  v_weight numeric;
  v_rir smallint;
begin
  select
    r.user_id,
    greatest(coalesce(e.series_sugeridas, 1), 1),
    e.reps_sugeridas,
    e.peso_sugerido,
    e.rir_sugerido
  into v_owner, v_sets, v_reps, v_weight, v_rir
  from public.routines r
  join public.exercises e on e.id = new.exercise_id
  where r.id = new.routine_id;

  insert into public.routine_exercise_sets (
    user_id,
    routine_exercise_id,
    set_number,
    target_reps,
    target_weight_kg,
    target_rir
  )
  select v_owner, new.id, generated, v_reps, v_weight, v_rir
  from generate_series(1, v_sets) generated
  on conflict (routine_exercise_id, set_number) do nothing;

  return new;
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

  perform 1
  from public.workout_sessions
  where id = p_session_id
    and user_id = v_user_id
    and status = 'in_progress'
  for update;

  if not found then
    raise exception 'La sesión no existe o ya finalizó';
  end if;

  if exists (
    select 1
    from public.workout_session_exercises
    where workout_session_id = p_session_id
      and exercise_id = p_exercise_id
  ) then
    raise exception 'Este ejercicio ya está agregado a la sesión';
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
    rest_min_seconds_snapshot,
    rest_max_seconds_snapshot,
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
    v_exercise.descanso_min_sugerido_segundos,
    v_exercise.descanso_max_sugerido_segundos,
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
    target_rir,
    actual_reps,
    actual_weight_kg
  )
  select
    v_user_id,
    v_session_exercise_id,
    generated,
    v_exercise.reps_sugeridas,
    v_exercise.peso_sugerido,
    v_exercise.rir_sugerido,
    v_exercise.reps_sugeridas,
    v_exercise.peso_sugerido
  from generate_series(1, v_sets) generated
  on conflict (workout_session_exercise_id, set_number) do update
  set target_reps = excluded.target_reps,
      target_weight_kg = excluded.target_weight_kg,
      target_rir = excluded.target_rir,
      actual_reps = excluded.actual_reps,
      actual_weight_kg = excluded.actual_weight_kg;

  return v_session_exercise_id;
end;
$$;

revoke all on function public.routine_exercises_apply_exercise_defaults()
from public, anon, authenticated;
revoke all on function public.routine_exercises_create_default_sets()
from public, anon, authenticated;
revoke all on function public.append_workout_exercise(uuid, uuid, text)
from public, anon;
grant execute on function public.append_workout_exercise(uuid, uuid, text)
to authenticated;

commit;
