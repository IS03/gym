-- M3.2A regression coverage. Run against a disposable database after applying
-- all migrations. The transaction is always rolled back.
-- True two-connection lock/concurrency cases remain part of the PostgreSQL
-- validation pass because they cannot be represented by one SQL session.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '23200000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'm3-2a-owner@example.invalid', '', pg_catalog.now(),
    '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
  ),
  (
    '23200000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'm3-2a-other@example.invalid', '', pg_catalog.now(),
    '{}'::jsonb, '{}'::jsonb, pg_catalog.now(), pg_catalog.now()
  );

insert into public.routines (id, user_id, nombre, color, is_active) values
  ('23200000-0000-4000-8000-000000000101', '23200000-0000-4000-8000-000000000001', 'M3.2A PUSH', 'violet', true),
  ('23200000-0000-4000-8000-000000000102', '23200000-0000-4000-8000-000000000002', 'M3.2A FOREIGN', 'blue', true);

insert into public.exercises (
  id, user_id, nombre, series_sugeridas, reps_sugeridas, peso_sugerido,
  rir_sugerido, descanso_min_sugerido_segundos,
  descanso_max_sugerido_segundos, is_active
) values
  ('23200000-0000-4000-8000-000000000201', '23200000-0000-4000-8000-000000000001', 'M3.2A PRESS', 50, 8, 80, 2, 180, 240, true),
  ('23200000-0000-4000-8000-000000000202', '23200000-0000-4000-8000-000000000001', 'M3.2A FLY', 2, 12, 20, 2, 90, 120, true),
  ('23200000-0000-4000-8000-000000000203', '23200000-0000-4000-8000-000000000002', 'M3.2A FOREIGN EXERCISE', 2, 10, 10, 2, 90, 120, true);

insert into public.routine_exercises (id, routine_id, exercise_id, exercise_order)
values (
  '23200000-0000-4000-8000-000000000301',
  '23200000-0000-4000-8000-000000000102',
  '23200000-0000-4000-8000-000000000203',
  1
);

set local role authenticated;
select pg_catalog.set_config('request.jwt.claim.sub', '23200000-0000-4000-8000-000000000001', true);
select pg_catalog.set_config('request.jwt.claim.role', 'authenticated', true);

do $$
begin
  if not exists (
    select 1 from pg_catalog.pg_proc p
    where p.oid = 'public.mobile_replace_training_routine_template(uuid,bigint,jsonb)'::regprocedure
      and 'search_path=""' = any(p.proconfig)
  ) then
    raise exception 'template RPC must keep an empty search_path';
  end if;
  if pg_catalog.to_regprocedure('extensions.digest(bytea,text)') is null then
    raise exception 'SHA-256 digest is not installed in extensions';
  end if;
end;
$$;

-- A Mobile payload with one set must not execute the legacy 50-set default.
select public.mobile_replace_training_routine_template(
  '23200000-0000-4000-8000-000000000101',
  1,
  '[{
    "routineExerciseId": null,
    "exerciseId": "23200000-0000-4000-8000-000000000201",
    "targets": {
      "nextAdjustment": "maintain",
      "nextAdjustmentNote": null,
      "restMinSeconds": null,
      "restMaxSeconds": null,
      "notes": "mobile",
      "sets": [{
        "setNumber": 1,
        "targetReps": 8,
        "targetWeightKg": 80,
        "targetRir": 2,
        "notes": null
      }]
    }
  }]'::jsonb
);

do $$
declare
  v_relation_id uuid;
begin
  select re.id into v_relation_id
  from public.routine_exercises re
  where re.routine_id = '23200000-0000-4000-8000-000000000101';

  if (select template_version from public.routines
      where id = '23200000-0000-4000-8000-000000000101') <> 2 then
    raise exception 'Mobile replace did not bump template_version exactly once';
  end if;
  if (select count(*) from public.routine_exercise_sets
      where routine_exercise_id = v_relation_id) <> 1 then
    raise exception 'Mobile replace leaked legacy default sets';
  end if;
  if exists (
    select 1 from public.routine_exercises
    where id = v_relation_id
      and (rest_min_seconds is not null or rest_max_seconds is not null)
  ) then
    raise exception 'Mobile replace leaked legacy rest defaults';
  end if;
  perform pg_catalog.set_config('ownlevel.m3_2a_relation_id', v_relation_id::text, true);
end;
$$;

-- Web and Mobile share this core. The explicit one-set routine template wins
-- over the legacy exercise default of 50 without creating surplus workout_sets.
do $$
declare
  v_day_log public.day_logs%rowtype;
  v_session_id uuid;
begin
  v_day_log := public.get_or_create_day_log(
    (pg_catalog.timezone('America/Argentina/Cordoba', pg_catalog.now()))::date
  );
  v_session_id := public.start_workout_session(
    v_day_log.id, '23200000-0000-4000-8000-000000000101'
  );

  if (select count(*) from public.workout_session_exercises
      where workout_session_id = v_session_id) <> 1
    or (select count(*) from public.workout_sets ws
        join public.workout_session_exercises se on se.id = ws.workout_session_exercise_id
        where se.workout_session_id = v_session_id) <> 1
    or exists (
      select 1 from public.workout_session_exercises
      where workout_session_id = v_session_id
        and (planned_sets_count <> 1 or series_reales <> 1)
    ) then
    raise exception 'Web start did not snapshot exactly one planned set';
  end if;

  update public.workout_sessions
  set status = 'completed', ended_at = pg_catalog.now()
  where id = v_session_id;
end;
$$;

-- Test scripts keep several logical calls in one outer transaction; clear the
-- transaction-local registry between calls to model separate PostgREST RPCs.
select pg_catalog.set_config(
  'ownlevel.template_bumped_23200000_0000_4000_8000_000000000101', '', true
);

select public.save_routine_exercise(
  pg_catalog.current_setting('ownlevel.m3_2a_relation_id')::uuid,
  '{
    "next_adjustment": "maintain",
    "rest_min_seconds": 90,
    "rest_max_seconds": 120,
    "notes": "web",
    "sets": [
      {"set_number":1,"target_reps":8,"target_weight_kg":80,"target_rir":2,"notes":null},
      {"set_number":2,"target_reps":8,"target_weight_kg":80,"target_rir":1,"notes":null}
    ]
  }'::jsonb
);

do $$
begin
  if (select template_version from public.routines
      where id = '23200000-0000-4000-8000-000000000101') <> 3 then
    raise exception 'Web save did not bump template_version exactly once';
  end if;
end;
$$;

select pg_catalog.set_config(
  'ownlevel.template_bumped_23200000_0000_4000_8000_000000000101', '', true
);
insert into public.routine_exercises (
  id, routine_id, exercise_id, exercise_order
) values (
  '23200000-0000-4000-8000-000000000302',
  '23200000-0000-4000-8000-000000000101',
  '23200000-0000-4000-8000-000000000202',
  2
);

select pg_catalog.set_config(
  'ownlevel.template_bumped_23200000_0000_4000_8000_000000000101', '', true
);
select public.move_routine_exercise(
  pg_catalog.current_setting('ownlevel.m3_2a_relation_id')::uuid,
  1
);

do $$
declare
  v_version bigint;
  v_before bigint;
begin
  select template_version into v_version from public.routines
  where id = '23200000-0000-4000-8000-000000000101';
  if v_version <> 5 then
    raise exception 'Web add/move did not produce one logical bump each: %', v_version;
  end if;

  begin
    perform public.mobile_replace_training_routine_template(
      '23200000-0000-4000-8000-000000000101', 4, '[]'::jsonb
    );
    raise exception 'stale Mobile CAS was accepted';
  exception when serialization_failure then
    if sqlerrm <> 'ROUTINE_TEMPLATE_CHANGED' then raise; end if;
  end;

  perform pg_catalog.set_config(
    'ownlevel.template_bumped_23200000_0000_4000_8000_000000000101', '', true
  );
  v_before := v_version;
  begin
    perform public.save_routine_exercise(
      pg_catalog.current_setting('ownlevel.m3_2a_relation_id')::uuid,
      '{
        "next_adjustment":"maintain",
        "rest_min_seconds":90,
        "rest_max_seconds":120,
        "notes":"must roll back",
        "sets":[
          {"set_number":1,"target_reps":8,"target_weight_kg":80,"target_rir":2,"notes":null},
          {"set_number":1,"target_reps":9,"target_weight_kg":80,"target_rir":2,"notes":null}
        ]
      }'::jsonb
    );
    raise exception 'invalid Web save was accepted';
  exception when unique_violation then
    null;
  end;
  if (select template_version from public.routines
      where id = '23200000-0000-4000-8000-000000000101') <> v_before then
    raise exception 'failed template write persisted a version bump';
  end if;
end;
$$;

-- Nested missing/foreign identifiers are indistinguishable and map to P0002.
do $$
begin
  begin
    perform public.mobile_replace_training_routine_template(
      '23200000-0000-4000-8000-000000000101', 5,
      '[{
        "routineExerciseId":"23200000-0000-4000-8000-000000000301",
        "exerciseId":"23200000-0000-4000-8000-000000000203",
        "targets":{
          "nextAdjustment":"maintain","nextAdjustmentNote":null,
          "restMinSeconds":90,"restMaxSeconds":120,"notes":null,
          "sets":[{"setNumber":1,"targetReps":10,"targetWeightKg":10,"targetRir":2,"notes":null}]
        }
      }]'::jsonb
    );
    raise exception 'foreign nested relation was accepted';
  exception when no_data_found then
    if sqlerrm <> 'TRAINING_ROUTINE_EXERCISE_NOT_FOUND' then raise; end if;
  end;
end;
$$;

-- Reorder two existing children through the Mobile RPC while the unique order
-- constraint is deferred and search_path is empty. IDs and one logical bump
-- must survive the swap.
do $$
declare
  v_first_id uuid := pg_catalog.current_setting('ownlevel.m3_2a_relation_id')::uuid;
  v_payload jsonb := '[
    {
      "routineExerciseId": null,
      "exerciseId": "23200000-0000-4000-8000-000000000201",
      "targets": {
        "nextAdjustment": "maintain", "nextAdjustmentNote": null,
        "restMinSeconds": 90, "restMaxSeconds": 120, "notes": "web",
        "sets": [
          {"setNumber": 1, "targetReps": 8, "targetWeightKg": 80, "targetRir": 2, "notes": null},
          {"setNumber": 2, "targetReps": 8, "targetWeightKg": 80, "targetRir": 1, "notes": null}
        ]
      }
    },
    {
      "routineExerciseId": "23200000-0000-4000-8000-000000000302",
      "exerciseId": "23200000-0000-4000-8000-000000000202",
      "targets": {
        "nextAdjustment": "maintain", "nextAdjustmentNote": null,
        "restMinSeconds": 90, "restMaxSeconds": 120, "notes": null,
        "sets": [
          {"setNumber": 1, "targetReps": 12, "targetWeightKg": 20, "targetRir": 2, "notes": null},
          {"setNumber": 2, "targetReps": 12, "targetWeightKg": 20, "targetRir": 2, "notes": null}
        ]
      }
    }
  ]'::jsonb;
begin
  v_payload := pg_catalog.jsonb_set(
    v_payload, '{0,routineExerciseId}', pg_catalog.to_jsonb(v_first_id::text)
  );
  perform public.mobile_replace_training_routine_template(
    '23200000-0000-4000-8000-000000000101', 5, v_payload
  );

  if (select template_version from public.routines
      where id = '23200000-0000-4000-8000-000000000101') <> 6
    or (select exercise_order from public.routine_exercises
        where id = v_first_id) <> 1
    or (select exercise_order from public.routine_exercises
        where id = '23200000-0000-4000-8000-000000000302') <> 2
    or (select count(*) from public.routine_exercises
        where routine_id = '23200000-0000-4000-8000-000000000101') <> 2 then
    raise exception 'Mobile reorder failed to defer uniqueness or changed IDs/version';
  end if;
end;
$$;

-- Start response, replay, already-active persistence, and Web/Mobile invariant.
update public.exercises set is_active = false
where id = '23200000-0000-4000-8000-000000000201';

do $$
declare
  v_status smallint;
  v_body jsonb;
  v_replayed boolean;
  v_session_id uuid;
begin
  select response_status, response_body, replayed
  into v_status, v_body, v_replayed
  from public.mobile_start_training_session(
    'm3-2a-start-1', '23200000-0000-4000-8000-000000000101'
  );
  if v_status <> 201 or v_replayed or v_body ->> 'status' <> 'started' then
    raise exception 'first Mobile start response is invalid';
  end if;
  v_session_id := (v_body #>> '{session,id}')::uuid;

  if (select count(*) from public.workout_session_exercises
      where workout_session_id = v_session_id) <> 2
    or exists (
      select 1
      from public.workout_session_exercises se
      left join public.workout_sets ws on ws.workout_session_exercise_id = se.id
      where se.workout_session_id = v_session_id
      group by se.id
      having se.planned_sets_count <> 2
        or se.series_reales <> 2
        or count(ws.id) <> 2
    )
    or not exists (
      select 1 from public.workout_session_exercises se
      where se.workout_session_id = v_session_id
        and se.exercise_id = '23200000-0000-4000-8000-000000000201'
    ) then
    raise exception 'Mobile start snapshot has missing/extra sets or lost archived exercise';
  end if;

  select response_status, response_body, replayed
  into v_status, v_body, v_replayed
  from public.mobile_start_training_session(
    'm3-2a-start-1', '23200000-0000-4000-8000-000000000101'
  );
  if v_status <> 201 or not v_replayed
    or (v_body #>> '{session,id}')::uuid <> v_session_id then
    raise exception 'Mobile start replay changed the response';
  end if;

  select response_status, response_body, replayed
  into v_status, v_body, v_replayed
  from public.mobile_start_training_session(
    'm3-2a-start-2', '23200000-0000-4000-8000-000000000101'
  );
  if v_status <> 409 or v_replayed
    or v_body ->> 'code' <> 'ACTIVE_SESSION_EXISTS'
    or (v_body #>> '{session,id}')::uuid <> v_session_id then
    raise exception 'already-active response was not persisted correctly';
  end if;

  select response_status, response_body, replayed
  into v_status, v_body, v_replayed
  from public.mobile_start_training_session(
    'm3-2a-start-2', '23200000-0000-4000-8000-000000000101'
  );
  if v_status <> 409 or not v_replayed
    or (v_body #>> '{session,id}')::uuid <> v_session_id then
    raise exception 'already-active replay changed the response';
  end if;

  begin
    perform public.start_workout_session(
      (select day_log_id from public.workout_sessions where id = v_session_id),
      '23200000-0000-4000-8000-000000000101'
    );
    raise exception 'Web start bypassed the active-session invariant';
  exception when raise_exception then
    if sqlerrm <> 'ACTIVE_SESSION_EXISTS' then raise; end if;
  end;

  if (select count(*) from public.workout_sessions
      where user_id = '23200000-0000-4000-8000-000000000001'
        and status = 'in_progress') <> 1 then
    raise exception 'more than one active session exists';
  end if;
end;
$$;

do $$
declare
  v_day_log_id uuid;
  v_session_id uuid;
begin
  select day_log_id into v_day_log_id
  from public.workout_sessions
  where user_id = '23200000-0000-4000-8000-000000000001'
    and status = 'in_progress';

  update public.workout_sessions
  set status = 'completed', ended_at = pg_catalog.now()
  where user_id = '23200000-0000-4000-8000-000000000001'
    and status = 'in_progress';

  v_session_id := public.start_workout_session(v_day_log_id, null);
  if exists (
    select 1 from public.workout_session_exercises
    where workout_session_id = v_session_id
  ) or exists (
    select 1 from public.workout_sets ws
    join public.workout_session_exercises se on se.id = ws.workout_session_exercise_id
    where se.workout_session_id = v_session_id
  ) then
    raise exception 'free start invented exercises or sets';
  end if;
end;
$$;

rollback;
