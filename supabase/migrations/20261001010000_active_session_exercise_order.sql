-- M3.3D: active-session exercise order only. Reuse the M3.3B user lock,
-- ownership primitives and ledger. No schema additions or historical backfill.
begin;

create or replace function public.set_workout_session_updated_at()
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
drop trigger if exists tr_workout_sessions_updated_at on public.workout_sessions;
create trigger tr_workout_sessions_updated_at
before update on public.workout_sessions
for each row execute function public.set_workout_session_updated_at();

-- Order is not part of the exercise payload CAS. Preserve that token ONLY
-- when the entire row except order/updated_at is unchanged. All saves and
-- other exercise edits continue using the strictly advancing M3.3B token.
create or replace function public.set_workout_exercise_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.exercise_order is distinct from old.exercise_order
    and (to_jsonb(new) - 'exercise_order' - 'updated_at') is not distinct from
      (to_jsonb(old) - 'exercise_order' - 'updated_at') then
    new.updated_at := old.updated_at;
  else
    new.updated_at := greatest(pg_catalog.clock_timestamp(), old.updated_at + interval '1 microsecond');
  end if;
  return new;
end;
$$;

-- Both Web and Mobile use these shared primitives. Invalidate the session
-- token on membership changes, under their existing user -> session locks.
-- Do not add child-row -> parent-row locking triggers to payload autosave.
do $membership_version$
declare
  v_signature text;
  v_definition text;
  v_return text;
  v_touch constant text := E'  -- M3.3D session structure CAS\n  update public.workout_sessions\n  set updated_at = updated_at\n  where id = p_session_id and user_id = v_user_id;\n';
begin
  foreach v_signature in array array[
    'public.append_workout_exercise(uuid,uuid,text)',
    'public.remove_workout_exercise(uuid,uuid,timestamptz)'
  ] loop
    v_definition := pg_catalog.pg_get_functiondef(v_signature::regprocedure);
    if position('-- M3.3D session structure CAS' in v_definition) = 0 then
      v_return := case when v_signature like '%append_workout%' then '  return v_session_exercise_id;' else '  return p_session_exercise_id;' end;
      if position(v_return in v_definition) = 0 then raise exception 'Expected shared membership primitive not found'; end if;
      execute pg_catalog.replace(v_definition, v_return, v_touch || v_return);
    end if;
  end loop;
end;
$membership_version$;

create or replace function public.mobile_reorder_workout_exercises(
  p_session_id uuid,
  p_ordered_session_exercise_ids uuid[],
  p_expected_session_updated_at timestamptz,
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
  v_operation constant text := 'training.session.exercise-order.v1';
  v_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_version timestamptz;
  v_current_ids uuid[];
  v_response jsonb;
  v_count integer;
begin
  -- Lock BEFORE ledger or row locks, identical to the M3.3B write domain.
  v_user_id := public.lock_training_user_mutations();
  if p_session_id is null or p_expected_session_updated_at is null
    or p_ordered_session_exercise_ids is null
    or cardinality(p_ordered_session_exercise_ids) > 10000
    or (cardinality(p_ordered_session_exercise_ids) > 0 and
      (array_ndims(p_ordered_session_exercise_ids) <> 1 or array_lower(p_ordered_session_exercise_ids, 1) <> 1))
    or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'El orden enviado no es válido.';
  end if;
  if exists (select 1 from unnest(p_ordered_session_exercise_ids) as supplied(id) where id is null)
    or cardinality(p_ordered_session_exercise_ids) <>
      (select count(distinct id) from unnest(p_ordered_session_exercise_ids) as supplied(id)) then
    raise exception using errcode = '22023', message = 'Los ejercicios no pueden repetirse ni estar vacíos.';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'sessionId', p_session_id, 'orderedSessionExerciseIds', p_ordered_session_exercise_ids,
    'expectedSessionUpdatedAt', p_expected_session_updated_at
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
  perform public.lock_active_workout_session(p_session_id);
  select updated_at into v_version from public.workout_sessions
  where id = p_session_id and user_id = v_user_id;
  if v_version is distinct from p_expected_session_updated_at then
    raise exception using errcode = 'PT409', message = 'SESSION_CHANGED';
  end if;

  -- Check the exact current set; foreign/missing IDs share one validation error.
  select count(*)::integer into v_count from public.workout_session_exercises
  where workout_session_id = p_session_id and user_id = v_user_id;
  if cardinality(p_ordered_session_exercise_ids) <> v_count or exists (
    select 1 from unnest(p_ordered_session_exercise_ids) as supplied(id)
    where not exists (select 1 from public.workout_session_exercises se
      where se.id = supplied.id and se.workout_session_id = p_session_id and se.user_id = v_user_id)
  ) then
    raise exception using errcode = '22023', message = 'El orden debe incluir exactamente los ejercicios de esta sesión.';
  end if;
  perform id from public.workout_session_exercises
  where workout_session_id = p_session_id and user_id = v_user_id order by id for update;

  -- The existing unique-order constraint is deferrable. One UPDATE avoids
  -- remove/re-add, temporary out-of-range values or a partially written order.
  update public.workout_session_exercises se
  set exercise_order = supplied.position::integer
  from unnest(p_ordered_session_exercise_ids) with ordinality as supplied(id, position)
  where se.id = supplied.id and se.workout_session_id = p_session_id and se.user_id = v_user_id
    and se.exercise_order is distinct from supplied.position::integer;
  update public.workout_sessions set updated_at = updated_at
  where id = p_session_id and user_id = v_user_id returning updated_at into v_version;
  select coalesce(array_agg(id order by exercise_order), '{}'::uuid[]) into v_current_ids
  from public.workout_session_exercises where workout_session_id = p_session_id and user_id = v_user_id;
  v_response := jsonb_build_object('status', 'reordered', 'sessionId', p_session_id,
    'sessionUpdatedAt', v_version, 'orderedSessionExerciseIds', v_current_ids);
  update public.mobile_idempotency_keys
  set state = 'completed', response_status = 200, response_body = v_response,
    resource_type = 'workout_session', resource_id = p_session_id, completed_at = now()
  where user_id = v_user_id and operation = v_operation and idempotency_key = p_idempotency_key;
  return query select 200::smallint, v_response, false;
end;
$$;
revoke all on function public.set_workout_session_updated_at() from public, anon, authenticated;
revoke all on function public.set_workout_exercise_updated_at() from public, anon, authenticated;
revoke all on function public.mobile_reorder_workout_exercises(uuid,uuid[],timestamptz,text) from public, anon;
grant execute on function public.mobile_reorder_workout_exercises(uuid,uuid[],timestamptz,text) to authenticated;
commit;
