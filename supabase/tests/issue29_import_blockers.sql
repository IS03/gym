-- PR 5B: schema para importación sin pérdida. Todos los datos se revierten.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '29500000-0000-0000-0000-000000000001', 'authenticated',
  'authenticated', 'issue29-pr5b@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '29500000-0000-0000-0000-000000000001', true);

insert into public.nutrition_import_runs (
  id, user_id, source_name, source_sha256
) values (
  '29500000-0000-0000-0000-000000000010',
  '29500000-0000-0000-0000-000000000001',
  'fixture sintético',
  repeat('a', 64)
);

insert into public.foods (
  user_id, name, serving_quantity, serving_unit,
  calories, protein_g, carbs_g, fat_g
) values
  ('29500000-0000-0000-0000-000000000001', 'COMPLETO', 1, 'unidad', 100, 10, 20, 3),
  ('29500000-0000-0000-0000-000000000001', 'PARCIAL', 1, 'unidad', 35, null, null, null),
  ('29500000-0000-0000-0000-000000000001', 'SIN CALORIAS', 1, 'unidad', null, 5, 0, null),
  ('29500000-0000-0000-0000-000000000001', 'CERO CONOCIDO', 1, 'unidad', 0, null, null, null);

do $$
begin
  begin
    insert into public.foods (
      user_id, name, serving_quantity, serving_unit,
      calories, protein_g, carbs_g, fat_g
    ) values (
      '29500000-0000-0000-0000-000000000001', 'TODO DESCONOCIDO', 1, 'unidad',
      null, null, null, null
    );
    raise exception 'foods aceptó todos los valores nutricionales nulos';
  exception when check_violation then null;
  end;

  begin
    insert into public.foods (
      user_id, name, serving_quantity, serving_unit,
      calories, protein_g, carbs_g, fat_g
    ) values (
      '29500000-0000-0000-0000-000000000001', 'NEGATIVO', 1, 'unidad',
      10, -1, null, null
    );
    raise exception 'foods aceptó un valor nutricional negativo';
  exception when check_violation then null;
  end;
end;
$$;

insert into public.body_measurements (
  user_id, measured_on, waist_cm, abdomen_cm, chest_cm, hip_cm,
  arm_right_cm, arm_left_cm, thigh_right_cm, thigh_left_cm,
  calf_right_cm, calf_left_cm, condition, notes,
  legacy_import_source, legacy_import_id, import_run_id,
  quality_status, quality_note, source_payload
) values (
  '29500000-0000-0000-0000-000000000001', '2026-07-01', 80, 82, 95, 90,
  110, 31, null, 50, 17, 35, 'CONDICION SINTETICA', 'NOTA SINTETICA',
  'synthetic:body:v1', 'SYN-BODY-1', '29500000-0000-0000-0000-000000000010',
  'suspect', 'asimetría sintética', '{"fixture":"synthetic","arm_right":"110"}'::jsonb
);

do $$
begin
  if not exists (
    select 1 from public.body_measurements
    where legacy_import_id = 'SYN-BODY-1'
      and arm_right_cm = 110
      and arm_left_cm = 31
      and calf_right_cm = 17
      and calf_left_cm = 35
      and arm_cm is null
      and thigh_cm is null
      and quality_status = 'suspect'
      and source_payload ->> 'arm_right' = '110'
  ) then
    raise exception 'la medición sospechosa no se preservó sin promedios';
  end if;

  begin
    insert into public.body_measurements (
      user_id, measured_on, waist_cm, legacy_import_source, legacy_import_id
    ) values (
      '29500000-0000-0000-0000-000000000001', '2026-07-02', 80,
      'synthetic:body:v1', 'SYN-BODY-1'
    );
    raise exception 'body_measurements aceptó un legacy ID duplicado';
  exception when unique_violation then null;
  end;
end;
$$;

insert into public.nutrition_events (
  user_id, event_date, event_type, intensity, planned, alcohol,
  drinks_equivalent, event_calories, context, notes, origin, source_type,
  legacy_import_source, legacy_import_id, import_run_id
) values
  (
    '29500000-0000-0000-0000-000000000001', '2026-07-01', 'EVENTO A', 'ALTA',
    true, true, 3, 500, 'CONTEXTO', 'NOTA', 'FIXTURE', 'sheet_import',
    'synthetic:events:v1', 'SYN-EVENT-1', '29500000-0000-0000-0000-000000000010'
  ),
  (
    '29500000-0000-0000-0000-000000000001', '2026-07-02', 'EVENTO B', null,
    false, false, 0, null, null, null, null, 'sheet_import',
    'synthetic:events:v1', 'SYN-EVENT-2', '29500000-0000-0000-0000-000000000010'
  ),
  (
    '29500000-0000-0000-0000-000000000001', '2026-07-03', 'EVENTO C', null,
    null, null, null, null, null, null, null, 'sheet_import',
    'synthetic:events:v1', 'SYN-EVENT-3', '29500000-0000-0000-0000-000000000010'
  );

do $$
begin
  begin
    insert into public.nutrition_events (
      user_id, event_date, event_type, source_type,
      legacy_import_source, legacy_import_id
    ) values (
      '29500000-0000-0000-0000-000000000001', '2026-07-04', 'DUPLICADO',
      'sheet_import', 'synthetic:events:v1', 'SYN-EVENT-1'
    );
    raise exception 'nutrition_events aceptó un legacy ID duplicado';
  exception when unique_violation then null;
  end;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.nutrition_events', 'select')
    or has_table_privilege('anon', 'public.nutrition_events', 'insert')
    or has_table_privilege('anon', 'public.nutrition_events', 'update')
    or has_table_privilege('anon', 'public.nutrition_events', 'delete') then
    raise exception 'anon recibió privilegios sobre nutrition_events';
  end if;
end;
$$;

rollback;
