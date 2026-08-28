-- PR 11.1: fixtures sintéticos; la transacción completa se revierte.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '21110000-0000-4000-8000-000000000001', 'authenticated',
    'authenticated', 'pr11-1-owner@example.invalid', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '21110000-0000-4000-8000-000000000002', 'authenticated',
    'authenticated', 'pr11-1-other@example.invalid', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '21110000-0000-4000-8000-000000000001', true);

insert into public.day_logs (id, user_id, log_date)
values (
  '21110000-0000-4000-8000-000000000101',
  '21110000-0000-4000-8000-000000000001',
  '2026-08-26'
);

insert into public.exercises (
  id, user_id, nombre, series_sugeridas, reps_sugeridas, peso_sugerido,
  rir_sugerido, is_active
) values (
  '21110000-0000-4000-8000-000000000201',
  '21110000-0000-4000-8000-000000000001',
  'PR11 PRESS SINTÉTICO', 3, 10, 40, 2, true
);

insert into public.workout_sessions (
  id, user_id, day_log_id, session_name, status
) values (
  '21110000-0000-4000-8000-000000000301',
  '21110000-0000-4000-8000-000000000001',
  '21110000-0000-4000-8000-000000000101',
  'PR11 SESIÓN SINTÉTICA', 'in_progress'
);

select public.append_workout_exercise(
  '21110000-0000-4000-8000-000000000301',
  '21110000-0000-4000-8000-000000000201',
  'extra'
);

do $$
declare
  v_exercise_id uuid;
  v_before timestamptz;
  v_after timestamptz;
  v_started timestamptz;
begin
  select id, updated_at into v_exercise_id, v_before
  from public.workout_session_exercises
  where workout_session_id = '21110000-0000-4000-8000-000000000301';
  perform set_config('ownlevel.test_exercise_id', v_exercise_id::text, true);

  select public.save_workout_exercise(
    v_exercise_id,
    v_before,
    '{
      "is_completed": true,
      "decision": "maintain",
      "decision_note": "",
      "apply_to_routine": false,
      "notes": "guardado robusto",
      "sets": [
        {"set_number":1,"target_reps":10,"target_weight_kg":40,"target_rir":2,"actual_reps":10,"actual_weight_kg":42.5,"is_completed":true,"notes":null},
        {"set_number":2,"target_reps":10,"target_weight_kg":40,"target_rir":1,"actual_reps":8,"actual_weight_kg":42.5,"is_completed":false,"notes":"pendiente"}
      ]
    }'::jsonb
  ) into v_after;

  if v_after is null or v_after = v_before then
    raise exception 'updated_at no avanzó con el guardado robusto';
  end if;
  if (select count(*) from public.workout_sets
      where workout_session_exercise_id = v_exercise_id) <> 2 then
    raise exception 'el payload final no dejó exactamente dos series';
  end if;
  if not exists (
    select 1 from public.workout_sets
    where workout_session_exercise_id = v_exercise_id
      and set_number = 1
      and actual_reps = 10
      and actual_weight_kg = 42.5
      and is_completed
      and completed_at is not null
  ) or not exists (
    select 1 from public.workout_sets
    where workout_session_exercise_id = v_exercise_id
      and set_number = 2
      and actual_reps = 8
      and actual_weight_kg = 42.5
      and not is_completed
      and completed_at is null
  ) then
    raise exception 'las series finales no coinciden exactamente con el payload';
  end if;
  if not exists (
    select 1 from public.workout_session_exercises
    where id = v_exercise_id
      and is_completed
      and completed_at is not null
  ) then
    raise exception 'completed_at del ejercicio no se sincronizó';
  end if;

  v_started := clock_timestamp();
  begin
    perform public.save_workout_exercise(
      v_exercise_id,
      v_before,
      '{
        "is_completed": true,
        "decision": "maintain",
        "decision_note": "",
        "apply_to_routine": false,
        "notes": "stale",
        "sets": [
          {"set_number":1,"target_reps":10,"target_weight_kg":40,"target_rir":2,"actual_reps":9,"actual_weight_kg":45,"is_completed":true,"notes":null}
        ]
      }'::jsonb
    );
    raise exception 'se aceptó expected_updated_at obsoleto';
  exception when serialization_failure then
    if clock_timestamp() - v_started > interval '1 second' then
      raise exception 'el conflicto de versión no falló rápido';
    end if;
  end;

  if not exists (
    select 1 from pg_proc
    where oid = 'public.save_workout_exercise(uuid,timestamptz,jsonb)'::regprocedure
      and proconfig @> array['lock_timeout=3s', 'statement_timeout=8s']
  ) then
    raise exception 'el RPC no tiene límites locales de lock y statement';
  end if;
end;
$$;

-- Un usuario distinto no puede guardar ni obtener la fila protegida.
select set_config('request.jwt.claim.sub', '21110000-0000-4000-8000-000000000002', true);
do $$
declare
  v_exercise_id uuid;
begin
  select id into v_exercise_id
  from public.workout_session_exercises
  where workout_session_id = '21110000-0000-4000-8000-000000000301';
  if v_exercise_id is not null then
    raise exception 'RLS expuso el ejercicio al usuario equivocado';
  end if;

  begin
    perform public.save_workout_exercise(
      current_setting('ownlevel.test_exercise_id')::uuid,
      now(),
      '{"is_completed":false,"decision":"maintain","decision_note":"","apply_to_routine":false,"notes":"","sets":[{"set_number":1,"target_reps":10,"target_weight_kg":40,"target_rir":2,"actual_reps":null,"actual_weight_kg":null,"is_completed":false,"notes":null}]}'::jsonb
    );
    raise exception 'el usuario equivocado pudo guardar';
  exception when others then
    if sqlerrm = 'el usuario equivocado pudo guardar' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '21110000-0000-4000-8000-000000000001', true);

-- El puente legacy sigue funcionando fuera del RPC robusto.
select set_config('ownlevel.workout_save_mode', '', true);
update public.workout_session_exercises
set series_reales = 3,
    reps_reales = 12,
    peso_real = 55,
    is_completed = true
where workout_session_id = '21110000-0000-4000-8000-000000000301';

do $$
declare v_exercise_id uuid;
begin
  select id into v_exercise_id
  from public.workout_session_exercises
  where workout_session_id = '21110000-0000-4000-8000-000000000301';
  if (select count(*) from public.workout_sets
      where workout_session_exercise_id = v_exercise_id
        and actual_reps = 12
        and actual_weight_kg = 55
        and is_completed) <> 3 then
    raise exception 'el flujo legacy dejó de sincronizar sus series';
  end if;
end;
$$;

update public.workout_sessions
set status = 'completed', ended_at = now()
where id = '21110000-0000-4000-8000-000000000301';

do $$
declare
  v_exercise_id uuid;
  v_version timestamptz;
begin
  select id, updated_at into v_exercise_id, v_version
  from public.workout_session_exercises
  where workout_session_id = '21110000-0000-4000-8000-000000000301';
  begin
    perform public.save_workout_exercise(
      v_exercise_id,
      v_version,
      '{"is_completed":true,"decision":"maintain","decision_note":"","apply_to_routine":false,"notes":"closed","sets":[{"set_number":1,"target_reps":10,"target_weight_kg":40,"target_rir":2,"actual_reps":10,"actual_weight_kg":40,"is_completed":true,"notes":null}]}'::jsonb
    );
    raise exception 'se modificó una sesión completed';
  exception when others then
    if sqlerrm = 'se modificó una sesión completed' then raise; end if;
  end;
end;
$$;

rollback;
