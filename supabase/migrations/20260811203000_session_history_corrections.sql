-- Historial de sesiones: descarte lógico y corrección histórica restringida.
-- No reabre sesiones, no modifica snapshots y no ejecuta progresión.

alter type public.workout_session_status add value if not exists 'discarded';

comment on column public.workout_sessions.status is
  'in_progress: entrenamiento activo; completed: finalizada y visible; discarded: eliminada lógicamente del historial.';

create or replace function public.correct_completed_workout_session(
  p_session_id uuid,
  p_expected_session_updated_at timestamptz,
  p_payload jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.workout_sessions;
  v_exercise public.workout_session_exercises;
  v_exercise_item jsonb;
  v_set_item jsonb;
  v_set public.workout_sets;
  v_metadata jsonb;
  v_expected_exercise_updated_at timestamptz;
  v_actual_reps integer;
  v_actual_weight numeric;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if jsonb_typeof(p_payload) <> 'object'
    or jsonb_typeof(p_payload -> 'metadata') <> 'object'
    or jsonb_typeof(p_payload -> 'exercises') <> 'array' then
    raise exception 'La corrección no tiene un formato válido';
  end if;

  select * into v_session
  from public.workout_sessions
  where id = p_session_id
    and user_id = v_user_id
    and status = 'completed'
  for update;

  if v_session.id is null then
    raise exception 'La sesión no existe, no te pertenece o ya no puede corregirse';
  end if;
  if v_session.updated_at is distinct from p_expected_session_updated_at then
    raise exception using
      errcode = '40001',
      message = 'La sesión cambió en otro dispositivo. Recargá antes de guardar.';
  end if;

  v_metadata := p_payload -> 'metadata';
  if exists (
    select 1
    from unnest(array[
      v_metadata -> 'energy_level',
      v_metadata -> 'performance_level',
      v_metadata -> 'pain_level',
      v_metadata -> 'treadmill_minutes',
      v_metadata -> 'treadmill_distance_km',
      v_metadata -> 'treadmill_speed_kmh',
      v_metadata -> 'treadmill_incline_percent'
    ]) as numeric_value(value)
    where value is not null and jsonb_typeof(value) not in ('number', 'null')
  ) then
    raise exception 'Los datos numéricos de la corrección no son válidos';
  end if;
  if (v_metadata ->> 'energy_level') is not null
    and ((v_metadata ->> 'energy_level')::numeric <> trunc((v_metadata ->> 'energy_level')::numeric)) then
    raise exception 'Energía debe ser un número entero';
  end if;
  if (v_metadata ->> 'performance_level') is not null
    and ((v_metadata ->> 'performance_level')::numeric <> trunc((v_metadata ->> 'performance_level')::numeric)) then
    raise exception 'Rendimiento debe ser un número entero';
  end if;
  if (v_metadata ->> 'pain_level') is not null
    and ((v_metadata ->> 'pain_level')::numeric <> trunc((v_metadata ->> 'pain_level')::numeric)) then
    raise exception 'Dolor debe ser un número entero';
  end if;

  -- Sólo los campos descriptivos del resumen. Fecha, horas, estado, rutina y nombre no se tocan.
  update public.workout_sessions
  set
    energy_level = nullif(v_metadata ->> 'energy_level', '')::smallint,
    performance_level = nullif(v_metadata ->> 'performance_level', '')::smallint,
    pain_level = nullif(v_metadata ->> 'pain_level', '')::smallint,
    pain_note = nullif(v_metadata ->> 'pain_note', ''),
    treadmill_minutes = nullif(v_metadata ->> 'treadmill_minutes', '')::numeric,
    treadmill_distance_km = nullif(v_metadata ->> 'treadmill_distance_km', '')::numeric,
    treadmill_speed_kmh = nullif(v_metadata ->> 'treadmill_speed_kmh', '')::numeric,
    treadmill_incline_percent = nullif(v_metadata ->> 'treadmill_incline_percent', '')::numeric,
    notes = nullif(v_metadata ->> 'notes', '')
  where id = p_session_id;

  for v_exercise_item in select value from jsonb_array_elements(p_payload -> 'exercises')
  loop
    if jsonb_typeof(v_exercise_item) <> 'object'
      or jsonb_typeof(v_exercise_item -> 'sets') <> 'array'
      or nullif(v_exercise_item ->> 'id', '') is null
      or nullif(v_exercise_item ->> 'expected_updated_at', '') is null then
      raise exception 'Uno de los ejercicios a corregir no es válido';
    end if;
    begin
      v_expected_exercise_updated_at := (v_exercise_item ->> 'expected_updated_at')::timestamptz;
    exception when others then
      raise exception 'La versión del ejercicio a corregir no es válida';
    end;

    select * into v_exercise
    from public.workout_session_exercises
    where id = (v_exercise_item ->> 'id')::uuid
      and workout_session_id = p_session_id
      and user_id = v_user_id
    for update;
    if v_exercise.id is null then
      raise exception 'El ejercicio no pertenece a esta sesión';
    end if;
    if v_exercise.updated_at is distinct from v_expected_exercise_updated_at then
      raise exception using
        errcode = '40001',
        message = 'Un ejercicio cambió en otro dispositivo. Recargá antes de guardar.';
    end if;
    if jsonb_array_length(v_exercise_item -> 'sets') <> (
      select count(*) from public.workout_sets
      where workout_session_exercise_id = v_exercise.id and user_id = v_user_id
    ) then
      raise exception 'No se pueden agregar ni quitar series históricas';
    end if;

    update public.workout_session_exercises
    set notes = nullif(v_exercise_item ->> 'notes', '')
    where id = v_exercise.id;

    for v_set_item in select value from jsonb_array_elements(v_exercise_item -> 'sets')
    loop
      if jsonb_typeof(v_set_item) <> 'object'
        or nullif(v_set_item ->> 'id', '') is null
        or ((v_set_item -> 'actual_reps') is not null and jsonb_typeof(v_set_item -> 'actual_reps') not in ('number', 'null'))
        or ((v_set_item -> 'actual_weight_kg') is not null and jsonb_typeof(v_set_item -> 'actual_weight_kg') not in ('number', 'null')) then
        raise exception 'Una serie a corregir no es válida';
      end if;

      if (v_set_item ->> 'actual_reps') is not null
        and ((v_set_item ->> 'actual_reps')::numeric <> trunc((v_set_item ->> 'actual_reps')::numeric)) then
        raise exception 'Las repeticiones realizadas deben ser un número entero';
      end if;
      v_actual_reps := nullif(v_set_item ->> 'actual_reps', '')::integer;
      v_actual_weight := nullif(v_set_item ->> 'actual_weight_kg', '')::numeric;
      if v_actual_reps is not null and (v_actual_reps < 0 or v_actual_reps > 1000) then
        raise exception 'Las repeticiones realizadas deben estar entre 0 y 1000';
      end if;
      if v_actual_weight is not null and (v_actual_weight < 0 or v_actual_weight > 9999.99) then
        raise exception 'El peso realizado debe estar entre 0 y 9999.99';
      end if;

      select * into v_set
      from public.workout_sets
      where id = (v_set_item ->> 'id')::uuid
        and workout_session_exercise_id = v_exercise.id
        and user_id = v_user_id
      for update;
      if v_set.id is null then
        raise exception 'La serie no pertenece a este ejercicio histórico';
      end if;

      update public.workout_sets
      set
        actual_reps = v_actual_reps,
        actual_weight_kg = v_actual_weight,
        notes = nullif(v_set_item ->> 'notes', '')
      where id = v_set.id;
    end loop;
  end loop;

  return p_session_id;
end;
$$;

create or replace function public.discard_completed_workout_session(p_session_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.workout_sessions;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  select * into v_session
  from public.workout_sessions
  where id = p_session_id
    and user_id = v_user_id
    and status = 'completed'
  for update;
  if v_session.id is null then
    raise exception 'La sesión no existe, no te pertenece o ya fue eliminada';
  end if;

  update public.workout_sessions
  set status = 'discarded'
  where id = p_session_id;

  return p_session_id;
end;
$$;

revoke all on function public.correct_completed_workout_session(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.discard_completed_workout_session(uuid) from public, anon;
grant execute on function public.correct_completed_workout_session(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.discard_completed_workout_session(uuid) to authenticated;
