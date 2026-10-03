-- M4.1-3 EXPAND. Shared private ledger, exact-date canonical values and daily
-- overrides only. Identity/ownership are explicit in this privileged wrapper.
begin;
create function public.mobile_mutate_nutrition_day(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path=''
set lock_timeout='3s' set statement_timeout='8s' set timezone='UTC'
as $$
declare
 u uuid := (select auth.uid()); op text; k text; dt date; normalized jsonb; hash text;
 ledger public.mobile_idempotency_keys; d public.day_logs; m public.user_metrics;
 v public.daily_metric_values; c jsonb; n numeric; expected timestamptz;
 changes jsonb; vals jsonb; canonical jsonb := '[]'::jsonb;
 code smallint := 200; result jsonb; inserted uuid;
 today date := (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if p_intent is null or jsonb_typeof(p_intent)<>'object' or not p_intent ?& array['operation','date','idempotencyKey','changes']
  or p_intent->>'operation' not in ('metrics','context')
  or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$'
  or coalesce(p_intent->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
  raise exception using errcode='22023',message='INVALID_DAY_WRITE'; end if;
 op:=p_intent->>'operation'; k:=p_intent->>'idempotencyKey'; dt:=(p_intent->>'date')::date; changes:=p_intent->'changes';
 if not isfinite(dt) or dt::text<>p_intent->>'date' then raise exception using errcode='22023',message='INVALID_DATE'; end if;
 if op='metrics' then
  if (select count(*) from jsonb_object_keys(p_intent))<>4 or jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 100 then
   raise exception using errcode='22023',message='INVALID_METRICS'; end if;
  for c in select value from jsonb_array_elements(changes) loop
   if jsonb_typeof(c)<>'object' or (select count(*) from jsonb_object_keys(c))<>4
    or not c ?& array['metricId','definitionUpdatedAt','expectedUpdatedAt','value']
    or (c->>'metricId')::uuid is null or (c->>'definitionUpdatedAt')::timestamptz is null
    or not isfinite((c->>'definitionUpdatedAt')::timestamptz)
    or (c->>'expectedUpdatedAt' is not null and not isfinite((c->>'expectedUpdatedAt')::timestamptz))
    or jsonb_typeof(c->'value') not in ('number','null') then raise exception using errcode='22023',message='INVALID_METRICS'; end if;
   n:=(c->>'value')::numeric;
   if n<0 or n>9999999999.9999 or n<>round(n,4) then raise exception using errcode='22023',message='INVALID_METRIC_VALUE'; end if;
   canonical:=canonical||jsonb_build_array(jsonb_build_object('metricId',(c->>'metricId')::uuid,
    'definitionUpdatedAt',(c->>'definitionUpdatedAt')::timestamptz,'expectedUpdatedAt',(c->>'expectedUpdatedAt')::timestamptz,'value',n::numeric(14,4)));
  end loop;
  if (select count(distinct value->>'metricId') from jsonb_array_elements(canonical))<>jsonb_array_length(canonical) then raise exception using errcode='22023',message='DUPLICATE_METRIC'; end if;
  select jsonb_agg(value order by value->>'metricId') into changes from jsonb_array_elements(canonical);
  normalized:=jsonb_build_object('operation',op,'date',dt::text,'changes',changes);
 else
  expected:=(p_intent->>'expectedUpdatedAt')::timestamptz;
  if (select count(*) from jsonb_object_keys(p_intent))<>5 or not p_intent ? 'expectedUpdatedAt' or expected is null or not isfinite(expected)
   or jsonb_typeof(changes)<>'object' or (select count(*) from jsonb_object_keys(changes)) not between 1 and 2
   or exists(select 1 from jsonb_object_keys(changes) a where a not in ('target','expenditure')) then raise exception using errcode='22023',message='INVALID_CONTEXT'; end if;
  for k,c in select * from jsonb_each(changes) loop
   if jsonb_typeof(c)<>'object' or c->>'action' not in ('set','clear') then raise exception using errcode='22023',message='INVALID_CONTEXT'; end if;
   if c->>'action'='clear' then
    if (select count(*) from jsonb_object_keys(c))<>1 then raise exception using errcode='22023',message='INVALID_CONTEXT'; end if;
   else
    n:=(c->>'value')::numeric;
    if (select count(*) from jsonb_object_keys(c))<>2 or jsonb_typeof(c->'value') is distinct from 'number' or n is null
     or n<>trunc(n) or n<1 or n>(case when k='target' then 20000 else 50000 end) then raise exception using errcode='22023',message='INVALID_CONTEXT'; end if;
    changes:=jsonb_set(changes,array[k],jsonb_build_object('action','set','value',n::integer));
   end if;
  end loop;
  normalized:=jsonb_build_object('operation',op,'date',dt::text,'expectedUpdatedAt',expected,'changes',changes);
 end if;
 k:=p_intent->>'idempotencyKey';
 hash:=encode(extensions.digest(convert_to(normalized::text,'UTF8'),'sha256'),'hex');
 op:='nutrition.day.'||op||'.v1';
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,op,k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation=op and idempotency_key=k for update;
 if ledger.request_hash<>hash then return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','La clave ya fue usada con otros datos.'),false; return; end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 -- Savepoint covers the ENTIRE batch. A late absent-row insertion race or
 -- invalid value rolls back every earlier change, but retains a conflict receipt.
 begin
  if p_intent->>'operation'='metrics' then
   vals:='{}'::jsonb;
   for c in select value from jsonb_array_elements(changes) loop
    select * into m from public.user_metrics where id=(c->>'metricId')::uuid and user_id=u for share;
    if not found then raise exception using errcode='P0413',message='METRIC_UNAVAILABLE'; end if;
    select * into v from public.daily_metric_values where user_id=u and metric_id=m.id and metric_date=dt for update;
    if not m.is_active and (dt>=today or v.id is null) then raise exception using errcode='P0413',message='METRIC_UNAVAILABLE'; end if;
    if m.updated_at is distinct from (c->>'definitionUpdatedAt')::timestamptz or v.updated_at is distinct from (c->>'expectedUpdatedAt')::timestamptz then raise exception using errcode='P0413',message='METRICS_CHANGED'; end if;
    n:=(c->>'value')::numeric;
    if n is not null and ((m.value_type in ('integer','duration') and n<>trunc(n)) or (m.system_key='steps' and n>2147483647)) then raise exception using errcode='22023',message='INVALID_METRIC_VALUE'; end if;
    if n is null then
     delete from public.daily_metric_values where id=v.id and user_id=u;
    elsif v.id is not null then
     update public.daily_metric_values set value=n where id=v.id and user_id=u;
    else
     inserted:=null;
     insert into public.daily_metric_values(user_id,metric_id,metric_date,value) values(u,m.id,dt,n)
     on conflict(user_id,metric_date,metric_id) do nothing returning id into inserted;
     if inserted is null then raise exception using errcode='P0413',message='METRICS_CHANGED'; end if;
    end if;
   end loop;
  else
   select * into d from public.day_logs where user_id=u and log_date=dt for update;
   if not found then raise exception using errcode='P0413',message='CONTEXT_UNAVAILABLE'; end if;
   if d.updated_at is distinct from expected then raise exception using errcode='P0413',message='CONTEXT_CHANGED'; end if;
   update public.day_logs set
    nutrition_target_override_kcal=case when changes ? 'target' then (changes->'target'->>'value')::integer else d.nutrition_target_override_kcal end,
    expenditure_override_kcal=case when changes ? 'expenditure' then (changes->'expenditure'->>'value')::integer else d.expenditure_override_kcal end
   where id=d.id and user_id=u;
   -- Existing resolver/triggers calculate effective values. Historical period
   -- identity must stay with its saved snapshots, even after config corrections.
   if dt<today and d.nutrition_resolved_at is not null then
    update public.day_logs set
     nutrition_plan_period_id=d.nutrition_plan_period_id,energy_config_period_id=d.energy_config_period_id,
     work_effective_snapshot=d.work_effective_snapshot,gym_effective_snapshot=d.gym_effective_snapshot,
     work_source_snapshot=d.work_source_snapshot,gym_source_snapshot=d.gym_source_snapshot,
     work_schedule_period_id=d.work_schedule_period_id,nutrition_goal_period_id=d.nutrition_goal_period_id,
     expenditure_rule_period_id=d.expenditure_rule_period_id,protein_target_g_snapshot=d.protein_target_g_snapshot,
     water_target_l_snapshot=d.water_target_l_snapshot
    where id=d.id and user_id=u;
   end if;
  end if;
  result:=jsonb_build_object('status','saved','operation',p_intent->>'operation','date',dt::text);
 exception when sqlstate 'P0413' then
  code:=409; result:=jsonb_build_object('error',sqlerrm,'message',case sqlerrm
   when 'METRICS_CHANGED' then 'Cambió un valor o su definición. No guardamos ningún cambio del grupo.'
   when 'METRIC_UNAVAILABLE' then 'Una métrica ya no se puede corregir en esta fecha. No guardamos el grupo.'
   when 'CONTEXT_CHANGED' then 'El día cambió desde que abriste el contexto.'
   else 'Registrá primero un hecho en este día para ajustar su contexto.' end);
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,completed_at=clock_timestamp()
 where user_id=u and operation=op and idempotency_key=k;
 return query select code,result,false;
end;
$$;
revoke all on function public.mobile_mutate_nutrition_day(jsonb) from public,anon;
grant execute on function public.mobile_mutate_nutrition_day(jsonb) to authenticated;

-- Additive version metadata; existing read semantics stay unchanged.
create or replace function public.mobile_read_nutrition_day(p_log_date date)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_day public.day_logs;
  v_meals jsonb;
  v_metrics jsonb;
  v_nutrition jsonb;
  v_activity jsonb;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if p_log_date is null or not pg_catalog.isfinite(p_log_date) then
    raise exception using errcode = '22023', message = 'invalid_nutrition_date';
  end if;

  -- STABLE gives every SELECT (including the independent sections) the same
  -- calling-query snapshot. Persisted totals and active meals cannot straddle
  -- a concurrent meal write. Owner predicates supplement existing RLS.
  begin
    select d.* into v_day from public.day_logs d
    where d.user_id = v_user_id and d.log_date = p_log_date;

    select coalesce(jsonb_agg(to_jsonb(m) order by m.consumed_at desc, m.id), '[]'::jsonb)
    into v_meals from public.meal_entries m
    where m.day_log_id = v_day.id and m.user_id = v_user_id and m.deleted_at is null;

    v_nutrition := jsonb_build_object('status', 'ok', 'data', jsonb_build_object(
      'dayLog', case when v_day.id is null then null else to_jsonb(v_day) end,
      'meals', v_meals
    ));
  exception when others then
    v_nutrition := jsonb_build_object('status', 'unavailable');
  end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'systemKey', m.system_key, 'label', m.name, 'unit', m.unit,
      'valueType', m.value_type, 'target', m.target_value, 'isActive', m.is_active,
      'value', v.value, 'updatedAt', v.updated_at, 'definitionUpdatedAt', m.updated_at
    ) order by m.sort_order, m.created_at, m.id), '[]'::jsonb)
    into v_metrics
    from public.user_metrics m
    left join public.daily_metric_values v
      on v.metric_id = m.id and v.user_id = v_user_id and v.metric_date = p_log_date
    where m.user_id = v_user_id
      and (m.is_active or (p_log_date < (pg_catalog.statement_timestamp() at time zone 'America/Argentina/Cordoba')::date
        and v.id is not null));

    v_activity := jsonb_build_object('status', 'ok', 'data', jsonb_build_object('metrics', v_metrics));
  exception when others then
    v_activity := jsonb_build_object('status', 'unavailable');
  end;

  -- Raw rows are server-only inputs. The HTTP adapter exposes an allowlisted DTO.
  return jsonb_build_object(
    'date', p_log_date::text,
    'today', ((pg_catalog.statement_timestamp() at time zone 'America/Argentina/Cordoba')::date)::text,
    'nutrition', v_nutrition, 'activity', v_activity
  );
end;
$$;

revoke all on function public.mobile_read_nutrition_day(date) from public, anon;
grant execute on function public.mobile_read_nutrition_day(date) to authenticated;
comment on function public.mobile_read_nutrition_day(date) is
  'Read-only, owner/RLS scoped Mobile Nutrition snapshot for an exact date. Does not create day_logs or resolve current configuration.';


commit;
