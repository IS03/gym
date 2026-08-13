-- Pruebas transaccionales para 20260813150000_nutrition_schema_foundation.sql.
-- Ejecutar contra una base temporal que ya tenga todas las migraciones. Nunca
-- persiste fixtures: el archivo completo termina en ROLLBACK.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '29000000-0000-0000-0000-000000000001', 'authenticated',
    'authenticated', 'issue29-user-1@example.invalid', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '29000000-0000-0000-0000-000000000002', 'authenticated',
    'authenticated', 'issue29-user-2@example.invalid', '', now(),
    '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.nutrition_goal_periods (
  id, user_id, effective_from, name,
  calories_no_gym, calories_gym,
  protein_no_gym_g, protein_gym_g,
  water_no_gym_l, water_gym_l
) values
  (
    '29000000-0000-0000-0000-000000000101',
    '29000000-0000-0000-0000-000000000001',
    '2026-01-01', 'USER 1', 1800, 2000, 130, 130, 2, 2.5
  ),
  (
    '29000000-0000-0000-0000-000000000102',
    '29000000-0000-0000-0000-000000000002',
    '2026-01-01', 'USER 2', 1900, 2100, 140, 140, 2, 2.5
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '29000000-0000-0000-0000-000000000001',
  true
);

do $$
begin
  if (select count(*) from public.nutrition_goal_periods) <> 1 then
    raise exception 'RLS no aisló nutrition_goal_periods por usuario';
  end if;
end;
$$;

insert into public.day_logs (
  id, user_id, log_date, weight_kg,
  bmr_kcal_snapshot, maintenance_kcal_snapshot, target_kcal_snapshot,
  goal_type_snapshot,
  nutrition_target_kcal_snapshot,
  estimated_expenditure_kcal_snapshot
) values (
  '29000000-0000-0000-0000-000000000201',
  '29000000-0000-0000-0000-000000000001',
  '2026-02-01', 80, 1700, 2300, 1900, 'lose', 2000, 2400
);

insert into public.meal_entries (
  id, user_id, day_log_id, final_calories, final_protein_g,
  final_carbs_g, final_fat_g, source_type
) values
  (
    '29000000-0000-0000-0000-000000000301',
    '29000000-0000-0000-0000-000000000001',
    '29000000-0000-0000-0000-000000000201',
    500, 30, 60, 15, 'manual'
  ),
  (
    '29000000-0000-0000-0000-000000000302',
    '29000000-0000-0000-0000-000000000001',
    '29000000-0000-0000-0000-000000000201',
    300, 20, 40, 10, 'label'
  );

do $$
declare
  v_day public.day_logs;
begin
  select * into v_day
  from public.day_logs
  where id = '29000000-0000-0000-0000-000000000201';

  if v_day.total_calories_consumed <> 800
    or v_day.total_protein_g <> 50
    or v_day.total_carbs_g <> 100
    or v_day.total_fat_g <> 25
    or v_day.delta_vs_target <> -1100
    or v_day.delta_vs_maintenance <> -1500
    or v_day.delta_vs_nutrition_target <> -1200
    or v_day.energy_balance_kcal <> -1600 then
    raise exception 'agregación inicial incorrecta: %', row_to_json(v_day);
  end if;

  if v_day.weight_kg <> 80
    or v_day.bmr_kcal_snapshot <> 1700
    or v_day.goal_type_snapshot <> 'lose' then
    raise exception 'la agregación alteró datos legacy o peso';
  end if;
end;
$$;

update public.meal_entries
set final_calories = 350,
    final_protein_g = 22,
    final_carbs_g = 45,
    final_fat_g = 12
where id = '29000000-0000-0000-0000-000000000302';

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where id = '29000000-0000-0000-0000-000000000201'
      and total_calories_consumed = 850
      and total_protein_g = 52
      and total_carbs_g = 105
      and total_fat_g = 27
  ) then
    raise exception 'editar una comida no recalculó los cuatro agregados';
  end if;
end;
$$;

update public.meal_entries
set deleted_at = now()
where id = '29000000-0000-0000-0000-000000000302';

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where id = '29000000-0000-0000-0000-000000000201'
      and total_calories_consumed = 500
      and total_protein_g = 30
      and total_carbs_g = 60
      and total_fat_g = 15
  ) then
    raise exception 'soft delete no quitó todos los macros del agregado';
  end if;
end;
$$;

do $$
begin
  begin
    insert into public.meal_entries (
      user_id, day_log_id, final_calories, final_carbs_g, source_type
    ) values (
      '29000000-0000-0000-0000-000000000001',
      '29000000-0000-0000-0000-000000000201', 10, -1, 'manual'
    );
    raise exception 'se aceptaron carbohidratos negativos';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.nutrition_goal_periods (
      user_id, effective_from, name, calories_no_gym, calories_gym,
      protein_no_gym_g, protein_gym_g, water_no_gym_l, water_gym_l
    ) values (
      '29000000-0000-0000-0000-000000000001', '2026-01-01',
      'DUPLICATE', 1800, 1800, 130, 130, 2, 2.5
    );
    raise exception 'se aceptó un período duplicado';
  exception when unique_violation then
    null;
  end;

  begin
    update public.nutrition_goal_periods
    set calories_no_gym = 1700
    where id = '29000000-0000-0000-0000-000000000101';
    raise exception 'se reescribió retroactivamente un período';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.meal_entries (
      user_id, day_log_id, final_calories, source_type,
      legacy_import_source
    ) values (
      '29000000-0000-0000-0000-000000000001',
      '29000000-0000-0000-0000-000000000201', 10, 'sheet_import', 'sheet'
    );
    raise exception 'se aceptó metadata legacy incompleta';
  exception when check_violation then
    null;
  end;

  begin
    update public.day_logs
    set nutrition_goal_period_id =
      '29000000-0000-0000-0000-000000000102'
    where id = '29000000-0000-0000-0000-000000000201';
    raise exception 'se aceptó un período perteneciente a otro usuario';
  exception when foreign_key_violation then
    null;
  end;
end;
$$;

insert into public.day_logs (id, user_id, log_date)
values
  (
    '29000000-0000-0000-0000-000000000202',
    '29000000-0000-0000-0000-000000000001', '2026-02-02'
  ),
  (
    '29000000-0000-0000-0000-000000000203',
    '29000000-0000-0000-0000-000000000001', '2026-02-03'
  ),
  (
    '29000000-0000-0000-0000-000000000204',
    '29000000-0000-0000-0000-000000000001', '2026-02-04'
  );

insert into public.meal_entries (
  id, user_id, day_log_id, final_calories, source_type,
  legacy_import_source, legacy_import_id, idempotency_key
) values (
  '29000000-0000-0000-0000-000000000303',
  '29000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000202', 100, 'sheet_import',
  'nutrition-sheet', 'HIST-0001', 'request-0001'
);

do $$
begin
  begin
    insert into public.meal_entries (
      user_id, day_log_id, final_calories, source_type,
      legacy_import_source, legacy_import_id
    ) values (
      '29000000-0000-0000-0000-000000000001',
      '29000000-0000-0000-0000-000000000203', 100, 'sheet_import',
      'nutrition-sheet', 'HIST-0001'
    );
    raise exception 'se aceptó un legacy ID duplicado';
  exception when unique_violation then
    null;
  end;

  begin
    insert into public.meal_entries (
      user_id, day_log_id, final_calories, source_type, idempotency_key
    ) values (
      '29000000-0000-0000-0000-000000000001',
      '29000000-0000-0000-0000-000000000203', 100, 'chatgpt',
      'request-0001'
    );
    raise exception 'se aceptó una idempotency key duplicada';
  exception when unique_violation then
    null;
  end;
end;
$$;

insert into public.meal_entries (
  id, user_id, day_log_id, final_calories, source_type,
  entry_kind, precision_level, legacy_import_source, legacy_import_id
) values (
  '29000000-0000-0000-0000-000000000304',
  '29000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000204', 1700, 'sheet_import',
  'legacy_daily_summary', 'historical', 'nutrition-sheet', 'DAY-20260204'
);

do $$
begin
  begin
    insert into public.meal_entries (
      user_id, day_log_id, final_calories, source_type
    ) values (
      '29000000-0000-0000-0000-000000000001',
      '29000000-0000-0000-0000-000000000204', 100, 'manual'
    );
    raise exception 'se mezcló resumen legacy con comida detallada activa';
  exception when check_violation then
    null;
  end;
end;
$$;

update public.meal_entries
set deleted_at = now()
where id = '29000000-0000-0000-0000-000000000304';

insert into public.meal_entries (
  user_id, day_log_id, final_calories, source_type
) values (
  '29000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000204', 100, 'manual'
);

insert into public.foods (
  user_id, name, serving_quantity, serving_unit,
  calories, protein_g, carbs_g, fat_g, precision_level
) values (
  '29000000-0000-0000-0000-000000000001',
  '  Yogur   natural ', 1, ' pote ', 120, 10, 12, 3, 'label'
);

update public.foods
set description = 'TEST UPDATED_AT'
where user_id = '29000000-0000-0000-0000-000000000001'
  and name = 'YOGUR NATURAL';

do $$
begin
  if not exists (
    select 1 from public.foods
    where user_id = '29000000-0000-0000-0000-000000000001'
      and name = 'YOGUR NATURAL'
      and serving_unit = 'pote'
  ) then
    raise exception 'foods no normalizó nombre/unidad';
  end if;

  begin
    insert into public.foods (
      user_id, name, serving_quantity, serving_unit,
      calories, protein_g, carbs_g, fat_g
    ) values (
      '29000000-0000-0000-0000-000000000001',
      'yogur natural', 1, 'pote', 120, 10, 12, 3
    );
    raise exception 'se aceptó un alimento activo duplicado';
  exception when unique_violation then
    null;
  end;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.foods', 'select')
    or has_table_privilege('anon', 'public.nutrition_goal_periods', 'select')
    or has_table_privilege('anon', 'public.nutrition_import_runs', 'insert') then
    raise exception 'anon recibió privilegios sobre tablas nutricionales';
  end if;

  if not has_function_privilege(
      'authenticated', 'public.recalculate_day_log(uuid)', 'execute'
    ) then
    raise exception 'el trigger no puede ejecutar recalculate_day_log como authenticated';
  end if;

  if has_function_privilege(
      'anon', 'public.recalculate_day_log(uuid)', 'execute'
    )
    or has_function_privilege(
      'anon', 'public.meal_entries_enforce_owner()', 'execute'
    ) then
    raise exception 'funciones internas conservan privilegios innecesarios';
  end if;

  if exists (
    select 1
    from pg_class
    where oid in (
      'public.nutrition_goal_periods'::regclass,
      'public.expenditure_rule_periods'::regclass,
      'public.work_schedule_periods'::regclass,
      'public.nutrition_import_runs'::regclass,
      'public.foods'::regclass
    )
      and not relrowsecurity
  ) then
    raise exception 'alguna tabla nutricional nueva no tiene RLS';
  end if;

  if to_regclass('public.idx_meal_entries_import_run') is null
    or to_regclass('public.idx_day_logs_nutrition_goal_period') is null
    or to_regclass('public.idx_day_logs_expenditure_rule_period') is null
    or to_regclass('public.idx_day_logs_work_schedule_period') is null then
    raise exception 'falta un índice de cobertura para una FK nutricional';
  end if;
end;
$$;

rollback;
