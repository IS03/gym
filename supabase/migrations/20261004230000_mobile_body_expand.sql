-- M5.1 EXPAND: native Body (weight + body measurements). Additive Mobile read
-- and write wrappers only; Web signatures, tables and triggers stay intact.
--
-- Weight keeps ONE canonical path: day_logs.weight_kg (one per log_date) and the
-- existing tr_day_logs_sync_current_weight trigger, which owns profiles.current
-- weight, BMR and today's snapshots. The wrapper takes the same configuration
-- lock (413) as the Physical Profile writer before its CAS read.
begin;

-- Allowlisted measurement projection: no user_id, import_run_id or source_payload.
create function public.mobile_body_measurement_dto(m public.body_measurements)
returns jsonb language sql stable security invoker set search_path='' set timezone='UTC' as $$
 select jsonb_build_object(
  'id',m.id,'measuredOn',m.measured_on::text,
  'waistCm',m.waist_cm,'abdomenCm',m.abdomen_cm,'chestCm',m.chest_cm,'hipCm',m.hip_cm,
  'armRightCm',m.arm_right_cm,'armLeftCm',m.arm_left_cm,'thighRightCm',m.thigh_right_cm,'thighLeftCm',m.thigh_left_cm,
  'calfRightCm',m.calf_right_cm,'calfLeftCm',m.calf_left_cm,'armCm',m.arm_cm,'thighCm',m.thigh_cm,
  'condition',m.condition,'notes',m.notes,
  'imported',(m.import_run_id is not null or m.legacy_import_source is not null),'importSource',m.legacy_import_source,
  'qualityStatus',m.quality_status,'qualityNote',m.quality_note,'updatedAt',m.updated_at)
$$;

-- One coherent snapshot (STABLE: every SELECT sees the same calling snapshot).
-- Pages are newest-first keyset pages; limit+1 rows let the adapter detect more.
create function public.mobile_read_body(
  p_weights_before date, p_weights_limit integer, p_measurements_before date, p_measurements_limit integer)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare u uuid:=(select auth.uid()); today date:=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 latest record; profile_weight numeric; weights jsonb:='[]'::jsonb; measurements jsonb:='[]'::jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if p_weights_limit is null or p_weights_limit not between 0 and 100 or p_measurements_limit is null or p_measurements_limit not between 0 and 100
  or (p_weights_before is not null and not isfinite(p_weights_before)) or (p_measurements_before is not null and not isfinite(p_measurements_before)) then
  raise exception using errcode='22023',message='INVALID_BODY_READ';
 end if;
 select d.log_date,d.weight_kg into latest from public.day_logs d
 where d.user_id=u and d.weight_kg is not null order by d.log_date desc limit 1;
 select p.current_weight_kg into profile_weight from public.profiles p where p.user_id=u;
 if p_weights_limit>0 then
  select coalesce(jsonb_agg(jsonb_build_object('date',w.log_date::text,'weightKg',w.weight_kg) order by w.log_date desc),'[]'::jsonb) into weights
  from (select d.log_date,d.weight_kg from public.day_logs d
        where d.user_id=u and d.weight_kg is not null and (p_weights_before is null or d.log_date<p_weights_before)
        order by d.log_date desc limit p_weights_limit+1) w;
 end if;
 if p_measurements_limit>0 then
  select coalesce(jsonb_agg(public.mobile_body_measurement_dto(m) order by m.measured_on desc),'[]'::jsonb) into measurements
  from (select * from public.body_measurements b
        where b.user_id=u and (p_measurements_before is null or b.measured_on<p_measurements_before)
        order by b.measured_on desc limit p_measurements_limit+1) m;
 end if;
 return jsonb_build_object('today',today::text,
  'current',case when latest.log_date is null then null else jsonb_build_object('date',latest.log_date::text,'weightKg',latest.weight_kg) end,
  'profileWeightKg',profile_weight,'weights',weights,'measurements',measurements);
end;
$$;

-- Weight by exact date. CAS is value-based: day_logs.updated_at also moves with
-- meals/context, so it would raise false conflicts. null expected = "no weight".
create function public.mobile_mutate_body_weight(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='3s' set statement_timeout='8s' as $$
declare u uuid:=(select auth.uid()); today date:=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 op text; k text; dt date; expected numeric; target numeric; normalized jsonb; hash text; ledger public.mobile_idempotency_keys;
 d public.day_logs; before_profile numeric; after_profile numeric; latest record; code smallint:=200; result jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_intent))<>5
  or not p_intent ?& array['operation','date','expectedWeightKg','weightKg','idempotencyKey']
  or jsonb_typeof(p_intent->'operation') is distinct from 'string' or p_intent->>'operation' not in ('set','delete')
  or jsonb_typeof(p_intent->'date') is distinct from 'string' or coalesce(p_intent->>'date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  or jsonb_typeof(p_intent->'expectedWeightKg') not in ('number','null') or jsonb_typeof(p_intent->'weightKg') not in ('number','null')
  or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then
  raise exception using errcode='22023',message='INVALID_BODY_WEIGHT';
 end if;
 op:=p_intent->>'operation'; k:=p_intent->>'idempotencyKey'; dt:=(p_intent->>'date')::date;
 if not isfinite(dt) or dt::text<>p_intent->>'date' then raise exception using errcode='22023',message='INVALID_DATE'; end if;
 expected:=(p_intent->>'expectedWeightKg')::numeric; target:=(p_intent->>'weightKg')::numeric;
 if (op='set')<>(target is not null)
  or (target is not null and (target<0 or target>999.99 or target<>round(target,2)))
  or (expected is not null and (expected<0 or expected>999.99 or expected<>round(expected,2))) then
  raise exception using errcode='22023',message='INVALID_BODY_WEIGHT';
 end if;
 -- round(...,2) fixes the scale so 80.5 and 80.50 hash identically.
 normalized:=jsonb_build_object('operation',op,'date',dt::text,'expectedWeightKg',round(expected,2),'weightKg',round(target,2));
 hash:=public.mobile_quick_source_version(normalized);
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,'body.weight.v1',k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation='body.weight.v1' and idempotency_key=k for update;
 if ledger.request_hash<>hash then
  return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','El intento ya tiene otros datos.'),false; return;
 end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  if dt>today then raise exception using errcode='P0451',message='BODY_FUTURE_DATE'; end if;
  -- Same lock as the Physical Profile writer: its CAS version includes the latest weight.
  perform pg_advisory_xact_lock(hashtextextended(u::text,413));
  select p.current_weight_kg into before_profile from public.profiles p where p.user_id=u;
  select * into d from public.day_logs where user_id=u and log_date=dt for update;
  if d.weight_kg is distinct from expected then raise exception using errcode='P0451',message='WEIGHT_CHANGED'; end if;
  if op='set' and d.weight_kg is distinct from target then
   if d.id is null then d:=public.get_or_create_day_log(dt); end if;
   update public.day_logs set weight_kg=target where id=d.id and user_id=u;
  elsif op='delete' and d.weight_kg is not null then
   -- Delete clears only this day's weight (never 0); the rest of the day stays.
   update public.day_logs set weight_kg=null where id=d.id and user_id=u;
  end if;
  select p.current_weight_kg into after_profile from public.profiles p where p.user_id=u;
  select x.log_date,x.weight_kg into latest from public.day_logs x where x.user_id=u and x.weight_kg is not null order by x.log_date desc limit 1;
  result:=jsonb_build_object('status','confirmed','operation',op,'date',dt::text,'weightKg',target,
   'current',case when latest.log_date is null then null else jsonb_build_object('date',latest.log_date::text,'weightKg',latest.weight_kg) end,
   'profileWeightKg',after_profile,'currentWeightChanged',before_profile is distinct from after_profile);
 exception when sqlstate 'P0451' then
  code:=409; result:=jsonb_build_object('error',sqlerrm,'message',case sqlerrm
   when 'BODY_FUTURE_DATE' then 'No se puede registrar peso en una fecha futura.'
   else 'El peso de esa fecha cambió desde que lo abriste. Conservamos tu borrador para revisar.' end);
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='body_weight',completed_at=clock_timestamp()
 where user_id=u and operation='body.weight.v1' and idempotency_key=k;
 return query select code,result,false;
end;
$$;

-- Normalized measurement fields: exact keys, cm in (0,500] with 2 decimals,
-- trimmed text where '' means null (Web parity).
create function public.mobile_normalize_body_measurement_fields(p_fields jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare names text[]:=array['waistCm','abdomenCm','chestCm','hipCm','armRightCm','armLeftCm','thighRightCm','thighLeftCm','calfRightCm','calfLeftCm'];
 result jsonb; name text; n numeric; t text;
begin
 if jsonb_typeof(p_fields) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_fields))<>13
  or not p_fields ?& (names||array['measuredOn','condition','notes'])
  or jsonb_typeof(p_fields->'measuredOn') is distinct from 'string' or coalesce(p_fields->>'measuredOn','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
  raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT';
 end if;
 if not isfinite((p_fields->>'measuredOn')::date) or (p_fields->>'measuredOn')::date::text<>p_fields->>'measuredOn' then
  raise exception using errcode='22023',message='INVALID_DATE';
 end if;
 result:=jsonb_build_object('measuredOn',p_fields->>'measuredOn');
 foreach name in array names loop
  if jsonb_typeof(p_fields->name)='null' then result:=result||jsonb_build_object(name,null);
  elsif jsonb_typeof(p_fields->name)='number' then
   n:=(p_fields->>name)::numeric;
   if n<=0 or n>500 or n<>round(n,2) then raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT'; end if;
   result:=result||jsonb_build_object(name,round(n,2));
  else raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT'; end if;
 end loop;
 foreach name in array array['condition','notes'] loop
  if jsonb_typeof(p_fields->name)='null' then t:=null;
  elsif jsonb_typeof(p_fields->name)='string' then t:=nullif(btrim(p_fields->>name),'');
   if char_length(t)>2000 then raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT'; end if;
  else raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT'; end if;
  result:=result||jsonb_build_object(name,t);
 end loop;
 return result;
end;
$$;

-- Measurements by id. CAS by updated_at; one measurement per date (the existing
-- unique constraint) surfaces as MEASUREMENT_DATE_TAKEN, never a merge. A valid
-- correction marks a suspect row verified; import provenance is preserved.
create function public.mobile_mutate_body_measurement(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='3s' set statement_timeout='8s' as $$
declare u uuid:=(select auth.uid()); today date:=(statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 op text; k text; mid uuid; expected timestamptz; f jsonb; normalized jsonb; hash text; ledger public.mobile_idempotency_keys;
 m public.body_measurements; code smallint:=200; result jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_intent))<>5
  or not p_intent ?& array['operation','measurementId','expectedUpdatedAt','fields','idempotencyKey']
  or jsonb_typeof(p_intent->'operation') is distinct from 'string' or p_intent->>'operation' not in ('create','update','delete')
  or jsonb_typeof(p_intent->'measurementId') not in ('string','null') or jsonb_typeof(p_intent->'expectedUpdatedAt') not in ('string','null')
  or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then
  raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT';
 end if;
 op:=p_intent->>'operation'; k:=p_intent->>'idempotencyKey';
 if op='create' then
  if jsonb_typeof(p_intent->'measurementId')<>'null' or jsonb_typeof(p_intent->'expectedUpdatedAt')<>'null' then
   raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT';
  end if;
 else
  if jsonb_typeof(p_intent->'measurementId')<>'string' or jsonb_typeof(p_intent->'expectedUpdatedAt')<>'string' then
   raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT';
  end if;
  mid:=(p_intent->>'measurementId')::uuid; expected:=(p_intent->>'expectedUpdatedAt')::timestamptz;
  if not isfinite(expected) then raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT'; end if;
 end if;
 if op='delete' then
  if jsonb_typeof(p_intent->'fields')<>'null' then raise exception using errcode='22023',message='INVALID_BODY_MEASUREMENT'; end if;
  f:=null;
 else f:=public.mobile_normalize_body_measurement_fields(p_intent->'fields'); end if;
 normalized:=jsonb_build_object('operation',op,'measurementId',mid,'expectedUpdatedAt',expected,'fields',f);
 hash:=public.mobile_quick_source_version(normalized);
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,'body.measurement.v1',k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation='body.measurement.v1' and idempotency_key=k for update;
 if ledger.request_hash<>hash then
  return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','El intento ya tiene otros datos.'),false; return;
 end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  if f is not null and (f->>'measuredOn')::date>today then raise exception using errcode='P0452',message='BODY_FUTURE_DATE'; end if;
  if op<>'create' then
   select * into m from public.body_measurements where id=mid and user_id=u for update;
   if m.id is null then raise exception using errcode='P0453',message='NOT_FOUND'; end if;
   if m.updated_at is distinct from expected then raise exception using errcode='P0452',message='MEASUREMENT_CHANGED'; end if;
  end if;
  begin
   if op='create' then
    insert into public.body_measurements(user_id,measured_on,waist_cm,abdomen_cm,chest_cm,hip_cm,arm_right_cm,arm_left_cm,
     thigh_right_cm,thigh_left_cm,calf_right_cm,calf_left_cm,condition,notes)
    values(u,(f->>'measuredOn')::date,(f->>'waistCm')::numeric,(f->>'abdomenCm')::numeric,(f->>'chestCm')::numeric,(f->>'hipCm')::numeric,
     (f->>'armRightCm')::numeric,(f->>'armLeftCm')::numeric,(f->>'thighRightCm')::numeric,(f->>'thighLeftCm')::numeric,
     (f->>'calfRightCm')::numeric,(f->>'calfLeftCm')::numeric,f->>'condition',f->>'notes')
    returning * into m;
   elsif op='update' then
    -- Legacy arm_cm/thigh_cm are preserved (Web preserveLegacy parity).
    update public.body_measurements set measured_on=(f->>'measuredOn')::date,waist_cm=(f->>'waistCm')::numeric,abdomen_cm=(f->>'abdomenCm')::numeric,
     chest_cm=(f->>'chestCm')::numeric,hip_cm=(f->>'hipCm')::numeric,arm_right_cm=(f->>'armRightCm')::numeric,arm_left_cm=(f->>'armLeftCm')::numeric,
     thigh_right_cm=(f->>'thighRightCm')::numeric,thigh_left_cm=(f->>'thighLeftCm')::numeric,calf_right_cm=(f->>'calfRightCm')::numeric,
     calf_left_cm=(f->>'calfLeftCm')::numeric,condition=f->>'condition',notes=f->>'notes',quality_status='verified',quality_note=null
    where id=mid and user_id=u returning * into m;
   else
    delete from public.body_measurements where id=mid and user_id=u;
   end if;
  exception when unique_violation then raise exception using errcode='P0452',message='MEASUREMENT_DATE_TAKEN';
  end;
  result:=jsonb_build_object('status','confirmed','operation',op,'measurementId',m.id,
   'measurement',case when op='delete' then null else public.mobile_body_measurement_dto(m) end);
 exception
  when sqlstate 'P0453' then code:=404; result:=jsonb_build_object('error','NOT_FOUND','message','La medición ya no está disponible.');
  when sqlstate 'P0452' then
   code:=409; result:=jsonb_build_object('error',sqlerrm,'message',case sqlerrm
    when 'BODY_FUTURE_DATE' then 'No se pueden registrar medidas en una fecha futura.'
    when 'MEASUREMENT_DATE_TAKEN' then 'Ya existe una medición para esa fecha. Editá la existente o elegí otra fecha.'
    else 'La medición cambió desde que la abriste. Conservamos tu borrador para revisar.' end);
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='body_measurement',resource_id=coalesce(m.id,mid),completed_at=clock_timestamp()
 where user_id=u and operation='body.measurement.v1' and idempotency_key=k;
 return query select code,result,false;
end;
$$;

revoke all on function public.mobile_body_measurement_dto(public.body_measurements),public.mobile_read_body(date,integer,date,integer),
 public.mobile_mutate_body_weight(jsonb),public.mobile_normalize_body_measurement_fields(jsonb),public.mobile_mutate_body_measurement(jsonb) from public,anon;
grant execute on function public.mobile_body_measurement_dto(public.body_measurements),public.mobile_read_body(date,integer,date,integer),
 public.mobile_mutate_body_weight(jsonb),public.mobile_normalize_body_measurement_fields(jsonb),public.mobile_mutate_body_measurement(jsonb) to authenticated;
commit;
