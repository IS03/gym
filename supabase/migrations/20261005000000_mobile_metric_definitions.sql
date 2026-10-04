-- M5.3 EXPAND: Mobile management of Daily Metric definitions (user_metrics).
-- Reuses the canonical domain: ensure_user_metrics (system initialization),
-- guard_user_metric_identity (system identity / history meaning), the
-- daily_metric_values FK (no orphaned facts) and reorder_user_metrics (full
-- active list, atomic). Adds only what Mobile needs on top: the standard
-- mobile_idempotency_keys ledger, CAS by updated_at and an order CAS.
-- Web keeps its current paths unchanged. Daily metric VALUES are untouched.
begin;

create function public.mobile_metric_definition_dto(m public.user_metrics, p_has_history boolean)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('id',m.id,'systemKey',m.system_key,'name',m.name,'unit',m.unit,'valueType',m.value_type,
  'target',m.target_value,'isActive',m.is_active,'sortOrder',m.sort_order,'updatedAt',m.updated_at,'hasHistory',p_has_history)
$$;

-- Read: initializes the system definitions through the canonical (idempotent,
-- concurrency-safe) ensure_user_metrics, then returns every definition of the
-- caller. Owner/RLS scoped (security invoker). Called with POST, never GET.
create function public.mobile_read_metric_definitions()
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC' as $$
declare u uuid := (select auth.uid()); r jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 perform public.ensure_user_metrics();
 select coalesce(jsonb_agg(public.mobile_metric_definition_dto(m,
   exists(select 1 from public.daily_metric_values v where v.user_id=u and v.metric_id=m.id))
   order by m.is_active desc, m.sort_order, m.created_at, m.id),'[]'::jsonb)
 into r from public.user_metrics m where m.user_id=u;
 return jsonb_build_object('definitions',r);
end;
$$;

-- Normalizes {name,valueType,unit,target} exactly like daily-metrics/core.ts
-- (trimmed name 1..80, duration unit = 'min', empty unit = null, target >= 0,
-- integer for integer/duration, 4 decimals). Invalid input is a validation error.
create function public.mobile_normalize_metric_fields(p jsonb)
returns jsonb language plpgsql immutable set search_path='' as $$
declare name text; vt text; unit text; n numeric;
begin
 if jsonb_typeof(p) is distinct from 'object' or (select count(*) from jsonb_object_keys(p))<>4
  or not p ?& array['name','valueType','unit','target']
  or jsonb_typeof(p->'name') is distinct from 'string' or jsonb_typeof(p->'valueType') is distinct from 'string'
  or jsonb_typeof(p->'unit') not in ('string','null') or jsonb_typeof(p->'target') not in ('number','null') then
  raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION';
 end if;
 name:=regexp_replace(p->>'name','^[[:space:]]+|[[:space:]]+$','','g');
 vt:=p->>'valueType';
 if char_length(name) not between 1 and 80 or vt not in ('integer','decimal','duration') then
  raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION';
 end if;
 if vt='duration' then unit:='min';
 else unit:=nullif(regexp_replace(coalesce(p->>'unit',''),'^[[:space:]]+|[[:space:]]+$','','g'),''); end if;
 if char_length(unit)>16 then raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION'; end if;
 n:=(p->>'target')::numeric;
 if n is not null and (n<0 or n>9999999999.9999 or n<>round(n,4) or (vt in ('integer','duration') and n<>trunc(n))) then
  raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION';
 end if;
 return jsonb_build_object('name',name,'valueType',vt,'unit',unit,'target',n::numeric(14,4));
end;
$$;

-- create / update / archive / restore / delete of ONE definition.
-- Intent: {operation, metricId, expectedUpdatedAt, fields, idempotencyKey}.
create function public.mobile_mutate_metric_definition(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='3s' set statement_timeout='8s' as $$
declare u uuid:=(select auth.uid()); op text; k text; mid uuid; expected timestamptz; f jsonb; normalized jsonb; hash text;
 ledger public.mobile_idempotency_keys; m public.user_metrics; history boolean:=false; code smallint:=200; result jsonb; next_order integer;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_intent))<>5
  or not p_intent ?& array['operation','metricId','expectedUpdatedAt','fields','idempotencyKey']
  or jsonb_typeof(p_intent->'operation') is distinct from 'string'
  or p_intent->>'operation' not in ('create','update','archive','restore','delete')
  or jsonb_typeof(p_intent->'metricId') not in ('string','null') or jsonb_typeof(p_intent->'expectedUpdatedAt') not in ('string','null')
  or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then
  raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION';
 end if;
 op:=p_intent->>'operation'; k:=p_intent->>'idempotencyKey';
 if op='create' then
  if jsonb_typeof(p_intent->'metricId')<>'null' or jsonb_typeof(p_intent->'expectedUpdatedAt')<>'null' then
   raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION';
  end if;
 else
  if jsonb_typeof(p_intent->'metricId')<>'string' or jsonb_typeof(p_intent->'expectedUpdatedAt')<>'string' then
   raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION';
  end if;
  mid:=(p_intent->>'metricId')::uuid; expected:=(p_intent->>'expectedUpdatedAt')::timestamptz;
  if not isfinite(expected) then raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION'; end if;
 end if;
 if op in ('create','update') then f:=public.mobile_normalize_metric_fields(p_intent->'fields');
 elsif jsonb_typeof(p_intent->'fields')<>'null' then raise exception using errcode='22023',message='INVALID_METRIC_DEFINITION'; end if;
 normalized:=jsonb_build_object('operation',op,'metricId',mid,'expectedUpdatedAt',expected,'fields',f);
 hash:=encode(extensions.digest(convert_to(normalized::text,'UTF8'),'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,'metrics.definition.v1',k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation='metrics.definition.v1' and idempotency_key=k for update;
 if ledger.request_hash<>hash then
  return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','El intento ya tiene otros datos.'),false; return;
 end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  if op<>'create' then
   -- FOR UPDATE also waits for any in-flight value insert (its FK key-share lock),
   -- so the history checks below can never miss a concurrent first value.
   select * into m from public.user_metrics where id=mid and user_id=u for update;
   if m.id is null then raise exception using errcode='P0533',message='NOT_FOUND'; end if;
   if m.updated_at is distinct from expected then raise exception using errcode='P0532',message='METRIC_CHANGED'; end if;
   history:=exists(select 1 from public.daily_metric_values v where v.user_id=u and v.metric_id=m.id);
  end if;
  if op in ('create','restore') then
   select coalesce(max(sort_order),-1)+1 into next_order from public.user_metrics where user_id=u and is_active;
  end if;
  if op='create' then
   insert into public.user_metrics(user_id,system_key,name,unit,value_type,target_value,sort_order,is_active,archived_at)
   values(u,null,f->>'name',f->>'unit',f->>'valueType',(f->>'target')::numeric,next_order,true,null) returning * into m;
  elsif op='update' then
   if m.system_key is not null and (f->>'name' is distinct from m.name or f->>'unit' is distinct from m.unit or f->>'valueType' is distinct from m.value_type) then
    raise exception using errcode='P0532',message='SYSTEM_METRIC_IMMUTABLE';
   end if;
   if history and (f->>'unit' is distinct from m.unit or f->>'valueType' is distinct from m.value_type) then
    raise exception using errcode='P0532',message='METRIC_HAS_HISTORY';
   end if;
   update public.user_metrics set name=f->>'name',unit=f->>'unit',value_type=f->>'valueType',target_value=(f->>'target')::numeric
   where id=m.id and user_id=u returning * into m;
  elsif op='archive' then
   if not m.is_active then raise exception using errcode='P0532',message='METRIC_CHANGED'; end if;
   update public.user_metrics set is_active=false,archived_at=statement_timestamp() where id=m.id and user_id=u returning * into m;
  elsif op='restore' then
   if m.is_active then raise exception using errcode='P0532',message='METRIC_CHANGED'; end if;
   update public.user_metrics set is_active=true,archived_at=null,sort_order=next_order where id=m.id and user_id=u returning * into m;
  else
   if m.system_key is not null then raise exception using errcode='P0532',message='SYSTEM_METRIC_PROTECTED'; end if;
   if history then raise exception using errcode='P0532',message='METRIC_HAS_HISTORY'; end if;
   begin
    delete from public.user_metrics where id=m.id and user_id=u;
   exception when foreign_key_violation then raise exception using errcode='P0532',message='METRIC_HAS_HISTORY';
   end;
  end if;
  result:=jsonb_build_object('status','confirmed','operation',op,'metricId',m.id,
   'definition',case when op='delete' then null else public.mobile_metric_definition_dto(m,history) end);
 exception
  when sqlstate 'P0533' then code:=404; result:=jsonb_build_object('error','NOT_FOUND','message','La métrica ya no está disponible.');
  when sqlstate 'P0532' then
   code:=409; result:=jsonb_build_object('error',sqlerrm,'message',case sqlerrm
    when 'SYSTEM_METRIC_IMMUTABLE' then 'En las métricas del sistema sólo se puede cambiar el objetivo.'
    when 'SYSTEM_METRIC_PROTECTED' then 'Las métricas del sistema no se eliminan. Podés archivarlas.'
    when 'METRIC_HAS_HISTORY' then case when op='delete' then 'Esta métrica tiene historial y sólo puede archivarse.'
     else 'Una métrica con historial no puede cambiar de tipo o unidad.' end
    else 'La métrica cambió desde que la abriste. Conservamos tu borrador para revisar.' end);
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='user_metric',resource_id=coalesce(m.id,mid),completed_at=clock_timestamp()
 where user_id=u and operation='metrics.definition.v1' and idempotency_key=k;
 return query select code,result,false;
end;
$$;

-- Reorder of the FULL active list through the canonical reorder_user_metrics,
-- with an order CAS: expectedMetricIds is the active order Mobile loaded.
-- Intent: {operation:'reorder', metricIds, expectedMetricIds, idempotencyKey}.
create function public.mobile_reorder_metric_definitions(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='3s' set statement_timeout='8s' as $$
declare u uuid:=(select auth.uid()); k text; ids uuid[]; expected uuid[]; current_ids uuid[]; normalized jsonb; hash text;
 ledger public.mobile_idempotency_keys; code smallint:=200; result jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_intent))<>4
  or not p_intent ?& array['operation','metricIds','expectedMetricIds','idempotencyKey'] or p_intent->>'operation' is distinct from 'reorder'
  or jsonb_typeof(p_intent->'metricIds') is distinct from 'array' or jsonb_typeof(p_intent->'expectedMetricIds') is distinct from 'array'
  or jsonb_array_length(p_intent->'metricIds') not between 1 and 200
  or exists(select 1 from jsonb_array_elements(p_intent->'metricIds') e where jsonb_typeof(e)<>'string')
  or exists(select 1 from jsonb_array_elements(p_intent->'expectedMetricIds') e where jsonb_typeof(e)<>'string')
  or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then
  raise exception using errcode='22023',message='INVALID_METRIC_ORDER';
 end if;
 k:=p_intent->>'idempotencyKey';
 select array_agg(e::uuid order by o) into ids from jsonb_array_elements_text(p_intent->'metricIds') with ordinality t(e,o);
 select array_agg(e::uuid order by o) into expected from jsonb_array_elements_text(p_intent->'expectedMetricIds') with ordinality t(e,o);
 -- Both lists must be the same set, without duplicates: a permutation.
 if cardinality(ids)<>cardinality(expected) or (select count(distinct x) from unnest(ids) x)<>cardinality(ids)
  or (select array_agg(x order by x) from unnest(ids) x) is distinct from (select array_agg(x order by x) from unnest(expected) x) then
  raise exception using errcode='22023',message='INVALID_METRIC_ORDER';
 end if;
 normalized:=jsonb_build_object('operation','reorder','metricIds',to_jsonb(ids),'expectedMetricIds',to_jsonb(expected));
 hash:=encode(extensions.digest(convert_to(normalized::text,'UTF8'),'sha256'),'hex');
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,'metrics.order.v1',k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation='metrics.order.v1' and idempotency_key=k for update;
 if ledger.request_hash<>hash then
  return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','El intento ya tiene otros datos.'),false; return;
 end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  -- Lock every definition of the user (stable order) so a concurrent Web
  -- archive/restore/create cannot slip between the CAS and the reorder.
  perform 1 from public.user_metrics where user_id=u order by id for update;
  select coalesce(array_agg(id order by sort_order, created_at, id),'{}') into current_ids from public.user_metrics where user_id=u and is_active;
  if current_ids is distinct from expected then raise exception using errcode='P0532',message='METRIC_ORDER_CHANGED'; end if;
  begin
   perform public.reorder_user_metrics(ids);
  exception when raise_exception then raise exception using errcode='P0532',message='METRIC_ORDER_CHANGED';
  end;
  result:=jsonb_build_object('status','confirmed','operation','reorder','metricIds',to_jsonb(ids));
 exception when sqlstate 'P0532' then
  code:=409; result:=jsonb_build_object('error','METRIC_ORDER_CHANGED','message','Las métricas activas cambiaron desde que abriste la lista. No aplicamos el orden.');
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='user_metric_order',completed_at=clock_timestamp()
 where user_id=u and operation='metrics.order.v1' and idempotency_key=k;
 return query select code,result,false;
end;
$$;

revoke all on function public.mobile_metric_definition_dto(public.user_metrics,boolean),public.mobile_read_metric_definitions(),
 public.mobile_normalize_metric_fields(jsonb),public.mobile_mutate_metric_definition(jsonb),public.mobile_reorder_metric_definitions(jsonb) from public,anon;
grant execute on function public.mobile_metric_definition_dto(public.user_metrics,boolean),public.mobile_read_metric_definitions(),
 public.mobile_normalize_metric_fields(jsonb),public.mobile_mutate_metric_definition(jsonb),public.mobile_reorder_metric_definitions(jsonb) to authenticated;

commit;
