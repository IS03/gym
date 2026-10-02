-- M3.3B: active-session writes share the existing Training user lock with Web
-- finish/start/catalog/template writes. Order: user -> session -> exercise -> sets.
-- No schema/backfill changes. Structural intents reuse the private Mobile ledger.
begin;

-- The reused catalog RPC was created with a public.digest reference, but the
-- project's pgcrypto lives in extensions. Also acquire the shared user lock
-- BEFORE its ledger locks (the old catalog path otherwise takes the user lock
-- later, in its INSERT trigger). Keep its existing validation/catalog logic.
do $repair$
declare v_definition text;
begin
  v_definition := replace(pg_catalog.pg_get_functiondef(
    'public.mobile_create_training_exercise(text,jsonb,uuid[])'::regprocedure
  ), 'public.digest(', 'extensions.digest(');
  if position('  insert into public.mobile_idempotency_keys (' in v_definition) = 0 then
    raise exception 'Expected catalog ledger primitive not found';
  end if;
  if position(E'  perform public.lock_training_user_mutations();\n\n  insert into public.mobile_idempotency_keys (' in v_definition) = 0 then
    v_definition := replace(v_definition, '  insert into public.mobile_idempotency_keys (',
      E'  perform public.lock_training_user_mutations();\n\n  insert into public.mobile_idempotency_keys (');
  end if;
  execute v_definition;
end;
$repair$;

create or replace function public.lock_active_workout_session(p_session_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_status text;
begin
  v_user_id := public.lock_training_user_mutations();
  select status into v_status from public.workout_sessions
  where id = p_session_id and user_id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_SESSION_NOT_FOUND';
  end if;
  if v_status <> 'in_progress' then
    raise exception using errcode = 'P0001', message = 'SESSION_CLOSED';
  end if;
  return v_user_id;
end;
$$;

-- now() is transaction-start time and can repeat (or precede a version written
-- while waiting). Keep the exercise CAS token strictly advancing, even within
-- one transaction. Other product timestamps retain their existing semantics.
create or replace function public.set_workout_exercise_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
drop trigger if exists tr_workout_session_exercises_updated_at on public.workout_session_exercises;
create trigger tr_workout_session_exercises_updated_at
before update on public.workout_session_exercises
for each row execute function public.set_workout_exercise_updated_at();

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
  v_session_id uuid;
  v_row public.workout_session_exercises;
  v_sets_count integer;
  v_updated_at timestamptz;
  v_decision text := p_payload ->> 'decision';
  v_set jsonb;
  v_field text;
  v_has_completed boolean;
begin
  -- Validate runtime JSON as well as the API/domain DTO. In particular, do not
  -- let casts turn missing data, strings, or fractional reps into valid values.
  if jsonb_typeof(p_payload) is distinct from 'object'
    or not (p_payload ?& array['is_completed','decision','decision_note','apply_to_routine','notes','sets'])
    or exists (select 1 from jsonb_object_keys(p_payload) k where k not in
      ('is_completed','decision','decision_note','apply_to_routine','notes','sets'))
    or jsonb_typeof(p_payload -> 'is_completed') is distinct from 'boolean'
    or jsonb_typeof(p_payload -> 'apply_to_routine') is distinct from 'boolean'
    or jsonb_typeof(p_payload -> 'decision') is distinct from 'string'
    or jsonb_typeof(p_payload -> 'decision_note') is distinct from 'string'
    or jsonb_typeof(p_payload -> 'notes') is distinct from 'string'
    or v_decision not in ('maintain','increase_weight','increase_reps','custom')
    or (v_decision = 'custom' and nullif(btrim(p_payload ->> 'decision_note'), '') is null)
    or jsonb_typeof(p_payload -> 'sets') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'El payload del ejercicio no es válido.';
  end if;
  v_sets_count := jsonb_array_length(p_payload -> 'sets');
  if v_sets_count not between 1 and 50 then
    raise exception using errcode = '22023', message = 'La cantidad de series debe estar entre 1 y 50.';
  end if;
  for v_set in select value from jsonb_array_elements(p_payload -> 'sets') loop
    if jsonb_typeof(v_set) is distinct from 'object'
      or not (v_set ?& array['set_number','target_reps','target_weight_kg','target_rir','actual_reps','actual_weight_kg','is_completed','notes'])
      or exists (select 1 from jsonb_object_keys(v_set) k where k not in
        ('set_number','target_reps','target_weight_kg','target_rir','actual_reps','actual_weight_kg','is_completed','notes'))
      or jsonb_typeof(v_set -> 'set_number') is distinct from 'number'
      or jsonb_typeof(v_set -> 'is_completed') is distinct from 'boolean'
      or jsonb_typeof(v_set -> 'notes') not in ('string','null') then
      raise exception using errcode = '22023', message = 'La serie no es válida.';
    end if;
    foreach v_field in array array['target_reps','target_weight_kg','target_rir','actual_reps','actual_weight_kg'] loop
      if jsonb_typeof(v_set -> v_field) not in ('number','null') then
        raise exception using errcode = '22023', message = 'Los valores de la serie no son válidos.';
      end if;
      if jsonb_typeof(v_set -> v_field) = 'number' then
        if (v_set ->> v_field)::numeric < 0
          or (v_set ->> v_field)::numeric > (case when v_field = 'target_rir' then 10
            when v_field in ('target_reps','actual_reps') then 1000 else 9999.99 end)
          or (v_field in ('target_reps','actual_reps','target_rir')
            and (v_set ->> v_field)::numeric <> trunc((v_set ->> v_field)::numeric))
          or (v_field in ('target_weight_kg','actual_weight_kg')
            and (v_set ->> v_field)::numeric <> round((v_set ->> v_field)::numeric, 2)) then
          raise exception using errcode = '22023', message = 'Los valores de la serie están fuera de rango.';
        end if;
      end if;
    end loop;
    if (v_set ->> 'is_completed')::boolean and jsonb_typeof(v_set -> 'actual_reps') = 'null' then
      raise exception using errcode = '22023', message = 'Completá las repeticiones de la serie.';
    end if;
  end loop;
  if exists (select 1 from jsonb_array_elements(p_payload -> 'sets') with ordinality as s(value, n)
    where (value ->> 'set_number')::numeric <> n) then
    raise exception using errcode = '22023', message = 'Las series deben estar numeradas en orden desde 1.';
  end if;
  select coalesce(bool_or((value ->> 'is_completed')::boolean), false) into v_has_completed
  from jsonb_array_elements(p_payload -> 'sets');
  if (p_payload ->> 'is_completed')::boolean <> v_has_completed then
    raise exception using errcode = '22023', message = 'El estado del ejercicio no coincide con sus series.';
  end if;

  -- Acquire the shared lock BEFORE selecting any row FOR UPDATE. Web finish
  -- already acquires this same lock before its session/routine locks.
  v_user_id := public.lock_training_user_mutations();
  select workout_session_id into v_session_id from public.workout_session_exercises
  where id = p_session_exercise_id and user_id = v_user_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_SESSION_EXERCISE_NOT_FOUND';
  end if;
  perform public.lock_active_workout_session(v_session_id);
  select * into v_row from public.workout_session_exercises
  where id = p_session_exercise_id and workout_session_id = v_session_id
    and user_id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_EXERCISE_REMOVED';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'SESSION_EXERCISE_CHANGED';
  end if;
  perform set_config('ownlevel.workout_save_mode', 'robust', true);
  update public.workout_session_exercises
  set planned_sets_count = v_sets_count, series_reales = v_sets_count,
    reps_reales = nullif(p_payload #>> '{sets,0,actual_reps}', '')::integer,
    peso_real = nullif(p_payload #>> '{sets,0,actual_weight_kg}', '')::numeric,
    is_completed = v_has_completed, decision = v_decision,
    decision_note = case when v_decision = 'custom' then nullif(btrim(p_payload ->> 'decision_note'), '') else null end,
    apply_to_routine = case when routine_exercise_id is null then false else (p_payload ->> 'apply_to_routine')::boolean end,
    notes = nullif(p_payload ->> 'notes', '')
  where id = p_session_exercise_id returning updated_at into v_updated_at;
  delete from public.workout_sets where workout_session_exercise_id = p_session_exercise_id;
  insert into public.workout_sets (
    user_id, workout_session_exercise_id, set_number, target_reps, target_weight_kg,
    target_rir, actual_reps, actual_weight_kg, is_completed, notes
  ) select v_user_id, p_session_exercise_id, item.set_number, item.target_reps,
    item.target_weight_kg, item.target_rir, item.actual_reps, item.actual_weight_kg,
    item.is_completed, nullif(item.notes, '')
  from jsonb_to_recordset(p_payload -> 'sets') as item(
    set_number integer, target_reps integer, target_weight_kg numeric, target_rir smallint,
    actual_reps integer, actual_weight_kg numeric, is_completed boolean, notes text
  );
  return v_updated_at;
end;
$$;

create or replace function public.append_workout_exercise(
  p_session_id uuid, p_exercise_id uuid, p_source_type text default 'extra'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_exercise public.exercises;
  v_session_exercise_id uuid;
  v_order integer;
  v_sets integer;
begin
  v_user_id := public.lock_active_workout_session(p_session_id);
  if p_source_type is null or p_source_type not in ('extra','manual_new') then
    raise exception using errcode = '22023', message = 'Origen inválido.';
  end if;
  if exists (select 1 from public.workout_session_exercises
    where workout_session_id = p_session_id and exercise_id = p_exercise_id and user_id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'SESSION_EXERCISE_ALREADY_EXISTS';
  end if;
  select * into v_exercise from public.exercises
  where id = p_exercise_id and user_id = v_user_id and is_active for share;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_EXERCISE_NOT_FOUND';
  end if;
  select coalesce(max(exercise_order), 0) + 1 into v_order
  from public.workout_session_exercises where workout_session_id = p_session_id;
  v_sets := greatest(coalesce(v_exercise.series_sugeridas, 1), 1);
  insert into public.workout_session_exercises (
    user_id, workout_session_id, exercise_id, nombre_snapshot, grupo_muscular_snapshot,
    muscle_group_label_snapshot, implement_snapshot, weight_mode_snapshot,
    rest_min_seconds_snapshot, rest_max_seconds_snapshot, source_type, exercise_order, planned_sets_count
  ) values (
    v_user_id, p_session_id, v_exercise.id, v_exercise.nombre, v_exercise.grupo_muscular,
    v_exercise.muscle_group_label, v_exercise.implement, v_exercise.weight_mode,
    v_exercise.descanso_min_sugerido_segundos, v_exercise.descanso_max_sugerido_segundos,
    p_source_type, v_order, v_sets
  ) returning id into v_session_exercise_id;
  insert into public.workout_sets (
    user_id, workout_session_exercise_id, set_number, target_reps, target_weight_kg,
    target_rir, actual_reps, actual_weight_kg
  ) select v_user_id, v_session_exercise_id, generated, v_exercise.reps_sugeridas,
    v_exercise.peso_sugerido, v_exercise.rir_sugerido, v_exercise.reps_sugeridas, v_exercise.peso_sugerido
  from generate_series(1, v_sets) generated
  on conflict (workout_session_exercise_id, set_number) do update
  set target_reps = excluded.target_reps, target_weight_kg = excluded.target_weight_kg,
    target_rir = excluded.target_rir, actual_reps = excluded.actual_reps,
    actual_weight_kg = excluded.actual_weight_kg;
  return v_session_exercise_id;
end;
$$;

create or replace function public.remove_workout_exercise(
  p_session_id uuid, p_session_exercise_id uuid, p_expected_updated_at timestamptz
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_version timestamptz;
begin
  v_user_id := public.lock_active_workout_session(p_session_id);
  select updated_at into v_version from public.workout_session_exercises
  where id = p_session_exercise_id and workout_session_id = p_session_id
    and user_id = v_user_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'SESSION_EXERCISE_REMOVED';
  end if;
  if v_version is distinct from p_expected_updated_at then
    raise exception using errcode = '40001', message = 'SESSION_EXERCISE_CHANGED';
  end if;
  delete from public.workout_session_exercises
  where id = p_session_exercise_id and workout_session_id = p_session_id and user_id = v_user_id;
  return p_session_exercise_id;
end;
$$;

create or replace function public.cancel_workout_session(p_session_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare v_user_id uuid;
begin
  v_user_id := public.lock_active_workout_session(p_session_id);
  delete from public.workout_sessions where id = p_session_id and user_id = v_user_id and status = 'in_progress';
  return p_session_id;
end;
$$;

-- The path association is verified in the SAME transaction as CAS; a client
-- cannot use one owned session's URL to mutate an exercise from another session.
create or replace function public.mobile_save_workout_exercise(
  p_session_id uuid, p_session_exercise_id uuid, p_expected_updated_at timestamptz, p_payload jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
set lock_timeout = '3s'
set statement_timeout = '8s'
as $$
declare v_user_id uuid;
begin
  v_user_id := public.lock_active_workout_session(p_session_id);
  if not exists (select 1 from public.workout_session_exercises
    where id = p_session_exercise_id and workout_session_id = p_session_id and user_id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'SESSION_EXERCISE_REMOVED';
  end if;
  return public.save_workout_exercise(p_session_exercise_id, p_expected_updated_at, p_payload);
end;
$$;

-- One controlled ledger adapter for the four structural operations. It owns
-- no new domain model. Nested catalog creation and append commit/rollback with
-- this outer transaction, including BOTH ledger records. There is no saga or
-- successful partial-create response. Replay precedes current-state validation:
-- it confirms the original intent, never claims the resource is still active.
create or replace function public.mobile_mutate_workout_session(
  p_session_id uuid, p_operation text, p_idempotency_key text,
  p_session_exercise_id uuid default null, p_expected_updated_at timestamptz default null,
  p_exercise_id uuid default null, p_exercise jsonb default null
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
  v_operation text;
  v_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_exercise_id uuid := p_exercise_id;
  v_session_exercise_id uuid;
  v_created record;
  v_response jsonb;
  v_status smallint := 200;
begin
  v_user_id := public.lock_training_user_mutations();
  if p_session_id is null or p_operation is null or p_operation not in ('add_existing','create_and_add','remove','cancel')
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'La operación no es válida.';
  end if;
  if (p_operation = 'add_existing' and (p_exercise_id is null or p_exercise is not null or p_session_exercise_id is not null or p_expected_updated_at is not null))
    or (p_operation = 'create_and_add' and (p_exercise is null or p_exercise_id is not null or p_session_exercise_id is not null or p_expected_updated_at is not null))
    or (p_operation = 'remove' and (p_session_exercise_id is null or p_expected_updated_at is null or p_exercise_id is not null or p_exercise is not null))
    or (p_operation = 'cancel' and (p_session_exercise_id is not null or p_expected_updated_at is not null or p_exercise_id is not null or p_exercise is not null)) then
    raise exception using errcode = '22023', message = 'Los argumentos de la operación no son válidos.';
  end if;
  v_operation := 'training.session.' || p_operation || '.v1';
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'sessionId', p_session_id, 'sessionExerciseId', p_session_exercise_id,
    'expectedUpdatedAt', p_expected_updated_at, 'exerciseId', p_exercise_id, 'exercise', p_exercise
  )::text, 'UTF8'), 'sha256'), 'hex');
  insert into public.mobile_idempotency_keys (user_id, operation, idempotency_key, request_hash, expires_at)
  values (v_user_id, v_operation, p_idempotency_key, v_hash, now() + interval '30 days')
  on conflict (user_id, operation, idempotency_key) do nothing;
  select * into v_ledger from public.mobile_idempotency_keys
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key for update;
  if v_ledger.request_hash <> v_hash then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if v_ledger.state = 'completed' then
    return query select v_ledger.response_status, v_ledger.response_body, true;
    return;
  end if;
  perform public.lock_active_workout_session(p_session_id);
  if p_operation in ('add_existing','create_and_add') then
    if p_operation = 'create_and_add' then
      -- Separate operation namespace and bounded derived key; the existing
      -- catalog RPC performs its full runtime validation and normalization.
      select * into v_created from public.mobile_create_training_exercise(
        'session-create:' || encode(extensions.digest(convert_to(p_session_id::text || ':' || p_idempotency_key, 'UTF8'), 'sha256'), 'hex'),
        p_exercise, '{}'::uuid[]
      );
      v_exercise_id := (v_created.response_body #>> '{exercise,id}')::uuid;
      if v_created.response_status <> 201 or v_exercise_id is null then
        raise exception 'TRAINING_SESSION_CREATE_FAILED';
      end if;
    end if;
    v_session_exercise_id := public.append_workout_exercise(p_session_id, v_exercise_id,
      case when p_operation = 'create_and_add' then 'manual_new' else 'extra' end);
    v_status := 201;
    v_response := jsonb_build_object('status','added','sessionId',p_session_id,
      'sessionExerciseId',v_session_exercise_id,'exerciseId',v_exercise_id);
  elsif p_operation = 'remove' then
    perform public.remove_workout_exercise(p_session_id, p_session_exercise_id, p_expected_updated_at);
    v_response := jsonb_build_object('status','removed','sessionId',p_session_id,'sessionExerciseId',p_session_exercise_id);
  else
    perform public.cancel_workout_session(p_session_id);
    v_response := jsonb_build_object('status','cancelled','sessionId',p_session_id);
  end if;
  update public.mobile_idempotency_keys
  set state = 'completed', response_status = v_status, response_body = v_response,
    resource_type = 'workout_session', resource_id = p_session_id, completed_at = now()
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key;
  return query select v_status, v_response, false;
end;
$$;

revoke all on function public.set_workout_exercise_updated_at() from public, anon, authenticated;
revoke all on function public.lock_active_workout_session(uuid) from public, anon;
revoke all on function public.save_workout_exercise(uuid,timestamptz,jsonb) from public, anon;
revoke all on function public.append_workout_exercise(uuid,uuid,text) from public, anon;
revoke all on function public.remove_workout_exercise(uuid,uuid,timestamptz) from public, anon;
revoke all on function public.cancel_workout_session(uuid) from public, anon;
revoke all on function public.mobile_save_workout_exercise(uuid,uuid,timestamptz,jsonb) from public, anon;
revoke all on function public.mobile_mutate_workout_session(uuid,text,text,uuid,timestamptz,uuid,jsonb) from public, anon;
grant execute on function public.lock_active_workout_session(uuid) to authenticated;
grant execute on function public.save_workout_exercise(uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.append_workout_exercise(uuid,uuid,text) to authenticated;
grant execute on function public.remove_workout_exercise(uuid,uuid,timestamptz) to authenticated;
grant execute on function public.cancel_workout_session(uuid) to authenticated;
grant execute on function public.mobile_save_workout_exercise(uuid,uuid,timestamptz,jsonb) to authenticated;
grant execute on function public.mobile_mutate_workout_session(uuid,text,text,uuid,timestamptz,uuid,jsonb) to authenticated;

commit;
