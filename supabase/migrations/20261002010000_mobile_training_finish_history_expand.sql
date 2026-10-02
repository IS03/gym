-- M3.4-1: idempotent Mobile wrappers for finish, historical correction and
-- discard of a completed session. EXPAND only: no tables, columns or backfill.
-- Domain effects stay in the existing Web RPCs (finish_workout_session,
-- correct_completed_workout_session, discard_completed_workout_session).
-- Wrappers add: the shared user lock (user -> ledger -> session -> exercise
-- -> sets), the private ledger, stable error codes and an exact stored replay.
begin;

create or replace function public.mobile_finish_training_session(
  p_session_id uuid,
  p_metadata jsonb,
  p_idempotency_key text
)
returns table (response_status smallint, response_body jsonb, replayed boolean)
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
set statement_timeout = '8s'
as $$
declare
  v_user_id uuid;
  v_operation constant text := 'training.session.finish.v1';
  v_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_response jsonb;
begin
  v_user_id := public.lock_training_user_mutations();
  -- Active Web finish exposes exactly these fields. Absent pain_note/treadmill
  -- remain null and session_name is preserved, as with the Web finish.
  if p_session_id is null or p_metadata is null or jsonb_typeof(p_metadata) <> 'object'
    or exists (select 1 from jsonb_object_keys(p_metadata) as supplied(key)
      where key not in ('energy_level', 'performance_level', 'pain_level', 'notes'))
    or (select count(*) from jsonb_object_keys(p_metadata)) <> 4
    or jsonb_typeof(p_metadata -> 'energy_level') not in ('number', 'null')
    or jsonb_typeof(p_metadata -> 'performance_level') not in ('number', 'null')
    or jsonb_typeof(p_metadata -> 'pain_level') not in ('number', 'null')
    or jsonb_typeof(p_metadata -> 'notes') not in ('string', 'null')
    or exists (select 1 from unnest(array['energy_level', 'performance_level', 'pain_level']) as field(name)
      where jsonb_typeof(p_metadata -> name) = 'number'
        and (p_metadata ->> name)::numeric <> trunc((p_metadata ->> name)::numeric))
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'El resumen enviado no es válido.';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'sessionId', p_session_id, 'metadata', p_metadata
  )::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.mobile_idempotency_keys (user_id, operation, idempotency_key, request_hash, expires_at)
  values (v_user_id, v_operation, p_idempotency_key, v_hash, now() + interval '30 days')
  on conflict (user_id, operation, idempotency_key) do nothing;
  select * into v_ledger from public.mobile_idempotency_keys
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key for update;
  if v_ledger.request_hash <> v_hash then
    raise exception using errcode = 'PT409', message = 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if v_ledger.state = 'completed' then
    return query select v_ledger.response_status, v_ledger.response_body, true;
    return;
  end if;

  -- NOT_FOUND (also foreign) or SESSION_CLOSED, under the session row lock.
  perform public.lock_active_workout_session(p_session_id);
  -- Same rule the domain enforces, surfaced as a stable code.
  if not exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sets ws on ws.workout_session_exercise_id = se.id
    where se.workout_session_id = p_session_id and se.user_id = v_user_id
      and se.is_completed and ws.is_completed
  ) then
    raise exception using errcode = 'P0001', message = 'NO_COMPLETED_SETS';
  end if;

  -- Exactly one execution of routine progression/notes/apply_to_routine.
  perform public.finish_workout_session(p_session_id, p_metadata);

  select jsonb_build_object(
    'status', 'finished',
    'sessionId', ws.id,
    'sessionStatus', ws.status,
    'name', coalesce(ws.session_name, ws.routine_name_snapshot, 'Sesión libre'),
    'routineId', ws.routine_id,
    'logDate', dl.log_date,
    'startedAt', ws.started_at,
    'endedAt', ws.ended_at,
    'sessionUpdatedAt', ws.updated_at,
    'metadata', jsonb_build_object(
      'energyLevel', ws.energy_level,
      'performanceLevel', ws.performance_level,
      'painLevel', ws.pain_level,
      'notes', ws.notes
    ),
    'exerciseCount', (select count(*) from public.workout_session_exercises se
      where se.workout_session_id = ws.id and se.user_id = v_user_id),
    'completedExerciseCount', (select count(*) from public.workout_session_exercises se
      where se.workout_session_id = ws.id and se.user_id = v_user_id and se.is_completed),
    'completedSetCount', (select count(*) from public.workout_session_exercises se
      join public.workout_sets s on s.workout_session_exercise_id = se.id
      where se.workout_session_id = ws.id and se.user_id = v_user_id and s.is_completed)
  ) into v_response
  from public.workout_sessions ws
  join public.day_logs dl on dl.id = ws.day_log_id
  where ws.id = p_session_id and ws.user_id = v_user_id and ws.status = 'completed';
  if v_response is null then
    raise exception 'Finished session read-back failed';
  end if;

  update public.mobile_idempotency_keys
  set state = 'completed', response_status = 200, response_body = v_response,
    resource_type = 'workout_session', resource_id = p_session_id, completed_at = now()
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key;
  return query select 200::smallint, v_response, false;
end;
$$;

-- Locks a COMPLETED session (user lock first) and maps other states to
-- stable codes. Foreign and missing sessions share NOT_FOUND.
create or replace function public.lock_completed_workout_session(p_session_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status text;
  v_version timestamptz;
begin
  v_user_id := public.lock_training_user_mutations();
  select status::text, updated_at into v_status, v_version from public.workout_sessions
  where id = p_session_id and user_id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_SESSION_NOT_FOUND';
  end if;
  if v_status = 'discarded' then
    raise exception using errcode = 'P0001', message = 'SESSION_DISCARDED';
  end if;
  if v_status <> 'completed' then
    raise exception using errcode = 'P0001', message = 'SESSION_NOT_COMPLETED';
  end if;
  return v_version;
end;
$$;

create or replace function public.mobile_correct_completed_session(
  p_session_id uuid,
  p_expected_session_updated_at timestamptz,
  p_payload jsonb,
  p_idempotency_key text
)
returns table (response_status smallint, response_body jsonb, replayed boolean)
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
set statement_timeout = '8s'
as $$
declare
  v_user_id uuid;
  v_operation constant text := 'training.session.correction.v1';
  v_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_version timestamptz;
  v_item jsonb;
  v_exercise public.workout_session_exercises%rowtype;
  v_domain_exercises jsonb := '[]'::jsonb;
  v_domain_sets jsonb;
  v_response jsonb;
begin
  v_user_id := public.lock_training_user_mutations();
  -- Shape only; numeric ranges/integers stay in the domain RPC and table checks.
  if p_session_id is null or p_expected_session_updated_at is null
    or p_payload is null or jsonb_typeof(p_payload) <> 'object'
    or exists (select 1 from jsonb_object_keys(p_payload) as supplied(key) where key not in ('metadata', 'exercises'))
    or jsonb_typeof(p_payload -> 'metadata') is distinct from 'object'
    or jsonb_typeof(p_payload -> 'exercises') is distinct from 'array'
    or jsonb_array_length(p_payload -> 'exercises') > 200
    or (select count(*) from jsonb_object_keys(p_payload -> 'metadata')) <> 9
    or exists (select 1 from jsonb_object_keys(p_payload -> 'metadata') as supplied(key)
      where key not in ('energy_level', 'performance_level', 'pain_level', 'pain_note',
        'treadmill_minutes', 'treadmill_distance_km', 'treadmill_speed_kmh', 'treadmill_incline_percent', 'notes'))
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'La corrección no tiene un formato válido.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_payload -> 'exercises') as supplied(item)
    where jsonb_typeof(item) <> 'object'
      or exists (select 1 from jsonb_object_keys(item) as k(key)
        where key not in ('session_exercise_id', 'expected_updated_at', 'notes', 'sets'))
      or nullif(item ->> 'session_exercise_id', '') is null
      or nullif(item ->> 'expected_updated_at', '') is null
      or jsonb_typeof(item -> 'notes') not in ('string', 'null')
      or jsonb_typeof(item -> 'sets') is distinct from 'array'
      or exists (select 1 from jsonb_array_elements(item -> 'sets') as s(value)
        where jsonb_typeof(value) <> 'object'
          or exists (select 1 from jsonb_object_keys(value) as k(key)
            where key not in ('set_number', 'actual_reps', 'actual_weight_kg', 'notes'))
          or jsonb_typeof(value -> 'set_number') is distinct from 'number'
          or jsonb_typeof(value -> 'actual_reps') not in ('number', 'null')
          or jsonb_typeof(value -> 'actual_weight_kg') not in ('number', 'null')
          or jsonb_typeof(value -> 'notes') not in ('string', 'null'))
  ) or (
    select count(*) <> count(distinct item ->> 'session_exercise_id')
    from jsonb_array_elements(p_payload -> 'exercises') as supplied(item)
  ) then
    raise exception using errcode = '22023', message = 'Uno de los ejercicios a corregir no es válido.';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'sessionId', p_session_id, 'expectedSessionUpdatedAt', p_expected_session_updated_at, 'payload', p_payload
  )::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.mobile_idempotency_keys (user_id, operation, idempotency_key, request_hash, expires_at)
  values (v_user_id, v_operation, p_idempotency_key, v_hash, now() + interval '30 days')
  on conflict (user_id, operation, idempotency_key) do nothing;
  select * into v_ledger from public.mobile_idempotency_keys
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key for update;
  if v_ledger.request_hash <> v_hash then
    raise exception using errcode = 'PT409', message = 'IDEMPOTENCY_KEY_REUSED';
  end if;
  -- A retry after a lost success replays; it never hits the advanced CAS.
  if v_ledger.state = 'completed' then
    return query select v_ledger.response_status, v_ledger.response_body, true;
    return;
  end if;

  v_version := public.lock_completed_workout_session(p_session_id);
  if v_version is distinct from p_expected_session_updated_at then
    raise exception using errcode = 'PT409', message = 'SESSION_CHANGED';
  end if;

  -- Sets are addressed by their unique set_number; the exact existing set
  -- numbers are required (historical series cannot be added or removed).
  for v_item in select value from jsonb_array_elements(p_payload -> 'exercises')
  loop
    select * into v_exercise from public.workout_session_exercises
    where id = (v_item ->> 'session_exercise_id')::uuid
      and workout_session_id = p_session_id and user_id = v_user_id
    for update;
    if v_exercise.id is null then
      raise exception using errcode = '22023', message = 'El ejercicio no pertenece a esta sesión.';
    end if;
    if v_exercise.updated_at is distinct from (v_item ->> 'expected_updated_at')::timestamptz then
      raise exception using errcode = 'PT409', message = 'SESSION_EXERCISE_CHANGED';
    end if;
    if (select coalesce(array_agg(s.set_number order by s.set_number), '{}'::integer[])
        from public.workout_sets s where s.workout_session_exercise_id = v_exercise.id and s.user_id = v_user_id)
      is distinct from
      (select coalesce(array_agg((value ->> 'set_number')::numeric order by (value ->> 'set_number')::numeric)::integer[], '{}'::integer[])
        from jsonb_array_elements(v_item -> 'sets'))
      or exists (select 1 from jsonb_array_elements(v_item -> 'sets')
        where (value ->> 'set_number')::numeric <> trunc((value ->> 'set_number')::numeric)) then
      raise exception using errcode = '22023', message = 'No se pueden agregar ni quitar series históricas.';
    end if;
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'actual_reps', supplied.value -> 'actual_reps',
      'actual_weight_kg', supplied.value -> 'actual_weight_kg',
      'notes', supplied.value -> 'notes'
    ) order by s.set_number) into v_domain_sets
    from jsonb_array_elements(v_item -> 'sets') as supplied(value)
    join public.workout_sets s on s.workout_session_exercise_id = v_exercise.id and s.user_id = v_user_id
      and s.set_number = (supplied.value ->> 'set_number')::integer;
    v_domain_exercises := v_domain_exercises || jsonb_build_array(jsonb_build_object(
      'id', v_exercise.id, 'expected_updated_at', v_item -> 'expected_updated_at',
      'notes', v_item -> 'notes', 'sets', coalesce(v_domain_sets, '[]'::jsonb)
    ));
  end loop;

  -- Domain: descriptive fields only; no snapshots, completion or progression.
  perform public.correct_completed_workout_session(p_session_id, p_expected_session_updated_at,
    jsonb_build_object('metadata', p_payload -> 'metadata', 'exercises', v_domain_exercises));

  select jsonb_build_object(
    'status', 'corrected',
    'sessionId', ws.id,
    'sessionUpdatedAt', ws.updated_at,
    'metadata', jsonb_build_object(
      'energyLevel', ws.energy_level, 'performanceLevel', ws.performance_level,
      'painLevel', ws.pain_level, 'painNote', ws.pain_note,
      'treadmillMinutes', ws.treadmill_minutes, 'treadmillDistanceKm', ws.treadmill_distance_km,
      'treadmillSpeedKmh', ws.treadmill_speed_kmh, 'treadmillInclinePercent', ws.treadmill_incline_percent,
      'notes', ws.notes
    ),
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', se.id, 'updatedAt', se.updated_at, 'notes', se.notes,
        'sets', coalesce((select jsonb_agg(jsonb_build_object(
          'setNumber', s.set_number, 'actualReps', s.actual_reps,
          'actualWeightKg', s.actual_weight_kg, 'notes', s.notes
        ) order by s.set_number) from public.workout_sets s
          where s.workout_session_exercise_id = se.id and s.user_id = v_user_id), '[]'::jsonb)
      ) order by se.exercise_order)
      from public.workout_session_exercises se
      where se.workout_session_id = ws.id and se.user_id = v_user_id
    ), '[]'::jsonb)
  ) into v_response
  from public.workout_sessions ws
  where ws.id = p_session_id and ws.user_id = v_user_id;

  update public.mobile_idempotency_keys
  set state = 'completed', response_status = 200, response_body = v_response,
    resource_type = 'workout_session', resource_id = p_session_id, completed_at = now()
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key;
  return query select 200::smallint, v_response, false;
end;
$$;

create or replace function public.mobile_discard_completed_session(
  p_session_id uuid,
  p_idempotency_key text
)
returns table (response_status smallint, response_body jsonb, replayed boolean)
language plpgsql
security definer
set search_path = ''
set lock_timeout = '3s'
set statement_timeout = '8s'
as $$
declare
  v_user_id uuid;
  v_operation constant text := 'training.session.discard.v1';
  v_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_response jsonb;
begin
  v_user_id := public.lock_training_user_mutations();
  if p_session_id is null or p_idempotency_key is null
    or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'La operación no es válida.';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'sessionId', p_session_id
  )::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.mobile_idempotency_keys (user_id, operation, idempotency_key, request_hash, expires_at)
  values (v_user_id, v_operation, p_idempotency_key, v_hash, now() + interval '30 days')
  on conflict (user_id, operation, idempotency_key) do nothing;
  select * into v_ledger from public.mobile_idempotency_keys
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key for update;
  if v_ledger.request_hash <> v_hash then
    raise exception using errcode = 'PT409', message = 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if v_ledger.state = 'completed' then
    return query select v_ledger.response_status, v_ledger.response_body, true;
    return;
  end if;

  perform public.lock_completed_workout_session(p_session_id);
  -- Logical discard only; routine effects applied at finish are not reverted.
  perform public.discard_completed_workout_session(p_session_id);

  select jsonb_build_object('status', 'discarded', 'sessionId', ws.id, 'sessionUpdatedAt', ws.updated_at)
  into v_response
  from public.workout_sessions ws
  where ws.id = p_session_id and ws.user_id = v_user_id and ws.status = 'discarded';
  if v_response is null then
    raise exception 'Discarded session read-back failed';
  end if;

  update public.mobile_idempotency_keys
  set state = 'completed', response_status = 200, response_body = v_response,
    resource_type = 'workout_session', resource_id = p_session_id, completed_at = now()
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key;
  return query select 200::smallint, v_response, false;
end;
$$;

revoke all on function public.lock_completed_workout_session(uuid) from public, anon;
revoke all on function public.mobile_finish_training_session(uuid,jsonb,text) from public, anon;
revoke all on function public.mobile_correct_completed_session(uuid,timestamptz,jsonb,text) from public, anon;
revoke all on function public.mobile_discard_completed_session(uuid,text) from public, anon;
grant execute on function public.lock_completed_workout_session(uuid) to authenticated;
grant execute on function public.mobile_finish_training_session(uuid,jsonb,text) to authenticated;
grant execute on function public.mobile_correct_completed_session(uuid,timestamptz,jsonb,text) to authenticated;
grant execute on function public.mobile_discard_completed_session(uuid,text) to authenticated;
commit;
