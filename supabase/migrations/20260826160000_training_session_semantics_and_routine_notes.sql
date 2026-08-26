-- PR 13: preserve the routine note captured at session start and propagate
-- only explicit note edits during a successful atomic finalization.

begin;

alter table public.workout_session_exercises
  add column if not exists routine_note_snapshot text;

comment on column public.workout_session_exercises.routine_note_snapshot is
  'Immutable routine_exercises.notes value captured when a routine session starts; null for legacy and non-routine exercises.';

create function public.prevent_routine_note_snapshot_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.routine_note_snapshot is distinct from old.routine_note_snapshot then
    raise exception 'routine_note_snapshot es inmutable';
  end if;
  return new;
end;
$$;

create trigger tr_workout_session_exercises_immutable_routine_note_snapshot
before update of routine_note_snapshot on public.workout_session_exercises
for each row execute function public.prevent_routine_note_snapshot_update();

revoke all on function public.prevent_routine_note_snapshot_update()
from public, anon, authenticated;

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
    select 1 from public.day_logs where id = p_day_log_id and user_id = v_user_id
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
    where id = p_routine_id and user_id = v_user_id and is_active;
    if v_routine_name is null then
      raise exception 'Rutina inválida o archivada';
    end if;
  end if;

  insert into public.workout_sessions (
    user_id, day_log_id, routine_id, routine_name_snapshot, session_name, status, started_at
  ) values (
    v_user_id, p_day_log_id, p_routine_id, v_routine_name,
    coalesce(v_routine_name, 'Sesión libre'), 'in_progress', now()
  ) returning id into v_session_id;

  if p_routine_id is not null then
    insert into public.workout_session_exercises (
      user_id, workout_session_id, routine_exercise_id, exercise_id,
      nombre_snapshot, grupo_muscular_snapshot, muscle_group_label_snapshot,
      implement_snapshot, weight_mode_snapshot,
      rest_min_seconds_snapshot, rest_max_seconds_snapshot,
      source_type, exercise_order, planned_sets_count,
      next_adjustment_snapshot, next_adjustment_note_snapshot,
      decision, decision_note, routine_note_snapshot, notes
    )
    select
      v_user_id, v_session_id, re.id, e.id,
      e.nombre, e.grupo_muscular, e.muscle_group_label,
      e.implement, e.weight_mode,
      re.rest_min_seconds, re.rest_max_seconds,
      'routine', re.exercise_order,
      greatest(coalesce(nullif(count(res.id), 0), e.series_sugeridas, 1), 1)::integer,
      re.next_adjustment, re.next_adjustment_note,
      'maintain', null, re.notes, re.notes
    from public.routine_exercises re
    join public.exercises e on e.id = re.exercise_id
    left join public.routine_exercise_sets res on res.routine_exercise_id = re.id
    where re.routine_id = p_routine_id
    group by re.id, e.id
    order by re.exercise_order;

    insert into public.workout_sets (
      user_id, workout_session_exercise_id, set_number,
      target_reps, target_weight_kg, target_rir,
      actual_reps, actual_weight_kg
    )
    select
      v_user_id, se.id, generated.set_number,
      coalesce(res.target_reps, e.reps_sugeridas),
      coalesce(res.target_weight_kg, e.peso_sugerido),
      res.target_rir,
      coalesce(res.target_reps, e.reps_sugeridas),
      coalesce(res.target_weight_kg, e.peso_sugerido)
    from public.workout_session_exercises se
    join public.exercises e on e.id = se.exercise_id
    cross join lateral generate_series(1, se.planned_sets_count) as generated(set_number)
    left join public.routine_exercise_sets res
      on res.routine_exercise_id = se.routine_exercise_id
      and res.set_number = generated.set_number
    where se.workout_session_id = v_session_id
    on conflict (workout_session_exercise_id, set_number) do update
    set
      target_reps = excluded.target_reps,
      target_weight_kg = excluded.target_weight_kg,
      target_rir = excluded.target_rir,
      actual_reps = excluded.actual_reps,
      actual_weight_kg = excluded.actual_weight_kg;
  end if;

  return v_session_id;
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
  where id = p_session_id and user_id = v_user_id and status = 'in_progress'
  for update;
  if v_session.id is null then
    raise exception 'La sesión no existe o ya finalizó';
  end if;
  if not exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sets ws on ws.workout_session_exercise_id = se.id
    where se.workout_session_id = p_session_id and se.is_completed and ws.is_completed
  ) then
    raise exception 'Marcá y guardá al menos una serie antes de finalizar';
  end if;

  -- The decision replaces the one-time reminder only after all exercise saves
  -- have crossed the client finalization fence.
  update public.routine_exercises re
  set
    next_adjustment = se.decision,
    next_adjustment_note = case
      when se.decision = 'custom' then nullif(btrim(se.decision_note), '')
      else null
    end
  from public.workout_session_exercises se
  where se.workout_session_id = p_session_id
    and se.routine_exercise_id = re.id;

  -- An explicit session note edit wins at successful finish. An unchanged
  -- snapshot never rewrites a concurrently edited routine note.
  update public.routine_exercises re
  set notes = se.notes
  from public.workout_session_exercises se
  where se.workout_session_id = p_session_id
    and se.routine_exercise_id = re.id
    and se.routine_note_snapshot is not null
    and se.notes is distinct from se.routine_note_snapshot;

  -- Numeric targets remain independent from both decisions and notes, and use
  -- only sets explicitly completed in this session.
  for v_exercise in
    select * from public.workout_session_exercises
    where workout_session_id = p_session_id
      and apply_to_routine
      and routine_exercise_id is not null
  loop
    if exists (
      select 1 from public.workout_sets ws
      where ws.workout_session_exercise_id = v_exercise.id and ws.is_completed
    ) then
      delete from public.routine_exercise_sets
      where routine_exercise_id = v_exercise.routine_exercise_id;
      insert into public.routine_exercise_sets (
        user_id, routine_exercise_id, set_number,
        target_reps, target_weight_kg, target_rir, notes
      )
      select
        v_user_id, v_exercise.routine_exercise_id,
        row_number() over (order by ws.set_number)::integer,
        coalesce(ws.actual_reps, ws.target_reps),
        coalesce(ws.actual_weight_kg, ws.target_weight_kg),
        ws.target_rir,
        ws.notes
      from public.workout_sets ws
      where ws.workout_session_exercise_id = v_exercise.id and ws.is_completed;
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
    treadmill_incline_percent = nullif(p_metadata ->> 'treadmill_incline_percent', '')::numeric,
    notes = nullif(p_metadata ->> 'notes', ''),
    status = 'completed',
    ended_at = now()
  where id = p_session_id;
  return p_session_id;
end;
$$;

revoke all on function public.start_workout_session(uuid, uuid) from public, anon;
revoke all on function public.finish_workout_session(uuid, jsonb) from public, anon;
grant execute on function public.start_workout_session(uuid, uuid) to authenticated;
grant execute on function public.finish_workout_session(uuid, jsonb) to authenticated;

commit;
