-- Pruebas transaccionales del PR 3. El archivo completo termina en ROLLBACK y
-- no deja perfiles, períodos, sesiones ni day_logs de prueba.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '29300000-0000-0000-0000-000000000001', 'authenticated',
  'authenticated', 'issue29-energy-sync@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '29300000-0000-0000-0000-000000000001',
  true
);

-- Los valores legacy se cargan adrede distintos de BMR: la derivación nueva
-- debe conservarlos, no igualarlos ni usarlos como target/gasto nutricional.
insert into public.profiles (
  user_id, birth_date, sex, height_cm, current_weight_kg,
  maintenance_kcal_current, target_kcal_current, goal_type
) values (
  '29300000-0000-0000-0000-000000000001',
  '2000-01-01', 'male', 180, 80, 2400, 2100, 'lose'
);

insert into public.day_logs (
  id, user_id, log_date, weight_kg,
  bmr_kcal_snapshot, maintenance_kcal_snapshot, target_kcal_snapshot,
  goal_type_snapshot, total_calories_consumed,
  nutrition_target_kcal_snapshot,
  estimated_expenditure_kcal_snapshot
) values (
  '29300000-0000-0000-0000-000000000201',
  '29300000-0000-0000-0000-000000000001',
  ((now() at time zone 'America/Argentina/Cordoba')::date - 1),
  null, 1111, 2222, 1888, 'lose', 1700, null, null
);

do $$
declare
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
  v_day public.day_logs;
  v_profile public.profiles;
begin
  v_day := public.get_or_create_day_log(v_today);
  select * into v_profile from public.profiles
  where user_id = '29300000-0000-0000-0000-000000000001';

  if v_day.bmr_kcal_snapshot is distinct from v_profile.bmr_kcal_current
    or v_day.maintenance_kcal_snapshot is not null
    or v_day.target_kcal_snapshot is not null
    or v_day.nutrition_target_kcal_snapshot is not null
    or v_day.estimated_expenditure_kcal_snapshot is not null
    or v_profile.maintenance_kcal_current <> 2400
    or v_profile.target_kcal_current <> 2100 then
    raise exception 'día nuevo mezcló BMR con legacy o nutrición';
  end if;
end;
$$;

-- Altura, sexo y nacimiento recalculan BMR y sincronizan sólo hoy.
do $$
declare
  v_before integer;
  v_after_height integer;
  v_after_sex integer;
  v_after_birth integer;
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
begin
  select bmr_kcal_current into v_before from public.profiles
  where user_id = '29300000-0000-0000-0000-000000000001';

  update public.profiles set height_cm = 181
  where user_id = '29300000-0000-0000-0000-000000000001';
  select bmr_kcal_current into v_after_height from public.profiles
  where user_id = '29300000-0000-0000-0000-000000000001';

  update public.profiles set sex = 'female'
  where user_id = '29300000-0000-0000-0000-000000000001';
  select bmr_kcal_current into v_after_sex from public.profiles
  where user_id = '29300000-0000-0000-0000-000000000001';

  update public.profiles set birth_date = '1995-01-01'
  where user_id = '29300000-0000-0000-0000-000000000001';
  select bmr_kcal_current into v_after_birth from public.profiles
  where user_id = '29300000-0000-0000-0000-000000000001';

  if v_after_height = v_before
    or v_after_sex = v_after_height
    or v_after_birth = v_after_sex then
    raise exception 'una fuente antropométrica no recalculó BMR';
  end if;

  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = v_today
      and bmr_kcal_snapshot = v_after_birth
      and maintenance_kcal_snapshot is null
      and target_kcal_snapshot is null
  ) then
    raise exception 'hoy no recibió exclusivamente el BMR nuevo';
  end if;

  if not exists (
    select 1 from public.day_logs
    where id = '29300000-0000-0000-0000-000000000201'
      and bmr_kcal_snapshot = 1111
      and maintenance_kcal_snapshot = 2222
      and target_kcal_snapshot = 1888
      and goal_type_snapshot = 'lose'
  ) then
    raise exception 'la antropometría reescribió snapshots históricos';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = '29300000-0000-0000-0000-000000000001'
      and maintenance_kcal_current = 2400
      and target_kcal_current = 2100
  ) then
    raise exception 'la derivación de BMR destruyó valores legacy';
  end if;
end;
$$;

-- El peso conserva el flujo day_logs -> profile -> BMR -> snapshot de hoy.
do $$
declare
  v_before integer;
  v_after integer;
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
begin
  select bmr_kcal_current into v_before from public.profiles
  where user_id = '29300000-0000-0000-0000-000000000001';

  update public.day_logs set weight_kg = 75
  where user_id = '29300000-0000-0000-0000-000000000001'
    and log_date = v_today;

  select bmr_kcal_current into v_after from public.profiles
  where user_id = '29300000-0000-0000-0000-000000000001';

  if v_after = v_before
    or not exists (
      select 1 from public.profiles
      where user_id = '29300000-0000-0000-0000-000000000001'
        and current_weight_kg = 75
    )
    or not exists (
      select 1 from public.day_logs
      where user_id = '29300000-0000-0000-0000-000000000001'
        and log_date = v_today
        and weight_kg = 75
        and bmr_kcal_snapshot = v_after
    ) then
    raise exception 'peso, perfil y BMR no quedaron sincronizados';
  end if;
end;
$$;

-- Cada INSERT que pasa a ser vigente refresca hoy sin tocar ayer.
insert into public.work_schedule_periods (
  id, user_id, effective_from, name,
  monday, tuesday, wednesday, thursday, friday, saturday, sunday
) values (
  '29300000-0000-0000-0000-000000000301',
  '29300000-0000-0000-0000-000000000001',
  (now() at time zone 'America/Argentina/Cordoba')::date,
  'SCHEDULE TODAY', true, true, true, true, true, true, true
);

insert into public.expenditure_rule_periods (
  id, user_id, effective_from, name,
  work_gym_kcal, work_no_gym_kcal,
  no_work_gym_kcal, no_work_no_gym_kcal
) values (
  '29300000-0000-0000-0000-000000000302',
  '29300000-0000-0000-0000-000000000001',
  (now() at time zone 'America/Argentina/Cordoba')::date,
  'EXPENDITURE TODAY', 2500, 2200, 2300, 2000
);

insert into public.nutrition_goal_periods (
  id, user_id, effective_from, name,
  calories_no_gym, calories_gym,
  protein_no_gym_g, protein_gym_g,
  water_no_gym_l, water_gym_l
) values (
  '29300000-0000-0000-0000-000000000303',
  '29300000-0000-0000-0000-000000000001',
  (now() at time zone 'America/Argentina/Cordoba')::date,
  'GOAL TODAY', 2000, 2200, 130, 150, 2, 2.5
);

do $$
declare
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
begin
  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = v_today
      and work_effective_snapshot
      and work_source_snapshot = 'schedule'
      and gym_effective_snapshot is false
      and nutrition_target_kcal_snapshot = 2000
      and protein_target_g_snapshot = 130
      and water_target_l_snapshot = 2
      and estimated_expenditure_kcal_snapshot = 2200
  ) then
    raise exception 'los períodos vigentes no refrescaron hoy';
  end if;

  if not exists (
    select 1 from public.day_logs
    where id = '29300000-0000-0000-0000-000000000201'
      and nutrition_target_kcal_snapshot is null
      and estimated_expenditure_kcal_snapshot is null
      and bmr_kcal_snapshot = 1111
  ) then
    raise exception 'insertar períodos actuales reescribió ayer';
  end if;
end;
$$;

-- Un período histórico posterior en tiempo de inserción, pero anterior a la
-- versión vigente, no refresca ni reinterpreta días materializados.
insert into public.nutrition_goal_periods (
  id, user_id, effective_from, name,
  calories_no_gym, calories_gym,
  protein_no_gym_g, protein_gym_g,
  water_no_gym_l, water_gym_l
) values (
  '29300000-0000-0000-0000-000000000304',
  '29300000-0000-0000-0000-000000000001',
  ((now() at time zone 'America/Argentina/Cordoba')::date - 1),
  'HISTORICAL GOAL', 1700, 1900, 120, 140, 1.8, 2.3
);

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where id = '29300000-0000-0000-0000-000000000201'
      and nutrition_target_kcal_snapshot is null
      and estimated_expenditure_kcal_snapshot is null
  ) then
    raise exception 'un período histórico reescribió automáticamente ayer';
  end if;

  begin
    update public.nutrition_goal_periods
    set calories_no_gym = 1600
    where id = '29300000-0000-0000-0000-000000000304';
    raise exception 'se permitió reescribir un período versionado';
  exception when check_violation then
    null;
  end;
end;
$$;

-- Overrides refrescan el mismo día. Completar las sentencias demuestra además
-- que el update de snapshots no reingresa en el trigger de columnas fuente.
do $$
declare
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
begin
  update public.day_logs
  set work_override = false,
      work_override_source = 'test',
      work_override_reason = 'fixture'
  where user_id = '29300000-0000-0000-0000-000000000001'
    and log_date = v_today;

  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = v_today
      and work_effective_snapshot is false
      and work_source_snapshot = 'override'
      and estimated_expenditure_kcal_snapshot = 2000
  ) then
    raise exception 'work_override no refrescó contexto/gasto';
  end if;

  update public.day_logs
  set gym_override = true,
      gym_override_source = 'test',
      gym_override_reason = 'fixture'
  where user_id = '29300000-0000-0000-0000-000000000001'
    and log_date = v_today;

  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = v_today
      and gym_effective_snapshot
      and gym_source_snapshot = 'override'
      and nutrition_target_kcal_snapshot = 2200
      and estimated_expenditure_kcal_snapshot = 2300
  ) then
    raise exception 'gym_override no refrescó contexto/target';
  end if;

  update public.day_logs set expenditure_override_kcal = 3100
  where user_id = '29300000-0000-0000-0000-000000000001'
    and log_date = v_today;

  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = v_today
      and estimated_expenditure_kcal_snapshot = 3100
  ) then
    raise exception 'expenditure_override no refrescó gasto';
  end if;

  update public.day_logs
  set gym_override = null,
      gym_override_source = null,
      gym_override_reason = null,
      expenditure_override_kcal = null
  where user_id = '29300000-0000-0000-0000-000000000001'
    and log_date = v_today;
end;
$$;

-- Transiciones reales del enum: una o varias completed producen un único gym.
insert into public.workout_sessions (id, day_log_id, status)
select
  '29300000-0000-0000-0000-000000000401', id, 'in_progress'
from public.day_logs
where user_id = '29300000-0000-0000-0000-000000000001'
  and log_date = (now() at time zone 'America/Argentina/Cordoba')::date;

update public.workout_sessions
set status = 'completed', ended_at = now()
where id = '29300000-0000-0000-0000-000000000401';

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = (now() at time zone 'America/Argentina/Cordoba')::date
      and gym_effective_snapshot
      and gym_source_snapshot = 'workout'
      and nutrition_target_kcal_snapshot = 2200
  ) then
    raise exception 'in_progress -> completed no refrescó gym';
  end if;
end;
$$;

update public.workout_sessions set status = 'discarded'
where id = '29300000-0000-0000-0000-000000000401';

do $$
begin
  if exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = (now() at time zone 'America/Argentina/Cordoba')::date
      and gym_effective_snapshot
  ) then
    raise exception 'completed -> discarded no quitó el último gym';
  end if;
end;
$$;

update public.workout_sessions set status = 'completed'
where id = '29300000-0000-0000-0000-000000000401';

insert into public.workout_sessions (id, day_log_id, status, ended_at)
select
  '29300000-0000-0000-0000-000000000402', id, 'completed', now()
from public.day_logs
where user_id = '29300000-0000-0000-0000-000000000001'
  and log_date = (now() at time zone 'America/Argentina/Cordoba')::date;

update public.workout_sessions set status = 'discarded'
where id = '29300000-0000-0000-0000-000000000401';

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = (now() at time zone 'America/Argentina/Cordoba')::date
      and gym_effective_snapshot
      and gym_source_snapshot = 'workout'
  ) then
    raise exception 'descartar una de dos completed quitó gym';
  end if;
end;
$$;

update public.workout_sessions set status = 'discarded'
where id = '29300000-0000-0000-0000-000000000402';

do $$
begin
  if exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = (now() at time zone 'America/Argentina/Cordoba')::date
      and gym_effective_snapshot
  ) then
    raise exception 'descartar la última completed no resolvió false';
  end if;

  if (select count(*) from public.workout_sessions
      where id in (
        '29300000-0000-0000-0000-000000000401',
        '29300000-0000-0000-0000-000000000402'
      )) <> 2
    or exists (
      select 1 from public.workout_sessions
      where id in (
        '29300000-0000-0000-0000-000000000401',
        '29300000-0000-0000-0000-000000000402'
      )
        and (day_log_id is null or user_id <>
          '29300000-0000-0000-0000-000000000001')
    ) then
    raise exception 'sincronizar nutrición alteró identidad/relación de sesiones';
  end if;

  if exists (
    select 1 from public.workout_session_exercises
    where workout_session_id in (
      '29300000-0000-0000-0000-000000000401',
      '29300000-0000-0000-0000-000000000402'
    )
  ) then
    raise exception 'el trigger nutricional creó ejercicios de entrenamiento';
  end if;
end;
$$;

-- Si desaparece la última completed, el override sigue siendo fallback.
update public.day_logs
set gym_override = true,
    gym_override_source = 'test',
    gym_override_reason = 'fallback fixture'
where user_id = '29300000-0000-0000-0000-000000000001'
  and log_date = (now() at time zone 'America/Argentina/Cordoba')::date;

update public.workout_sessions set status = 'completed'
where id = '29300000-0000-0000-0000-000000000402';
update public.workout_sessions set status = 'discarded'
where id = '29300000-0000-0000-0000-000000000402';

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where user_id = '29300000-0000-0000-0000-000000000001'
      and log_date = (now() at time zone 'America/Argentina/Cordoba')::date
      and gym_effective_snapshot
      and gym_source_snapshot = 'override'
  ) then
    raise exception 'quitar la última completed no volvió al override';
  end if;
end;
$$;

-- Seguridad mínima de funciones y ausencia de consumers legacy en el motor.
reset role;

do $$
begin
  if has_function_privilege(
      'anon', 'public.trg_profiles_derive_bmr()', 'execute'
    )
    or has_function_privilege(
      'anon', 'public.trg_workout_sessions_refresh_nutrition()', 'execute'
    )
    or has_function_privilege(
      'anon', 'public.trg_versioned_period_refresh_today()', 'execute'
    ) then
    raise exception 'anon recibió execute sobre triggers internos';
  end if;

  if not has_function_privilege(
      'authenticated', 'public.refresh_nutrition_day(uuid)', 'execute'
    )
    or has_function_privilege(
      'anon', 'public.refresh_nutrition_day(uuid)', 'execute'
    ) then
    raise exception 'permisos de refresh_nutrition_day incorrectos';
  end if;

  if position(
      'new.maintenance_kcal_current :=' in
      pg_get_functiondef('public.trg_profiles_derive_bmr()'::regprocedure)
    ) > 0
    or position(
      'new.target_kcal_current :=' in
      pg_get_functiondef('public.trg_profiles_derive_bmr()'::regprocedure)
    ) > 0 then
    raise exception 'el motor BMR todavía deriva maintenance/target legacy';
  end if;
end;
$$;

rollback;
