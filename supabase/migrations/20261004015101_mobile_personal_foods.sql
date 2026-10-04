-- M4.2-2 EXPAND. Foods are personal definitions; historical entries/items
-- remain snapshots. Old quick intents/receipts retain their normalization.
begin;
create function public.mobile_read_foods(p_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC'
as $$
declare u uuid:=(select auth.uid()); result jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('version',public.mobile_quick_source_version(to_jsonb(f))) order by f.is_active desc,f.name,f.id),'[]'::jsonb)
 into result from public.foods f where f.user_id=u and (p_id is null or f.id=p_id);
 return result;
end;
$$;

create function public.mobile_normalize_food_fields(p_fields jsonb)
returns jsonb language plpgsql immutable security invoker set search_path=''
as $$
declare key text; n numeric; result jsonb;
begin
 if p_fields is null or jsonb_typeof(p_fields)<>'object' or (select count(*) from jsonb_object_keys(p_fields))<>9
 or not p_fields ?& array['name','description','servingQuantity','servingUnit','calories','proteinG','carbsG','fatG','sourceNote']
 or jsonb_typeof(p_fields->'name') is distinct from 'string' or nullif(btrim(p_fields->>'name'),'') is null
 or jsonb_typeof(p_fields->'servingUnit') is distinct from 'string' or nullif(btrim(p_fields->>'servingUnit'),'') is null
 or jsonb_typeof(p_fields->'servingQuantity') is distinct from 'number' then raise exception using errcode='22023',message='INVALID_FOOD_FIELDS'; end if;
 n:=(p_fields->>'servingQuantity')::numeric;
 if n<0.001 or n>1000000 or n<>round(n,3) then raise exception using errcode='22023',message='INVALID_BASE_QUANTITY'; end if;
 result:=jsonb_build_object('name',upper(regexp_replace(btrim(p_fields->>'name'),'\s+',' ','g')),'servingUnit',btrim(p_fields->>'servingUnit'),'servingQuantity',n::numeric(10,3));
 foreach key in array array['description','sourceNote'] loop
  if jsonb_typeof(p_fields->key) not in ('string','null') then raise exception using errcode='22023',message='INVALID_FOOD_TEXT'; end if;
  result:=result||jsonb_build_object(key,nullif(btrim(p_fields->>key),''));
 end loop;
 foreach key in array array['calories','proteinG','carbsG','fatG'] loop
  if p_fields->key='null'::jsonb then result:=result||jsonb_build_object(key,null);
  else
   if jsonb_typeof(p_fields->key) is distinct from 'number' then raise exception using errcode='22023',message='INVALID_NUTRIENT'; end if;
   n:=(p_fields->>key)::numeric;
   if n<0 or n>(case when key='calories' then 99999999.99 else 999999.99 end) or n<>round(n,2) then raise exception using errcode='22023',message='INVALID_NUTRIENT'; end if;
   result:=result||jsonb_build_object(key,n::numeric(10,2));
  end if;
 end loop;
 if coalesce(result->>'calories',result->>'proteinG',result->>'carbsG',result->>'fatG') is null then raise exception using errcode='22023',message='NUTRITION_REQUIRED'; end if;
 return result;
end;
$$;

-- The existing Web calculator uses IEEE double arithmetic and positive
-- Math.round (macros include Number.EPSILON). Reproduce that exact occurrence
-- rule, NOT round cached definition totals or trust a client preview.
create function public.mobile_resolve_food_occurrence(p_selection jsonb,p_lock boolean default false)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC'
set lock_timeout='3s' set statement_timeout='8s'
as $$
declare u uuid:=(select auth.uid()); sel jsonb; f public.foods; n numeric; factor double precision;
 calories numeric; protein numeric; carbs numeric; fat numeric; description text; quantity_label text;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 sel:=public.mobile_normalize_quick_selection(p_selection);
 if sel->'source'->>'kind'<>'food' then raise exception using errcode='22023',message='INVALID_FOOD_SOURCE'; end if;
 if p_lock then select * into f from public.foods where id=(sel->'source'->>'id')::uuid and user_id=u for share;
 else select * into f from public.foods where id=(sel->'source'->>'id')::uuid and user_id=u; end if;
 if f.id is null or not f.is_active then raise exception using errcode='P0421',message='QUICK_SOURCE_UNAVAILABLE'; end if;
 if public.mobile_quick_source_version(to_jsonb(f))<>sel->'source'->>'version' then raise exception using errcode='P0421',message='QUICK_SOURCE_CHANGED'; end if;
 n:=(sel->'quantities'->0->>'quantity')::numeric;
 if f.calories is null or f.calories<=0 or f.serving_quantity<=0 then raise exception using errcode='P0421',message='QUICK_SOURCE_UNUSABLE'; end if;
 factor:=n::double precision/f.serving_quantity::double precision;
 calories:=floor(f.calories::double precision*factor+0.5)::numeric;
 protein:=floor((f.protein_g::double precision*factor+2.220446049250313e-16)*100+0.5)::numeric/100;
 carbs:=floor((f.carbs_g::double precision*factor+2.220446049250313e-16)*100+0.5)::numeric/100;
 fat:=floor((f.fat_g::double precision*factor+2.220446049250313e-16)*100+0.5)::numeric/100;
 if calories<=0 or calories>2147483647 or protein>999999.99 or carbs>99999999.99 or fat>99999999.99 then raise exception using errcode='P0421',message='QUICK_SOURCE_UNUSABLE'; end if;
 quantity_label:=replace(replace(replace(rtrim(rtrim(to_char(n,'FM999,999,990.000'),'0'),'.'),',','#'),'.',','),'#','.')||' '||f.serving_unit;
 description:=quantity_label||case when f.description is null or f.description='' then '' else ' · '||f.description end;
 description:=nullif(upper(regexp_replace(btrim(description),'\s+',' ','g')),'');
 return jsonb_build_object('status','preview','selection',sel,'snapshot',jsonb_build_object('title',f.name,'description',description,
 'calories',calories::integer,'proteinG',protein,'carbsG',carbs,'fatG',fat,'precision',f.precision_level,'contextType','food_quantity','sourceNote',f.source_note),
 'items',jsonb_build_array(jsonb_build_object('id',f.id,'label',f.name,'quantity',n,'unit',f.serving_unit,'calories',calories,'proteinG',protein,'carbsG',carbs,'fatG',fat)));
end;
$$;

create function public.mobile_mutate_food(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC'
set lock_timeout='3s' set statement_timeout='8s'
as $$
declare u uuid:=(select auth.uid()); op text; k text; fields jsonb; normalized jsonb; hash text; source_id uuid; expected text;
 ledger public.mobile_idempotency_keys; f public.foods; code smallint:=201; result jsonb; constraint_name text;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if p_intent is null or jsonb_typeof(p_intent)<>'object' or (select count(*) from jsonb_object_keys(p_intent))<>5
 or not p_intent ?& array['operation','id','expectedVersion','fields','idempotencyKey']
 or jsonb_typeof(p_intent->'operation') is distinct from 'string' or p_intent->>'operation' not in ('create','update','archive','reactivate','delete')
 or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then raise exception using errcode='22023',message='INVALID_FOOD_INTENT'; end if;
 op:=p_intent->>'operation'; k:=p_intent->>'idempotencyKey';
 if op='create' then
  if p_intent->'id'<>'null'::jsonb or p_intent->'expectedVersion'<>'null'::jsonb then raise exception using errcode='22023',message='INVALID_FOOD_ID'; end if;
 else
  if jsonb_typeof(p_intent->'id') is distinct from 'string' or jsonb_typeof(p_intent->'expectedVersion') is distinct from 'string' or coalesce(p_intent->>'expectedVersion','') !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='INVALID_FOOD_VERSION'; end if;
  source_id:=(p_intent->>'id')::uuid; expected:=p_intent->>'expectedVersion';
 end if;
 if op in ('create','update') then fields:=public.mobile_normalize_food_fields(p_intent->'fields');
 elsif p_intent->'fields'<>'null'::jsonb then raise exception using errcode='22023',message='INVALID_FOOD_FIELDS'; end if;
 normalized:=jsonb_build_object('operation',op,'id',source_id,'expectedVersion',expected,'fields',fields); hash:=public.mobile_quick_source_version(normalized);
 op:='nutrition.food.'||op||'.v1';
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,op,k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation=op and idempotency_key=k for update;
 if ledger.request_hash<>hash then return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','La clave ya fue usada con otros datos.'),false; return; end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  if source_id is not null then
   select * into f from public.foods where id=source_id and user_id=u for update;
   if f.id is null then raise exception using errcode='P0422',message='FOOD_UNAVAILABLE'; end if;
   if public.mobile_quick_source_version(to_jsonb(f))<>expected then raise exception using errcode='P0422',message='FOOD_CHANGED'; end if;
  end if;
  case p_intent->>'operation'
   when 'create' then
    insert into public.foods(user_id,name,description,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g,source_note,is_active)
    values(u,fields->>'name',fields->>'description',(fields->>'servingQuantity')::numeric,fields->>'servingUnit',(fields->>'calories')::numeric,(fields->>'proteinG')::numeric,(fields->>'carbsG')::numeric,(fields->>'fatG')::numeric,fields->>'sourceNote',true) returning * into f;
   when 'update' then
    update public.foods set name=fields->>'name',description=fields->>'description',serving_quantity=(fields->>'servingQuantity')::numeric,serving_unit=fields->>'servingUnit',calories=(fields->>'calories')::numeric,protein_g=(fields->>'proteinG')::numeric,carbs_g=(fields->>'carbsG')::numeric,fat_g=(fields->>'fatG')::numeric,source_note=fields->>'sourceNote' where id=source_id and user_id=u returning * into f;
   when 'archive' then update public.foods set is_active=false where id=source_id and user_id=u returning * into f;
   when 'reactivate' then update public.foods set is_active=true where id=source_id and user_id=u returning * into f;
   when 'delete' then delete from public.foods where id=source_id and user_id=u;
  end case;
  result:=jsonb_build_object('status','confirmed','operation',p_intent->>'operation','id',f.id,'version',case when p_intent->>'operation'='delete' then null else public.mobile_quick_source_version(to_jsonb(f)) end,'updatedAt',case when p_intent->>'operation'='delete' then null else f.updated_at end);
 exception
  when unique_violation then
   get stacked diagnostics constraint_name=constraint_name;
   if constraint_name<>'foods_user_active_name_unique' then raise; end if;
   code:=409; result:=jsonb_build_object('error','FOOD_NAME_EXISTS','message','Ya existe un alimento activo con ese nombre.');
  when sqlstate 'P0422' then
   code:=409; result:=jsonb_build_object('error',sqlerrm,'message',case sqlerrm when 'FOOD_CHANGED' then 'El alimento cambió. Conservamos tu borrador para revisar la versión actual.' else 'El alimento ya no está disponible.' end);
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='food',resource_id=f.id,completed_at=clock_timestamp()
 where user_id=u and operation=op and idempotency_key=k;
 return query select code,result,false;
end;
$$;
create or replace function public.mobile_normalize_quick_selection(p_selection jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' set timezone='UTC'
as $$
declare s jsonb; q jsonb; qs jsonb := 'null'::jsonb; dt date; sid uuid; n numeric;
begin
 if p_selection is null or jsonb_typeof(p_selection)<>'object' or (select count(*) from jsonb_object_keys(p_selection))<>3
  or not p_selection ?& array['date','source','quantities'] then raise exception using errcode='22023',message='INVALID_QUICK_SELECTION'; end if;
 if jsonb_typeof(p_selection->'date') is distinct from 'string' then raise exception using errcode='22023',message='INVALID_DATE'; end if;
 dt:=(p_selection->>'date')::date; s:=p_selection->'source';
 if dt is null or not isfinite(dt) or dt::text<>p_selection->>'date' or jsonb_typeof(s) is distinct from 'object'
  or (select count(*) from jsonb_object_keys(s))<>3 or not s ?& array['kind','id','version']
  or coalesce(s->>'kind','') not in ('suggestion','saved','food') or coalesce(s->>'version','') !~ '^[a-f0-9]{64}$'
  or jsonb_typeof(s->'id') is distinct from 'string' or jsonb_typeof(s->'kind') is distinct from 'string' or jsonb_typeof(s->'version') is distinct from 'string' then raise exception using errcode='22023',message='INVALID_QUICK_SOURCE'; end if;
 sid:=(s->>'id')::uuid;
 if sid is null then raise exception using errcode='22023',message='INVALID_QUICK_SOURCE'; end if;
 if p_selection->'quantities'<>'null'::jsonb then
  if s->>'kind' not in ('saved','food') or jsonb_typeof(p_selection->'quantities') is distinct from 'array'
   or jsonb_array_length(p_selection->'quantities') not between 1 and 50 then raise exception using errcode='22023',message='INVALID_QUANTITIES'; end if;
  qs:='[]'::jsonb;
  for q in select value from jsonb_array_elements(p_selection->'quantities') loop
   if jsonb_typeof(q)<>'object' or (select count(*) from jsonb_object_keys(q))<>2
    or not q ?& array['itemId','quantity'] or (q->>'itemId')::uuid is null
    or jsonb_typeof(q->'quantity') is distinct from 'number' then raise exception using errcode='22023',message='INVALID_QUANTITIES'; end if;
   n:=(q->>'quantity')::numeric;
   if n<=0 or n>1000000 or n<>round(n,case when s->>'kind'='food' then 3 else 2 end) then raise exception using errcode='22023',message='INVALID_QUANTITIES'; end if;
   qs:=qs||jsonb_build_array(jsonb_build_object('itemId',(q->>'itemId')::uuid,'quantity',case when s->>'kind'='food' then n::numeric(12,3) else n::numeric(12,2) end));
  end loop;
  if (select count(distinct value->>'itemId') from jsonb_array_elements(qs))<>jsonb_array_length(qs) then raise exception using errcode='22023',message='DUPLICATE_ITEM'; end if;
  select jsonb_agg(value order by value->>'itemId') into qs from jsonb_array_elements(qs);
 end if;
 if s->>'kind'='food' and (qs='null'::jsonb or jsonb_array_length(qs)<>1 or (qs->0->>'itemId')::uuid<>sid) then raise exception using errcode='22023',message='INVALID_FOOD_QUANTITY'; end if;
 return jsonb_build_object('date',dt::text,'source',jsonb_build_object('kind',s->>'kind','id',sid,'version',s->>'version'),'quantities',qs);
end;
$$;

create or replace function public.mobile_resolve_quick_occurrence(p_selection jsonb,p_lock boolean default false)
returns jsonb language plpgsql security invoker set search_path='' set timezone='UTC'
set lock_timeout='3s' set statement_timeout='8s'
as $$
declare u uuid := (select auth.uid()); sel jsonb; src jsonb; m public.meal_entries; s public.saved_meals;
 raw_items jsonb; scaled jsonb := '[]'::jsonb; item jsonb; qs jsonb; n numeric; factor numeric; dt date;
 version text; source_date date; saved_json jsonb; meal_json jsonb; today date := (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 title text; description text; calories numeric; protein numeric; carbs numeric; fat numeric; context_type text;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 sel:=public.mobile_normalize_quick_selection(p_selection); src:=sel->'source'; dt:=(sel->>'date')::date; qs:=sel->'quantities';
 if src->>'kind'='food' then return public.mobile_resolve_food_occurrence(sel,p_lock); end if;
 if src->>'kind'='suggestion' then
  if p_lock then select * into m from public.meal_entries where id=(src->>'id')::uuid and user_id=u for share;
  end if;
  select to_jsonb(mm),d.log_date into meal_json,source_date from public.meal_entries mm join public.day_logs d on d.id=mm.day_log_id and d.user_id=u where mm.id=(src->>'id')::uuid and mm.user_id=u;
  m:=jsonb_populate_record(null::public.meal_entries,meal_json);
  if m.id is null or m.deleted_at is not null or m.entry_kind<>'meal' or m.source_type is distinct from 'manual' then raise exception using errcode='P0421',message='QUICK_SOURCE_UNAVAILABLE'; end if;
  if source_date is null or source_date not between today-60 and today-1 then raise exception using errcode='P0421',message='QUICK_SOURCE_UNAVAILABLE'; end if;
  version:=public.mobile_quick_source_version(jsonb_build_object('meal',to_jsonb(m),'logDate',source_date));
  if version<>src->>'version' then raise exception using errcode='P0421',message='QUICK_SOURCE_CHANGED'; end if;
  title:=m.title; description:=m.description; calories:=m.final_calories; protein:=m.final_protein_g; carbs:=m.final_carbs_g; fat:=m.final_fat_g;
  if coalesce(nullif(btrim(title),''),nullif(btrim(description),'')) is null then raise exception using errcode='P0421',message='QUICK_SOURCE_UNUSABLE'; end if;
 else
  if p_lock then
   select * into s from public.saved_meals where id=(src->>'id')::uuid and user_id=u for share;
   if found then perform 1 from public.saved_meal_items where saved_meal_id=s.id and user_id=u order by position,id for share; end if;
  end if;
  select to_jsonb(ss),c.items into saved_json,raw_items from public.saved_meals ss cross join lateral (
   select coalesce(jsonb_agg(to_jsonb(i) order by i.position,i.id),'[]'::jsonb) items from public.saved_meal_items i where i.saved_meal_id=ss.id and i.user_id=u
  ) c where ss.id=(src->>'id')::uuid and ss.user_id=u;
  s:=jsonb_populate_record(null::public.saved_meals,saved_json);
  if s.id is null or not s.is_active then raise exception using errcode='P0421',message='QUICK_SOURCE_UNAVAILABLE'; end if;
  version:=public.mobile_quick_source_version(jsonb_build_object('saved',to_jsonb(s),'items',raw_items));
  if version<>src->>'version' then raise exception using errcode='P0421',message='QUICK_SOURCE_CHANGED'; end if;
  title:=s.name; description:=s.description; calories:=s.calories; protein:=s.protein_g; carbs:=s.carbs_g; fat:=s.fat_g; context_type:='saved_meal';
  if s.template_type='manual' then
   if qs<>'null'::jsonb or jsonb_array_length(raw_items)<>0 then raise exception using errcode='P0421',message='QUICK_SOURCE_CHANGED'; end if;
  else
   if jsonb_array_length(raw_items) not between 1 and 50 then raise exception using errcode='P0421',message='QUICK_SOURCE_UNUSABLE'; end if;
   if qs<>'null'::jsonb and (jsonb_array_length(qs)<>jsonb_array_length(raw_items)
    or exists(select 1 from jsonb_array_elements(qs) q where not exists(select 1 from jsonb_array_elements(raw_items) i where i->>'id'=q->>'itemId'))) then
    raise exception using errcode='P0421',message='QUICK_SOURCE_CHANGED'; end if;
   for item in select value from jsonb_array_elements(raw_items) loop
    if qs='null'::jsonb then n:=(item->>'quantity')::numeric;
    else select (value->>'quantity')::numeric into n from jsonb_array_elements(qs) where value->>'itemId'=item->>'id'; end if;
    -- Preserve current quantity parser's two-decimal rule; do not silently round
    -- existing higher-precision quantities into another occurrence.
    if n is null or n<=0 or n>1000000 or n<>round(n,2) or (item->>'base_quantity')::numeric<=0 then raise exception using errcode='P0421',message='QUICK_SOURCE_UNUSABLE'; end if;
    factor:=n/(item->>'base_quantity')::numeric;
    scaled:=scaled||jsonb_build_array(jsonb_build_object('id',item->>'id','label',item->>'label','quantity',n,'unit',item->>'unit',
     'calories',round((item->>'base_calories')::numeric*factor),'proteinG',round((item->>'base_protein_g')::numeric*factor,2),
     'carbsG',round((item->>'base_carbs_g')::numeric*factor,2),'fatG',round((item->>'base_fat_g')::numeric*factor,2)));
   end loop;
   -- Occurrence semantics match Web: round EACH ingredient before summing.
   select case when count(value->>'calories')=count(*) then sum((value->>'calories')::numeric) end,
    case when count(value->>'proteinG')=count(*) then round(sum((value->>'proteinG')::numeric),2) end,
    case when count(value->>'carbsG')=count(*) then round(sum((value->>'carbsG')::numeric),2) end,
    case when count(value->>'fatG')=count(*) then round(sum((value->>'fatG')::numeric),2) end
   into calories,protein,carbs,fat from jsonb_array_elements(scaled);
   -- Same first-five ingredient description as savedMealOccurrenceDescription.
   select string_agg(replace(replace(replace(rtrim(rtrim(to_char((value->>'quantity')::numeric,'FM999,999,990.00'),'0'),'.'),',','#'),'.',','),'#','.')||' '||(value->>'unit')||' '||lower(value->>'label'),' · ' order by ordinality)
   into description from jsonb_array_elements(scaled) with ordinality where ordinality<=5;
   if jsonb_array_length(scaled)>5 then description:=description||' · +'||(jsonb_array_length(scaled)-5)::text||' ingredientes'; end if;
  end if;
 end if;
 if calories is null or calories<=0 or calories<>trunc(calories) or calories>2147483647
  or protein<0 or protein>999999.99 or carbs<0 or carbs>99999999.99 or fat<0 or fat>99999999.99 then raise exception using errcode='P0421',message='QUICK_SOURCE_UNUSABLE'; end if;
 -- Match the final meal normalization trigger already used by Web/Mobile.
 title:=nullif(upper(regexp_replace(btrim(title),'\s+',' ','g')),'');
 description:=nullif(upper(regexp_replace(btrim(description),'\s+',' ','g')),'');
 return jsonb_build_object('status','preview','selection',sel,'snapshot',jsonb_build_object('title',title,'description',description,
  'calories',calories::integer,'proteinG',protein,'carbsG',carbs,'fatG',fat,'precision',null,'contextType',context_type,'sourceNote',null),'items',scaled);
end;
$$;

revoke all on function public.mobile_read_foods(uuid),public.mobile_normalize_food_fields(jsonb),public.mobile_resolve_food_occurrence(jsonb,boolean),public.mobile_mutate_food(jsonb) from public,anon;
grant execute on function public.mobile_read_foods(uuid),public.mobile_normalize_food_fields(jsonb),public.mobile_resolve_food_occurrence(jsonb,boolean),public.mobile_mutate_food(jsonb) to authenticated;
commit;
