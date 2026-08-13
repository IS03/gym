-- Pruebas transaccionales del motor diario nutricional. Requiere todas las
-- migraciones, incluida 20260813163000_nutrition_day_engine.sql.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '29100000-0000-0000-0000-000000000001', 'authenticated',
    'authenticated', 'issue29-engine-1@example.invalid', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '29100000-0000-0000-0000-000000000002', 'authenticated',
    'authenticated', 'issue29-engine-2@example.invalid', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.profiles (user_id)
values
  ('29100000-0000-0000-0000-000000000001'),
  ('29100000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '29100000-0000-0000-0000-000000000001',
  true
);

-- Resolver una fecha sin configuración ni day_log no inventa valores ni crea
-- una fila. También cubre una fecha anterior al primer período.
do $$
declare
  v_before bigint;
  v_after bigint;
  v_context record;
begin
  select count(*) into v_before from public.day_logs;
  select * into v_context
  from public.resolve_nutrition_context('2025-12-31');
  select count(*) into v_after from public.day_logs;

  if v_before <> v_after
    or v_context.day_log_id is not null
    or v_context.work_effective is not null
    or v_context.gym_effective is distinct from false
    or v_context.nutrition_target_kcal is not null
    or v_context.estimated_expenditure_kcal is not null
    or v_context.delta_vs_nutrition_target is not null
    or v_context.energy_balance_kcal is not null then
    raise exception 'resolver sin períodos inventó contexto o creó un día: %',
      row_to_json(v_context);
  end if;
end;
$$;

insert into public.nutrition_goal_periods (
  id, user_id, effective_from, name,
  calories_no_gym, calories_gym,
  protein_no_gym_g, protein_gym_g,
  water_no_gym_l, water_gym_l
) values
  (
    '29100000-0000-0000-0000-000000000101',
    '29100000-0000-0000-0000-000000000001',
    '2026-01-01', 'PLAN A', 1800, 2000, 130, 150, 2, 2.5
  ),
  (
    '29100000-0000-0000-0000-000000000102',
    '29100000-0000-0000-0000-000000000001',
    '2026-02-01', 'PLAN B', 1900, 2100, 135, 155, 2.1, 2.6
  );

insert into public.expenditure_rule_periods (
  id, user_id, effective_from, name,
  work_gym_kcal, work_no_gym_kcal,
  no_work_gym_kcal, no_work_no_gym_kcal
) values
  (
    '29100000-0000-0000-0000-000000000111',
    '29100000-0000-0000-0000-000000000001',
    '2026-01-01', 'GASTO A', 2350, 2100, 2200, 1950
  ),
  (
    '29100000-0000-0000-0000-000000000112',
    '29100000-0000-0000-0000-000000000001',
    '2026-02-01', 'GASTO B', 2450, 2200, 2300, 2050
  );

insert into public.work_schedule_periods (
  id, user_id, effective_from, name,
  monday, tuesday, wednesday, thursday, friday, saturday, sunday
) values
  (
    '29100000-0000-0000-0000-000000000121',
    '29100000-0000-0000-0000-000000000001',
    '2026-01-01', 'HORARIO A', true, false, false, false, false, false, false
  ),
  (
    '29100000-0000-0000-0000-000000000122',
    '29100000-0000-0000-0000-000000000001',
    '2026-02-01', 'HORARIO B', false, true, false, false, false, false, false
  );

insert into public.day_logs (
  id, user_id, log_date, weight_kg,
  bmr_kcal_snapshot, maintenance_kcal_snapshot, target_kcal_snapshot,
  goal_type_snapshot, steps, water_l, mate_l
) values
  (
    '29100000-0000-0000-0000-000000000201',
    '29100000-0000-0000-0000-000000000001',
    '2026-01-05', 80, 1700, 2300, 1900, 'lose', 12345, 2.25, 0.75
  ),
  (
    '29100000-0000-0000-0000-000000000202',
    '29100000-0000-0000-0000-000000000001', '2026-01-06',
    null, 1700, 2300, 1900, 'lose', 99999, 1.5, 1
  ),
  (
    '29100000-0000-0000-0000-000000000203',
    '29100000-0000-0000-0000-000000000001', '2026-01-09',
    null, 1700, 2300, 1900, 'lose', null, null, null
  ),
  (
    '29100000-0000-0000-0000-000000000204',
    '29100000-0000-0000-0000-000000000001', '2026-01-10',
    null, 1700, 2300, 1900, 'lose', null, null, null
  ),
  (
    '29100000-0000-0000-0000-000000000205',
    '29100000-0000-0000-0000-000000000001', '2026-01-11',
    null, 1700, 2300, 1900, 'lose', null, null, null
  ),
  (
    '29100000-0000-0000-0000-000000000206',
    '29100000-0000-0000-0000-000000000001', '2026-01-12',
    null, 1700, 2300, 1900, 'lose', null, null, null
  ),
  (
    '29100000-0000-0000-0000-000000000207',
    '29100000-0000-0000-0000-000000000001', '2026-01-13',
    null, 1700, 2300, 1900, 'lose', null, null, null
  ),
  (
    '29100000-0000-0000-0000-000000000208',
    '29100000-0000-0000-0000-000000000001', '2026-01-14',
    null, 1700, 2300, 1900, 'lose', null, null, null
  ),
  (
    '29100000-0000-0000-0000-000000000209',
    '29100000-0000-0000-0000-000000000001', '2026-01-19',
    null, 1700, 2300, 1900, 'lose', null, null, null
  );

update public.day_logs
set work_override = true,
    work_override_source = 'manual_test',
    work_override_reason = 'fixture'
where id = '29100000-0000-0000-0000-000000000207';

update public.day_logs
set work_override = false,
    work_override_source = 'manual_test',
    work_override_reason = 'fixture'
where id = '29100000-0000-0000-0000-000000000209';

update public.day_logs
set gym_override = true,
    gym_override_source = 'manual_test',
    gym_override_reason = 'fixture'
where id in (
  '29100000-0000-0000-0000-000000000207',
  '29100000-0000-0000-0000-000000000208'
);

update public.day_logs
set expenditure_override_kcal = 2600
where id = '29100000-0000-0000-0000-000000000207';

insert into public.meal_entries (
  user_id, day_log_id, final_calories, final_protein_g,
  final_carbs_g, final_fat_g, source_type
) values
  (
    '29100000-0000-0000-0000-000000000001',
    '29100000-0000-0000-0000-000000000201', 2200, 100, 250, 70, 'manual'
  ),
  (
    '29100000-0000-0000-0000-000000000001',
    '29100000-0000-0000-0000-000000000202', 1500, 90, 150, 50, 'manual'
  );

insert into public.workout_sessions (id, day_log_id, status, ended_at)
values
  (
    '29100000-0000-0000-0000-000000000301',
    '29100000-0000-0000-0000-000000000203', 'in_progress', null
  ),
  (
    '29100000-0000-0000-0000-000000000302',
    '29100000-0000-0000-0000-000000000204', 'discarded', now()
  ),
  (
    '29100000-0000-0000-0000-000000000303',
    '29100000-0000-0000-0000-000000000205', 'completed', now()
  ),
  (
    '29100000-0000-0000-0000-000000000304',
    '29100000-0000-0000-0000-000000000206', 'completed', now()
  ),
  (
    '29100000-0000-0000-0000-000000000305',
    '29100000-0000-0000-0000-000000000206', 'completed', now()
  ),
  (
    '29100000-0000-0000-0000-000000000306',
    '29100000-0000-0000-0000-000000000208', 'completed', now()
  );

-- Workday true/false y las cuatro combinaciones de gasto. Los pasos extremos
-- no afectan el valor derivado.
do $$
declare
  v_work_no_gym record;
  v_no_work_no_gym record;
  v_no_work_gym record;
  v_work_gym record;
begin
  select * into v_work_no_gym
  from public.resolve_nutrition_context('2026-01-05');
  select * into v_no_work_no_gym
  from public.resolve_nutrition_context('2026-01-06');
  select * into v_no_work_gym
  from public.resolve_nutrition_context('2026-01-11');
  select * into v_work_gym
  from public.resolve_nutrition_context('2026-01-12');

  if v_work_no_gym.work_effective is distinct from true
    or v_work_no_gym.work_source <> 'schedule'
    or v_work_no_gym.gym_effective
    or v_work_no_gym.estimated_expenditure_kcal <> 2100
    or v_no_work_no_gym.work_effective
    or v_no_work_no_gym.estimated_expenditure_kcal <> 1950
    or not v_no_work_gym.gym_effective
    or v_no_work_gym.estimated_expenditure_kcal <> 2200
    or not v_work_gym.work_effective
    or not v_work_gym.gym_effective
    or v_work_gym.estimated_expenditure_kcal <> 2350 then
    raise exception 'matriz de gasto o schedule incorrectos';
  end if;
end;
$$;

-- in_progress y discarded no cuentan; dos completed siguen siendo boolean;
-- override funciona sólo como fallback y completed conserva precedencia.
do $$
declare
  v_in_progress record;
  v_discarded record;
  v_two_completed record;
  v_override record;
  v_completed_override record;
begin
  select * into v_in_progress
  from public.resolve_nutrition_context('2026-01-09');
  select * into v_discarded
  from public.resolve_nutrition_context('2026-01-10');
  select * into v_two_completed
  from public.resolve_nutrition_context('2026-01-12');
  select * into v_override
  from public.resolve_nutrition_context('2026-01-13');
  select * into v_completed_override
  from public.resolve_nutrition_context('2026-01-14');

  if v_in_progress.gym_effective or v_in_progress.gym_source <> 'none'
    or v_discarded.gym_effective or v_discarded.gym_source <> 'none'
    or not v_two_completed.gym_effective
    or v_two_completed.gym_source <> 'workout'
    or v_two_completed.nutrition_target_kcal <> 2000
    or not v_override.gym_effective
    or v_override.gym_source <> 'override'
    or v_override.estimated_expenditure_kcal <> 2600
    or not v_completed_override.gym_effective
    or v_completed_override.gym_source <> 'workout' then
    raise exception 'precedencia de gym/override incorrecta';
  end if;
end;
$$;

-- Targets con/sin gym y work overrides true/false.
do $$
declare
  v_no_gym record;
  v_gym record;
  v_work_override_true record;
  v_work_override_false record;
begin
  select * into v_no_gym
  from public.resolve_nutrition_context('2026-01-05');
  select * into v_gym
  from public.resolve_nutrition_context('2026-01-11');
  select * into v_work_override_true
  from public.resolve_nutrition_context('2026-01-13');
  select * into v_work_override_false
  from public.resolve_nutrition_context('2026-01-19');

  if v_no_gym.nutrition_target_kcal <> 1800
    or v_no_gym.protein_target_g <> 130
    or v_no_gym.water_target_l <> 2
    or v_gym.nutrition_target_kcal <> 2000
    or v_gym.protein_target_g <> 150
    or v_gym.water_target_l <> 2.5
    or not v_work_override_true.work_effective
    or v_work_override_true.work_source <> 'override'
    or v_work_override_false.work_effective
    or v_work_override_false.work_source <> 'override' then
    raise exception 'targets u overrides de trabajo incorrectos';
  end if;
end;
$$;

-- Materialización, métricas positivas/negativas y preservación de peso,
-- snapshots legacy, contexto de agua/mate/pasos y filas de entrenamiento.
select public.refresh_nutrition_day(
  '29100000-0000-0000-0000-000000000201'
);
select public.refresh_nutrition_day(
  '29100000-0000-0000-0000-000000000202'
);

do $$
declare
  v_positive public.day_logs;
  v_negative public.day_logs;
begin
  select * into v_positive from public.day_logs
  where id = '29100000-0000-0000-0000-000000000201';
  select * into v_negative from public.day_logs
  where id = '29100000-0000-0000-0000-000000000202';

  if v_positive.delta_vs_nutrition_target <> 400
    or v_positive.energy_balance_kcal <> 100
    or v_negative.delta_vs_nutrition_target <> -300
    or v_negative.energy_balance_kcal <> -450
    or v_positive.weight_kg <> 80
    or v_positive.bmr_kcal_snapshot <> 1700
    or v_positive.maintenance_kcal_snapshot <> 2300
    or v_positive.target_kcal_snapshot <> 1900
    or v_positive.goal_type_snapshot <> 'lose'
    or v_positive.steps <> 12345
    or v_positive.water_l <> 2.25
    or v_positive.mate_l <> 0.75
    or v_positive.nutrition_resolved_at is null then
    raise exception 'materialización, métricas o preservación incorrectas';
  end if;

  if (select count(*) from public.workout_sessions) <> 6 then
    raise exception 'refresh alteró sesiones';
  end if;
end;
$$;

-- get_or_create inicializa exactamente effective_from con el período nuevo.
do $$
declare
  v_new public.day_logs;
begin
  v_new := public.get_or_create_day_log('2026-02-01');
  if v_new.nutrition_goal_period_id <>
      '29100000-0000-0000-0000-000000000102'
    or v_new.expenditure_rule_period_id <>
      '29100000-0000-0000-0000-000000000112'
    or v_new.work_schedule_period_id <>
      '29100000-0000-0000-0000-000000000122'
    or v_new.nutrition_target_kcal_snapshot <> 1900
    or v_new.protein_target_g_snapshot <> 135
    or v_new.water_target_l_snapshot <> 2.1
    or v_new.estimated_expenditure_kcal_snapshot <> 2050 then
    raise exception 'get_or_create no inicializó el cambio de período exacto';
  end if;
end;
$$;

-- PR 3 sincroniza la fuente explícita al escribirla; una lectura posterior con
-- get-or-create debe devolver ese snapshot sin volver a reinterpretarlo.
update public.day_logs
set work_override = false,
    work_override_source = 'manual_test',
    work_override_reason = 'cambio posterior'
where id = '29100000-0000-0000-0000-000000000201';

do $$
declare
  v_existing public.day_logs;
begin
  v_existing := public.get_or_create_day_log('2026-01-05');
  if v_existing.work_effective_snapshot is distinct from false
    or v_existing.work_source_snapshot <> 'override' then
    raise exception 'get_or_create reescribió snapshots de un día existente';
  end if;
end;
$$;

-- RLS y permisos mínimos.
do $$
begin
  if has_function_privilege(
      'anon', 'public.resolve_nutrition_context(date)', 'execute'
    )
    or has_function_privilege(
      'anon', 'public.refresh_nutrition_day(uuid)', 'execute'
    ) then
    raise exception 'anon recibió permisos sobre el motor nutricional';
  end if;

  if not has_function_privilege(
      'authenticated', 'public.resolve_nutrition_context(date)', 'execute'
    )
    or not has_function_privilege(
      'authenticated', 'public.refresh_nutrition_day(uuid)', 'execute'
    ) then
    raise exception 'authenticated no puede ejecutar el motor';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '29100000-0000-0000-0000-000000000002',
  true
);

do $$
begin
  begin
    perform public.refresh_nutrition_day(
      '29100000-0000-0000-0000-000000000201'
    );
    raise exception 'otro usuario refrescó un day_log ajeno';
  exception when others then
    if sqlerrm <> 'day_log_not_found' then
      raise;
    end if;
  end;
end;
$$;

rollback;
