begin;

-- The legacy bridge remains available for the old direct-update action, but
-- the robust RPC owns its workout_sets write and must not execute the bridge.
create or replace function public.workout_session_exercises_sync_legacy_sets()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_sets integer := greatest(coalesce(new.series_reales, 1), 1);
begin
  if current_setting('ownlevel.workout_save_mode', true) = 'robust' then
    return new;
  end if;

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

create or replace function public.save_workout_exercise(
  p_session_exercise_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '3s'
set statement_timeout = '8s'
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.workout_session_exercises;
  v_sets_count integer;
  v_updated_at timestamptz;
  v_decision text := coalesce(nullif(p_payload ->> 'decision', ''), 'maintain');
begin
  -- Validate before taking a row lock so invalid payloads never extend the
  -- critical section used by another save of this exercise.
  if v_decision not in ('maintain', 'increase_weight', 'increase_reps', 'custom') then
    raise exception 'La decisión para la próxima vez no es válida';
  end if;
  if v_decision = 'custom' and nullif(btrim(p_payload ->> 'decision_note'), '') is null then
    raise exception 'Escribí el recordatorio personalizado para la próxima vez';
  end if;
  if jsonb_typeof(p_payload -> 'sets') <> 'array' then
    raise exception 'sets debe ser un array';
  end if;
  v_sets_count := jsonb_array_length(p_payload -> 'sets');
  if v_sets_count < 1 or v_sets_count > 50 then
    raise exception 'La cantidad de series debe estar entre 1 y 50';
  end if;

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
    raise exception using errcode = '40001',
      message = 'El ejercicio cambió en otro dispositivo. Recargá antes de guardar.';
  end if;

  -- Suppress only the compatibility trigger in this transaction. Completion
  -- and updated_at triggers still run, and direct legacy updates still bridge.
  perform set_config('ownlevel.workout_save_mode', 'robust', true);

  update public.workout_session_exercises
  set
    planned_sets_count = v_sets_count,
    series_reales = v_sets_count,
    reps_reales = nullif(p_payload #>> '{sets,0,actual_reps}', '')::integer,
    peso_real = nullif(p_payload #>> '{sets,0,actual_weight_kg}', '')::numeric,
    is_completed = coalesce((p_payload ->> 'is_completed')::boolean, false),
    decision = v_decision,
    decision_note = case
      when v_decision = 'custom' then nullif(btrim(p_payload ->> 'decision_note'), '')
      else null
    end,
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
    user_id, workout_session_exercise_id, set_number,
    target_reps, target_weight_kg, target_rir,
    actual_reps, actual_weight_kg, is_completed, notes
  )
  select
    v_user_id, p_session_exercise_id, item.set_number,
    item.target_reps, item.target_weight_kg, item.target_rir,
    item.actual_reps, item.actual_weight_kg, coalesce(item.is_completed, false),
    nullif(item.notes, '')
  from jsonb_to_recordset(p_payload -> 'sets') as item(
    set_number integer,
    target_reps integer,
    target_weight_kg numeric,
    target_rir smallint,
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
    select 1 from (
      select min(set_number) as first_number, max(set_number) as last_number,
        count(*)::integer as total
      from public.workout_sets
      where workout_session_exercise_id = p_session_exercise_id
    ) numbered
    where numbered.first_number <> 1 or numbered.last_number <> numbered.total
  ) then
    raise exception 'Las series deben estar numeradas en orden desde 1';
  end if;

  return v_updated_at;
end;
$$;

revoke all on function public.save_workout_exercise(uuid, timestamptz, jsonb)
from public, anon;
grant execute on function public.save_workout_exercise(uuid, timestamptz, jsonb)
to authenticated;

commit;
