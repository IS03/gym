-- M4.3-1 EXPAND: configuration/physical profile only. Existing Web signatures
-- and resolver semantics remain intact. No historical rewrite or read writes.
begin;

-- Statement locks run BEFORE row locks. Web RPCs, direct weekday/profile edits
-- and weight-trigger writes participate, including the absent-first-row race.
create function public.mobile_configuration_write_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is not null then perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,413)); end if;
 return null;
end;
$$;
create trigger tr_mobile_plan_write_guard before insert or update or delete on public.nutrition_plan_periods for each statement execute function public.mobile_configuration_write_guard();
create trigger tr_mobile_weekday_write_guard before insert or update or delete on public.nutrition_plan_weekdays for each statement execute function public.mobile_configuration_write_guard();
create trigger tr_mobile_energy_write_guard before insert or update or delete on public.energy_config_periods for each statement execute function public.mobile_configuration_write_guard();
create trigger tr_mobile_profile_write_guard before insert or update or delete on public.profiles for each statement execute function public.mobile_configuration_write_guard();
create trigger tr_mobile_weight_write_guard before update of weight_kg on public.day_logs for each statement execute function public.mobile_configuration_write_guard();
create trigger tr_mobile_weight_delete_guard before delete on public.day_logs for each statement execute function public.mobile_configuration_write_guard();
create trigger tr_mobile_goal_write_guard before insert or update or delete on public.nutrition_goal_periods for each statement execute function public.mobile_configuration_write_guard();
create trigger tr_mobile_legacy_energy_write_guard before insert or update or delete on public.expenditure_rule_periods for each statement execute function public.mobile_configuration_write_guard();

create or replace function public.save_nutrition_plan_v2(
  p_name text,
  p_base_water_l numeric,
  p_training_calorie_delta_kcal integer,
  p_training_water_delta_l numeric,
  p_weekdays jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_plan_id uuid;
  v_day_log_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,413));
  if nullif(pg_catalog.btrim(p_name), '') is null then raise exception 'invalid_plan_name'; end if;
  if pg_catalog.jsonb_typeof(p_weekdays) <> 'array'
    or pg_catalog.jsonb_array_length(p_weekdays) <> 7 then
    raise exception 'invalid_weekdays';
  end if;
  if (
    select pg_catalog.count(distinct x.weekday)
    from pg_catalog.jsonb_to_recordset(p_weekdays) as x(weekday smallint, calorie_target_kcal integer, protein_target_g numeric)
    where x.weekday between 1 and 7
  ) <> 7 then
    raise exception 'invalid_weekdays';
  end if;

  insert into public.nutrition_plan_periods (
    user_id, effective_from, name, base_water_l,
    training_calorie_delta_kcal, training_water_delta_l
  ) values (
    v_user_id, v_today, pg_catalog.btrim(p_name), p_base_water_l,
    p_training_calorie_delta_kcal, p_training_water_delta_l
  )
  on conflict (user_id, effective_from) do update set
    name = excluded.name,
    base_water_l = excluded.base_water_l,
    training_calorie_delta_kcal = excluded.training_calorie_delta_kcal,
    training_water_delta_l = excluded.training_water_delta_l
  returning id into v_plan_id;

  insert into public.nutrition_plan_weekdays (
    plan_id, user_id, weekday, calorie_target_kcal, protein_target_g
  )
  select v_plan_id, v_user_id, x.weekday, x.calorie_target_kcal, x.protein_target_g
  from pg_catalog.jsonb_to_recordset(p_weekdays) as x(
    weekday smallint, calorie_target_kcal integer, protein_target_g numeric
  )
  on conflict (plan_id, weekday) do update set
    calorie_target_kcal = excluded.calorie_target_kcal,
    protein_target_g = excluded.protein_target_g;

  select d.id into v_day_log_id from public.day_logs d
  where d.user_id = v_user_id and d.log_date = v_today;
  if v_day_log_id is not null then perform public.refresh_nutrition_day(v_day_log_id); end if;
  return v_plan_id;
end;
$$;

create or replace function public.save_energy_config_v2(
  p_activity_level text,
  p_training_expenditure_delta_kcal integer,
  p_base_expenditure_mode text,
  p_custom_base_expenditure_kcal integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_factor numeric(4,2);
  v_config_id uuid;
  v_day_log_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text,413));
  v_factor := case p_activity_level
    when 'low' then 1.20
    when 'moderate' then 1.25
    when 'high' then 1.35
    else null
  end;
  if v_factor is null then raise exception 'invalid_activity_level'; end if;
  if p_base_expenditure_mode not in ('automatic', 'custom') then
    raise exception 'invalid_base_expenditure_mode';
  end if;
  if (p_base_expenditure_mode = 'automatic' and p_custom_base_expenditure_kcal is not null)
    or (p_base_expenditure_mode = 'custom' and p_custom_base_expenditure_kcal is null) then
    raise exception 'invalid_custom_base_expenditure';
  end if;

  insert into public.energy_config_periods (
    user_id, effective_from, activity_level, activity_factor,
    training_expenditure_delta_kcal, formula_version,
    base_expenditure_mode, custom_base_expenditure_kcal
  ) values (
    v_user_id, v_today, p_activity_level, v_factor,
    p_training_expenditure_delta_kcal, 'harris_benedict_product_v1',
    p_base_expenditure_mode, p_custom_base_expenditure_kcal
  )
  on conflict (user_id, effective_from) do update set
    activity_level = excluded.activity_level,
    activity_factor = excluded.activity_factor,
    training_expenditure_delta_kcal = excluded.training_expenditure_delta_kcal,
    formula_version = excluded.formula_version,
    base_expenditure_mode = excluded.base_expenditure_mode,
    custom_base_expenditure_kcal = excluded.custom_base_expenditure_kcal
  returning id into v_config_id;

  select d.id into v_day_log_id from public.day_logs d
  where d.user_id = v_user_id and d.log_date = v_today;
  if v_day_log_id is not null then perform public.refresh_nutrition_day(v_day_log_id); end if;
  return v_config_id;
end;
$$;

-- The source representation is private input to HTTP adapters, never a raw DTO.
create function public.mobile_configuration_state(p_operation text)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare u uuid:=(select auth.uid()); today date:=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 parent jsonb; children jsonb; legacy jsonb; physical jsonb; latest jsonb; today_weight jsonb; source jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if p_operation='plan' then
  select to_jsonb(p) into parent from public.nutrition_plan_periods p where user_id=u and effective_from<=today order by effective_from desc limit 1;
  select coalesce(jsonb_agg(to_jsonb(w) order by weekday),'[]'::jsonb) into children from public.nutrition_plan_weekdays w where user_id=u and plan_id=(parent->>'id')::uuid;
  if parent is null then select to_jsonb(g) into legacy from public.nutrition_goal_periods g where user_id=u and effective_from<=today order by effective_from desc limit 1; end if;
  source:=jsonb_build_object('parent',parent,'weekdays',children,'legacy',legacy);
 elsif p_operation in ('energy','physical') then
  select jsonb_build_object('birth_date',birth_date,'sex',sex,'height_cm',height_cm,'current_weight_kg',current_weight_kg,'bmr_kcal_current',bmr_kcal_current,'updated_at',updated_at)
  into physical from public.profiles where user_id=u;
  if p_operation='energy' then
   select to_jsonb(e) into parent from public.energy_config_periods e where user_id=u and effective_from<=today order by effective_from desc limit 1;
   if parent is null then select to_jsonb(e) into legacy from public.expenditure_rule_periods e where user_id=u and effective_from<=today order by effective_from desc limit 1; end if;
   source:=jsonb_build_object('parent',parent,'legacy',legacy,'profile',physical);
  else
   select jsonb_build_object('date',log_date,'value',weight_kg,'updatedAt',updated_at) into latest from public.day_logs where user_id=u and weight_kg is not null order by log_date desc limit 1;
   select jsonb_build_object('date',log_date,'value',weight_kg,'updatedAt',updated_at) into today_weight from public.day_logs where user_id=u and log_date=today and weight_kg is not null;
   source:=jsonb_build_object('profile',physical,'latestWeight',latest,'todayWeight',today_weight);
  end if;
 else raise exception using errcode='22023',message='INVALID_CONFIGURATION_OPERATION'; end if;
 return source||jsonb_build_object('today',today::text,'version',public.mobile_quick_source_version(jsonb_build_object('today',today::text,'operation',p_operation,'source',source)));
end;
$$;
create function public.mobile_read_nutrition_configuration()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare plan jsonb; energy jsonb; physical jsonb;
begin
 if auth.uid() is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 begin plan:=jsonb_build_object('status','ok','data',public.mobile_configuration_state('plan')); exception when others then plan:='{"status":"unavailable"}'; end;
 begin energy:=jsonb_build_object('status','ok','data',public.mobile_configuration_state('energy')); exception when others then energy:='{"status":"unavailable"}'; end;
 begin physical:=jsonb_build_object('status','ok','data',public.mobile_configuration_state('physical')); exception when others then physical:='{"status":"unavailable"}'; end;
 return jsonb_build_object('today',(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date::text,'plan',plan,'energy',energy,'physical',physical);
end;
$$;

-- SQL validates and normalizes independently from the HTTP/runtime parser.
create function public.mobile_normalize_configuration_fields(op text,f jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare keys text[]; k text; n numeric; w jsonb; result jsonb; weekdays jsonb:='[]'; dt date;
begin
 keys:=case op when 'plan' then array['name','baseWaterL','trainingCalorieDeltaKcal','trainingWaterDeltaL','weekdays']
 when 'energy' then array['activityLevel','baseExpenditureMode','customBaseExpenditureKcal','trainingExpenditureDeltaKcal']
 when 'physical' then array['birthDate','sex','heightCm','weightKg'] end;
 if keys is null or jsonb_typeof(f) is distinct from 'object' or not f ?& keys or (select count(*) from jsonb_object_keys(f))<>array_length(keys,1) then raise exception using errcode='22023',message='INVALID_CONFIGURATION_FIELDS'; end if;
 if op='plan' then
  if jsonb_typeof(f->'name') is distinct from 'string' or nullif(btrim(f->>'name'),'') is null then raise exception using errcode='22023',message='INVALID_PLAN_NAME'; end if;
  result:=jsonb_build_object('name',btrim(f->>'name'));
  foreach k in array array['baseWaterL','trainingCalorieDeltaKcal','trainingWaterDeltaL'] loop
   if jsonb_typeof(f->k) is distinct from 'number' then raise exception using errcode='22023',message='INVALID_PLAN_VALUE'; end if;
   n:=(f->>k)::numeric;
   if n<0 or n>(case k when 'baseWaterL' then 50 when 'trainingWaterDeltaL' then 20 else 5000 end) or n<>round(n,case when k='trainingCalorieDeltaKcal' then 0 else 2 end) then raise exception using errcode='22023',message='INVALID_PLAN_VALUE'; end if;
   result:=result||jsonb_build_object(k,n);
  end loop;
  if jsonb_typeof(f->'weekdays') is distinct from 'array' or jsonb_array_length(f->'weekdays')<>7 then raise exception using errcode='22023',message='INVALID_WEEKDAYS'; end if;
  for w in select value from jsonb_array_elements(f->'weekdays') loop
   if jsonb_typeof(w) is distinct from 'object' or not w ?& array['weekday','calorieTargetKcal','proteinTargetG'] or (select count(*) from jsonb_object_keys(w))<>3
   or exists(select 1 from jsonb_each(w) where jsonb_typeof(value)<>'number') then raise exception using errcode='22023',message='INVALID_WEEKDAYS'; end if;
   if (w->>'weekday')::numeric not between 1 and 7 or (w->>'weekday')::numeric<>trunc((w->>'weekday')::numeric)
   or (w->>'calorieTargetKcal')::numeric not between 1 and 20000 or (w->>'calorieTargetKcal')::numeric<>trunc((w->>'calorieTargetKcal')::numeric)
   or (w->>'proteinTargetG')::numeric not between 0 and 2000 or (w->>'proteinTargetG')::numeric<>round((w->>'proteinTargetG')::numeric,2) then raise exception using errcode='22023',message='INVALID_WEEKDAYS'; end if;
   weekdays:=weekdays||jsonb_build_array(jsonb_build_object('weekday',(w->>'weekday')::integer,'calorieTargetKcal',(w->>'calorieTargetKcal')::integer,'proteinTargetG',(w->>'proteinTargetG')::numeric));
  end loop;
  if (select count(distinct value->>'weekday') from jsonb_array_elements(weekdays))<>7 then raise exception using errcode='22023',message='INVALID_WEEKDAYS'; end if;
  select jsonb_agg(value order by (value->>'weekday')::integer) into weekdays from jsonb_array_elements(weekdays);
  return result||jsonb_build_object('weekdays',weekdays);
 elsif op='energy' then
  if jsonb_typeof(f->'activityLevel') is distinct from 'string' or f->>'activityLevel' not in ('low','moderate','high')
  or jsonb_typeof(f->'baseExpenditureMode') is distinct from 'string' or f->>'baseExpenditureMode' not in ('automatic','custom')
  or jsonb_typeof(f->'trainingExpenditureDeltaKcal') is distinct from 'number' then raise exception using errcode='22023',message='INVALID_ENERGY'; end if;
  n:=(f->>'trainingExpenditureDeltaKcal')::numeric;
  if n<0 or n>5000 or n<>trunc(n) then raise exception using errcode='22023',message='INVALID_ENERGY'; end if;
  if f->>'baseExpenditureMode'='automatic' then
   if f->'customBaseExpenditureKcal'<>'null'::jsonb then raise exception using errcode='22023',message='INVALID_ENERGY'; end if;
  else
   if jsonb_typeof(f->'customBaseExpenditureKcal') is distinct from 'number' then raise exception using errcode='22023',message='INVALID_ENERGY'; end if;
   n:=(f->>'customBaseExpenditureKcal')::numeric;
   if n not between 1 and 20000 or n<>trunc(n) then raise exception using errcode='22023',message='INVALID_ENERGY'; end if;
  end if;
  return f;
 else
  if f->'birthDate'<>'null'::jsonb then
   if jsonb_typeof(f->'birthDate') is distinct from 'string' or f->>'birthDate' !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception using errcode='22023',message='INVALID_BIRTH_DATE'; end if;
   dt:=(f->>'birthDate')::date;
   if not isfinite(dt) or dt::text<>f->>'birthDate' then raise exception using errcode='22023',message='INVALID_BIRTH_DATE'; end if;
  end if;
  if f->'sex'<>'null'::jsonb and (jsonb_typeof(f->'sex') is distinct from 'string' or f->>'sex' not in ('male','female','other')) then raise exception using errcode='22023',message='INVALID_SEX'; end if;
  foreach k in array array['heightCm','weightKg'] loop
   if f->k<>'null'::jsonb then
    if jsonb_typeof(f->k) is distinct from 'number' then raise exception using errcode='22023',message='INVALID_PHYSICAL_VALUE'; end if;
    n:=(f->>k)::numeric;
    if k='heightCm' and (n not between 50 and 250 or n<>trunc(n)) or k='weightKg' and (n not between 0 and 999.99 or n<>round(n,2)) then raise exception using errcode='22023',message='INVALID_PHYSICAL_VALUE'; end if;
   end if;
  end loop;
  return f;
 end if;
end;
$$;

create function public.mobile_mutate_nutrition_configuration(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='3s' set statement_timeout='8s' as $$
declare u uuid:=(select auth.uid()); today date:=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 op text; k text; fields jsonb; normalized jsonb; hash text; ledger public.mobile_idempotency_keys;
 current_source jsonb; result jsonb; code smallint:=200; rid uuid; weekdays jsonb;
 old_profile public.profiles; d public.day_logs; weight numeric; record_weight boolean:=false;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or not p_intent ?& array['operation','date','expectedVersion','fields','idempotencyKey']
 or (select count(*) from jsonb_object_keys(p_intent))<>5 or jsonb_typeof(p_intent->'operation') is distinct from 'string'
 or p_intent->>'operation' not in ('plan','energy','physical') or jsonb_typeof(p_intent->'date') is distinct from 'string'
 or coalesce(p_intent->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or not isfinite((p_intent->>'date')::date) or (p_intent->>'date')::date::text<>p_intent->>'date'
 or jsonb_typeof(p_intent->'expectedVersion') is distinct from 'string' or coalesce(p_intent->>'expectedVersion','') !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then raise exception using errcode='22023',message='INVALID_CONFIGURATION_INTENT'; end if;
 op:=p_intent->>'operation'; k:=p_intent->>'idempotencyKey'; fields:=public.mobile_normalize_configuration_fields(op,p_intent->'fields');
 normalized:=jsonb_build_object('operation',op,'date',p_intent->>'date','expectedVersion',p_intent->>'expectedVersion','fields',fields);
 hash:=public.mobile_quick_source_version(normalized);
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at) values(u,'nutrition.config.'||op||'.v1',k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation='nutrition.config.'||op||'.v1' and idempotency_key=k for update;
 if ledger.request_hash<>hash then return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','El intento ya tiene otros datos.'),false; return; end if;
 -- Confirmed receipts survive source edits AND the Cordoba date changing.
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  if p_intent->>'date'<>today::text then raise exception using errcode='P0431',message='CONFIG_DAY_CHANGED'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,413));
  current_source:=public.mobile_configuration_state(op);
  if current_source->>'version'<>p_intent->>'expectedVersion' then raise exception using errcode='P0431',message=case when op='physical' then 'PHYSICAL_CHANGED' else 'CONFIG_CHANGED' end; end if;
  if op='plan' then
   select jsonb_agg(jsonb_build_object('weekday',value->'weekday','calorie_target_kcal',value->'calorieTargetKcal','protein_target_g',value->'proteinTargetG')) into weekdays from jsonb_array_elements(fields->'weekdays');
   rid:=public.save_nutrition_plan_v2(fields->>'name',(fields->>'baseWaterL')::numeric,(fields->>'trainingCalorieDeltaKcal')::integer,(fields->>'trainingWaterDeltaL')::numeric,weekdays);
  elsif op='energy' then
   if current_source->'profile'->>'bmr_kcal_current' is null then raise exception using errcode='P0431',message='ENERGY_PROFILE_REQUIRED'; end if;
   rid:=public.save_energy_config_v2(fields->>'activityLevel',(fields->>'trainingExpenditureDeltaKcal')::integer,fields->>'baseExpenditureMode',(fields->>'customBaseExpenditureKcal')::integer);
  else
   select * into old_profile from public.profiles where user_id=u for update;
   weight:=(fields->>'weightKg')::numeric;
   if weight is null and current_source->'latestWeight'<>'null'::jsonb then raise exception using errcode='P0431',message='PHYSICAL_WEIGHT_REQUIRED'; end if;
   record_weight:=weight is not null and (old_profile.current_weight_kg is distinct from weight or (current_source->'latestWeight'='null'::jsonb and old_profile.current_weight_kg is not null));
   insert into public.profiles(user_id,birth_date,sex,height_cm,current_weight_kg)
   values(u,(fields->>'birthDate')::date,fields->>'sex',(fields->>'heightCm')::integer,case when record_weight then old_profile.current_weight_kg else weight end)
   on conflict(user_id) do update set birth_date=excluded.birth_date,sex=excluded.sex,height_cm=excluded.height_cm,current_weight_kg=excluded.current_weight_kg;
   if record_weight then
    d:=public.get_or_create_day_log(today);
    update public.day_logs set weight_kg=weight where id=d.id and user_id=u;
    -- Existing weight trigger owns current weight, BMR and today's snapshots.
   end if;
  end if;
  result:=jsonb_build_object('status','confirmed','operation',op,'date',today::text,'version',public.mobile_configuration_state(op)->>'version','weightRecorded',record_weight);
 exception when sqlstate 'P0431' then
  code:=409; result:=jsonb_build_object('error',sqlerrm,'message',case sqlerrm
   when 'CONFIG_DAY_CHANGED' then 'Cambió el día. Revisá los datos antes de guardar desde hoy.'
   when 'ENERGY_PROFILE_REQUIRED' then 'Completá tus datos físicos antes de guardar el cálculo energético.'
   when 'PHYSICAL_WEIGHT_REQUIRED' then 'El peso corresponde al historial. No puede quitarse desde este formulario.'
   else 'Los datos cambiaron desde que abriste el formulario. Conservamos tu borrador para revisar.' end);
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='nutrition_configuration',resource_id=rid,completed_at=clock_timestamp()
 where user_id=u and operation='nutrition.config.'||op||'.v1' and idempotency_key=k;
 return query select code,result,false;
end;
$$;
create trigger tr_mobile_weight_insert_guard before insert on public.day_logs for each statement execute function public.mobile_configuration_write_guard();
revoke all on function public.mobile_configuration_write_guard(),public.mobile_configuration_state(text),public.mobile_read_nutrition_configuration(),public.mobile_normalize_configuration_fields(text,jsonb),public.mobile_mutate_nutrition_configuration(jsonb) from public,anon;
grant execute on function public.mobile_configuration_write_guard(),public.mobile_configuration_state(text),public.mobile_read_nutrition_configuration(),public.mobile_normalize_configuration_fields(text,jsonb),public.mobile_mutate_nutrition_configuration(jsonb) to authenticated;
commit;
