-- M4.2-3 EXPAND: decimal component snapshots and reliable template management.
-- No historical meal entry or existing component snapshot is rewritten.
begin;
alter table public.saved_meal_items alter column base_calories type numeric(12,2) using base_calories::numeric;

-- Mirrors scaleSavedMealItem: round EACH ingredient using Web float arithmetic.
create function public.saved_meal_scaled_nutrients(p_item jsonb,p_quantity numeric)
returns jsonb language sql immutable security invoker set search_path='' as $$
 with f as (select p_quantity::double precision/(p_item->>'base_quantity')::double precision factor)
 select jsonb_build_object(
 'calories',floor((p_item->>'base_calories')::double precision*factor+0.5)::numeric,
 'proteinG',floor(((p_item->>'base_protein_g')::double precision*factor+2.220446049250313e-16)*100+0.5)::numeric/100,
 'carbsG',floor(((p_item->>'base_carbs_g')::double precision*factor+2.220446049250313e-16)*100+0.5)::numeric/100,
 'fatG',floor(((p_item->>'base_fat_g')::double precision*factor+2.220446049250313e-16)*100+0.5)::numeric/100) from f
$$;
create function public.saved_meal_scaled_totals(p_scaled jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object(
 'calories',case when count(*)>0 and count(v->>'calories')=count(*) then sum((v->>'calories')::numeric) end,
 'proteinG',case when count(*)>0 and count(v->>'proteinG')=count(*) then floor((sum((v->>'proteinG')::double precision)+2.220446049250313e-16)*100+0.5)::numeric/100 end,
 'carbsG',case when count(*)>0 and count(v->>'carbsG')=count(*) then floor((sum((v->>'carbsG')::double precision)+2.220446049250313e-16)*100+0.5)::numeric/100 end,
 'fatG',case when count(*)>0 and count(v->>'fatG')=count(*) then floor((sum((v->>'fatG')::double precision)+2.220446049250313e-16)*100+0.5)::numeric/100 end)
 from jsonb_array_elements(p_scaled) v
$$;
create function public.saved_meal_snapshot_totals(p_items jsonb)
returns jsonb language sql immutable security invoker set search_path='' as $$
 select public.saved_meal_scaled_totals(coalesce(jsonb_agg(public.saved_meal_scaled_nutrients(v,(v->>'quantity')::numeric) order by ordinal),'[]'::jsonb))
 from jsonb_array_elements(p_items) with ordinality e(v,ordinal)
$$;
create or replace function public.recalculate_saved_meal_totals(p_saved_meal_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare s public.saved_meals; totals jsonb; items jsonb;
begin
 select * into s from public.saved_meals where id=p_saved_meal_id for update;
 if s.id is null or s.template_type<>'composite' then return; end if;
 select coalesce(jsonb_agg(to_jsonb(i) order by position,id),'[]'::jsonb) into items from public.saved_meal_items i where saved_meal_id=s.id and user_id=s.user_id;
 totals:=public.saved_meal_snapshot_totals(items);
 update public.saved_meals set calories=(totals->>'calories')::integer,protein_g=(totals->>'proteinG')::numeric,
 carbs_g=(totals->>'carbsG')::numeric,fat_g=(totals->>'fatG')::numeric where id=s.id and user_id=s.user_id;
end;
$$;
create or replace function public.save_saved_meal_template(
  p_saved_meal_id uuid,
  p_name text,
  p_description text,
  p_template_type text,
  p_manual_calories integer,
  p_manual_protein_g numeric,
  p_manual_carbs_g numeric,
  p_manual_fat_g numeric,
  p_items jsonb
)
returns public.saved_meals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_meal public.saved_meals;
  v_item_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_template_type not in ('manual', 'composite') then
    raise exception using errcode = '22023', message = 'invalid template type';
  end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'items must be an array';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if p_template_type = 'manual' and v_item_count <> 0 then
    raise exception using errcode = '22023', message = 'manual meals cannot have items';
  end if;
  if p_template_type = 'composite' and (v_item_count < 1 or v_item_count > 50) then
    raise exception using errcode = '22023', message = 'composite meals require 1 to 50 items';
  end if;

  if p_saved_meal_id is null then
    insert into public.saved_meals (
      user_id, name, description, template_type,
      calories, protein_g, carbs_g, fat_g
    ) values (
      v_user_id, p_name, p_description, p_template_type,
      case when p_template_type = 'manual' then p_manual_calories else null end,
      case when p_template_type = 'manual' then p_manual_protein_g else null end,
      case when p_template_type = 'manual' then p_manual_carbs_g else null end,
      case when p_template_type = 'manual' then p_manual_fat_g else null end
    )
    returning * into v_meal;
  else
    update public.saved_meals
    set
      name = p_name,
      description = p_description,
      template_type = p_template_type,
      calories = case when p_template_type = 'manual' then p_manual_calories else null end,
      protein_g = case when p_template_type = 'manual' then p_manual_protein_g else null end,
      carbs_g = case when p_template_type = 'manual' then p_manual_carbs_g else null end,
      fat_g = case when p_template_type = 'manual' then p_manual_fat_g else null end
    where id = p_saved_meal_id
      and user_id = v_user_id
    returning * into v_meal;

    if not found then
      raise exception using errcode = 'P0002', message = 'saved meal not found';
    end if;
  end if;

  delete from public.saved_meal_items
  where saved_meal_id = v_meal.id
    and user_id = v_user_id;

  if p_template_type = 'composite' then
    insert into public.saved_meal_items (
      saved_meal_id, user_id, label, quantity, unit, base_quantity,
      base_calories, base_protein_g, base_carbs_g, base_fat_g,
      source_food_id, position
    )
    select
      v_meal.id,
      v_user_id,
      item.value ->> 'label',
      (item.value ->> 'quantity')::numeric,
      item.value ->> 'unit',
      (item.value ->> 'base_quantity')::numeric,
      (item.value ->> 'base_calories')::numeric,
      (item.value ->> 'base_protein_g')::numeric,
      (item.value ->> 'base_carbs_g')::numeric,
      (item.value ->> 'base_fat_g')::numeric,
      (item.value ->> 'source_food_id')::uuid,
      (item.ordinality - 1)::smallint
    from pg_catalog.jsonb_array_elements(p_items) with ordinality as item(value, ordinality);
  end if;

  select * into v_meal
  from public.saved_meals
  where id = v_meal.id and user_id = v_user_id;
  return v_meal;
end;
$$;


create function public.mobile_read_saved_meals(p_id uuid default null)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare u uuid:=(select auth.uid()); result jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('items',c.items,'version',public.mobile_quick_source_version(jsonb_build_object('saved',to_jsonb(s),'items',c.items)))
 ||case when s.template_type='composite' then jsonb_build_object('calories',t.n->'calories','protein_g',t.n->'proteinG','carbs_g',t.n->'carbsG','fat_g',t.n->'fatG') else '{}'::jsonb end order by s.is_active desc,s.name,s.id),'[]'::jsonb)
 into result from public.saved_meals s cross join lateral(
 select coalesce(jsonb_agg(to_jsonb(i) order by position,id),'[]'::jsonb) items from public.saved_meal_items i where i.saved_meal_id=s.id and i.user_id=u
 ) c cross join lateral(select public.saved_meal_snapshot_totals(c.items) n) t where s.user_id=u and (p_id is null or s.id=p_id);
 return result;
end;
$$;
create function public.mobile_normalize_saved_fields(p_fields jsonb)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
declare f jsonb; items jsonb:='[]'::jsonb; i jsonb; key text; n numeric; kind text;
begin
 if jsonb_typeof(p_fields) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_fields))<>8
 or not p_fields ?& array['name','description','templateType','calories','proteinG','carbsG','fatG','items']
 or jsonb_typeof(p_fields->'name') is distinct from 'string' or nullif(btrim(p_fields->>'name'),'') is null
 or jsonb_typeof(p_fields->'description') not in ('null','string') or coalesce(p_fields->>'templateType','') not in ('manual','composite')
 or jsonb_typeof(p_fields->'items') is distinct from 'array' then raise exception using errcode='22023',message='INVALID_SAVED_FIELDS'; end if;
 f:=jsonb_build_object('name',upper(regexp_replace(btrim(p_fields->>'name'),'\s+',' ','g')),'description',nullif(regexp_replace(btrim(p_fields->>'description'),'\s+',' ','g'),''),'templateType',p_fields->>'templateType');
 foreach key in array array['calories','proteinG','carbsG','fatG'] loop
  n:=null;
  if p_fields->key<>'null'::jsonb then
   if jsonb_typeof(p_fields->key) is distinct from 'number' then raise exception using errcode='22023',message='INVALID_SAVED_NUTRIENT'; end if;
   n:=(p_fields->>key)::numeric;
   if n<0 or n>(case when key='calories' then 2147483647 else 99999999.99 end) or n<>round(n,case when key='calories' then 0 else 2 end) then raise exception using errcode='22023',message='INVALID_SAVED_NUTRIENT'; end if;
  end if;
  f:=f||jsonb_build_object(key,n);
 end loop;
 for i in select value from jsonb_array_elements(p_fields->'items') loop
  kind:=i->>'kind';
  if jsonb_typeof(i) is distinct from 'object' or coalesce(kind,'') not in ('food','snapshot')
   or (select count(*) from jsonb_object_keys(i))<>(case when kind='food' then 4 else 3 end)
   or not i ?& array['kind','id','quantity'] or jsonb_typeof(i->'id') is distinct from 'string' or (i->>'id')::uuid is null
   or jsonb_typeof(i->'quantity') is distinct from 'number'
   or kind='food' and (jsonb_typeof(i->'version') is distinct from 'string' or coalesce(i->>'version','') !~ '^[a-f0-9]{64}$') then raise exception using errcode='22023',message='INVALID_SAVED_ITEM'; end if;
  n:=(i->>'quantity')::numeric;
  if n<=0 or n>1000000 or n<>round(n,2) then raise exception using errcode='22023',message='INVALID_SAVED_QUANTITY'; end if;
  items:=items||jsonb_build_array(jsonb_build_object('kind',kind,'id',(i->>'id')::uuid,'quantity',n::numeric(12,2))||case when kind='food' then jsonb_build_object('version',i->>'version') else '{}'::jsonb end);
 end loop;
 if (select count(distinct (value->>'kind')||':'||(value->>'id')) from jsonb_array_elements(items))<>jsonb_array_length(items) then raise exception using errcode='22023',message='DUPLICATE_SAVED_ITEM'; end if;
 if p_fields->>'templateType'='manual' then
  if jsonb_array_length(items)<>0 or f->>'calories' is null and f->>'proteinG' is null and f->>'carbsG' is null and f->>'fatG' is null then raise exception using errcode='22023',message='MISSING_SAVED_NUTRITION'; end if;
 else
  if jsonb_array_length(items) not between 1 and 50 or f->>'calories' is not null or f->>'proteinG' is not null or f->>'carbsG' is not null or f->>'fatG' is not null then raise exception using errcode='22023',message='INVALID_COMPOSITE'; end if;
 end if;
 return f||jsonb_build_object('items',items);
end;
$$;
create function public.mobile_materialize_saved_items(p_saved_id uuid,p_items jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare u uuid:=(select auth.uid()); i jsonb; s public.saved_meal_items; f public.foods; result jsonb:='[]'::jsonb; source_ids uuid[]:='{}'; provenance uuid;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 for i in select value from jsonb_array_elements(p_items) loop
  if i->>'kind'='snapshot' then
   select * into s from public.saved_meal_items where id=(i->>'id')::uuid and saved_meal_id=p_saved_id and user_id=u for update;
   if s.id is null then raise exception using errcode='P0423',message='SAVED_CHANGED'; end if;
   provenance:=s.source_food_id;
   result:=result||jsonb_build_array(jsonb_build_object('label',s.label,'quantity',(i->>'quantity')::numeric,'unit',s.unit,'base_quantity',s.base_quantity,'base_calories',s.base_calories,'base_protein_g',s.base_protein_g,'base_carbs_g',s.base_carbs_g,'base_fat_g',s.base_fat_g,'source_food_id',provenance));
  else
   select * into f from public.foods where id=(i->>'id')::uuid and user_id=u for share;
   if f.id is null or not f.is_active then raise exception using errcode='P0423',message='SAVED_FOOD_UNAVAILABLE'; end if;
   if public.mobile_quick_source_version(to_jsonb(f))<>i->>'version' then raise exception using errcode='P0423',message='SAVED_FOOD_CHANGED'; end if;
   provenance:=f.id;
   result:=result||jsonb_build_array(jsonb_build_object('label',f.name,'quantity',(i->>'quantity')::numeric,'unit',f.serving_unit,'base_quantity',f.serving_quantity,'base_calories',f.calories,'base_protein_g',f.protein_g,'base_carbs_g',f.carbs_g,'base_fat_g',f.fat_g,'source_food_id',provenance));
  end if;
  if provenance is not null then
   if provenance=any(source_ids) then raise exception using errcode='22023',message='DUPLICATE_SAVED_FOOD'; end if;
   source_ids:=array_append(source_ids,provenance);
  end if;
 end loop;
 return result;
end;
$$;
create function public.mobile_mutate_saved_meal(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC'
set lock_timeout='3s' set statement_timeout='8s'
as $$
declare u uuid:=(select auth.uid()); op text; k text; fields jsonb; normalized jsonb; hash text; source_id uuid; expected text;
 ledger public.mobile_idempotency_keys; f public.saved_meals; raw_items jsonb; materialized jsonb; code smallint:=201; result jsonb; constraint_name text;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if p_intent is null or jsonb_typeof(p_intent)<>'object' or (select count(*) from jsonb_object_keys(p_intent))<>5
 or not p_intent ?& array['operation','id','expectedVersion','fields','idempotencyKey']
 or jsonb_typeof(p_intent->'operation') is distinct from 'string' or p_intent->>'operation' not in ('create','update','archive','reactivate','delete')
 or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then raise exception using errcode='22023',message='INVALID_SAVED_INTENT'; end if;
 op:=p_intent->>'operation'; k:=p_intent->>'idempotencyKey';
 if op='create' then
  if p_intent->'id'<>'null'::jsonb or p_intent->'expectedVersion'<>'null'::jsonb then raise exception using errcode='22023',message='INVALID_SAVED_ID'; end if;
 else
  if jsonb_typeof(p_intent->'id') is distinct from 'string' or jsonb_typeof(p_intent->'expectedVersion') is distinct from 'string' or coalesce(p_intent->>'expectedVersion','') !~ '^[a-f0-9]{64}$' then raise exception using errcode='22023',message='INVALID_SAVED_VERSION'; end if;
  source_id:=(p_intent->>'id')::uuid; expected:=p_intent->>'expectedVersion';
 end if;
 if op in ('create','update') then fields:=public.mobile_normalize_saved_fields(p_intent->'fields');
 elsif p_intent->'fields'<>'null'::jsonb then raise exception using errcode='22023',message='INVALID_SAVED_FIELDS'; end if;
 normalized:=jsonb_build_object('operation',op,'id',source_id,'expectedVersion',expected,'fields',fields); hash:=public.mobile_quick_source_version(normalized);
 op:='nutrition.saved.'||op||'.v1';
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,op,k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation=op and idempotency_key=k for update;
 if ledger.request_hash<>hash then return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','La clave ya fue usada con otros datos.'),false; return; end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  if source_id is not null then
   select * into f from public.saved_meals where id=source_id and user_id=u for update;
   if f.id is null then raise exception using errcode='P0423',message='SAVED_UNAVAILABLE'; end if;
   perform 1 from public.saved_meal_items where saved_meal_id=f.id and user_id=u order by position,id for update;
   select coalesce(jsonb_agg(to_jsonb(i) order by position,id),'[]'::jsonb) into raw_items from public.saved_meal_items i where saved_meal_id=f.id and user_id=u;
   if public.mobile_quick_source_version(jsonb_build_object('saved',to_jsonb(f),'items',raw_items))<>expected then raise exception using errcode='P0423',message='SAVED_CHANGED'; end if;
  end if;
  if p_intent->>'operation' in ('create','update') then
   materialized:=public.mobile_materialize_saved_items(source_id,fields->'items');
   select * into f from public.save_saved_meal_template(source_id,fields->>'name',fields->>'description',fields->>'templateType',
   (fields->>'calories')::integer,(fields->>'proteinG')::numeric,(fields->>'carbsG')::numeric,(fields->>'fatG')::numeric,materialized);
  elsif p_intent->>'operation'='archive' then update public.saved_meals set is_active=false where id=source_id and user_id=u returning * into f;
  elsif p_intent->>'operation'='reactivate' then update public.saved_meals set is_active=true where id=source_id and user_id=u returning * into f;
  else delete from public.saved_meals where id=source_id and user_id=u; end if;
  select coalesce(jsonb_agg(to_jsonb(i) order by position,id),'[]'::jsonb) into raw_items from public.saved_meal_items i where saved_meal_id=f.id and user_id=u;
  result:=jsonb_build_object('status','confirmed','operation',p_intent->>'operation','id',f.id,'version',case when p_intent->>'operation'='delete' then null else public.mobile_quick_source_version(jsonb_build_object('saved',to_jsonb(f),'items',raw_items)) end,'updatedAt',case when p_intent->>'operation'='delete' then null else f.updated_at end);
 exception
  when unique_violation then
   get stacked diagnostics constraint_name=constraint_name;
   if constraint_name<>'saved_meals_user_active_name_unique' then raise; end if;
   code:=409; result:=jsonb_build_object('error','SAVED_NAME_EXISTS','message','Ya existe una comida guardada activa con ese nombre.');
  when sqlstate 'P0423' then
   code:=409; result:=jsonb_build_object('error',sqlerrm,'message',case sqlerrm when 'SAVED_CHANGED' then 'La plantilla cambió. Conservamos tu borrador para revisar.' else 'La plantilla o un alimento seleccionado ya no está disponible o cambió.' end);
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='saved_meal',resource_id=f.id,completed_at=clock_timestamp()
 where user_id=u and operation=op and idempotency_key=k;
 return query select code,result,false;
end;
$$;
create or replace function public.mobile_read_quick_options()
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC'
as $$
declare u uuid := (select auth.uid()); today date := (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 saved jsonb; suggested jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 begin
  select jsonb_build_object('status','ok','rows',coalesce(jsonb_agg(value order by value->>'name',value->>'id'),'[]'::jsonb)) into saved from jsonb_array_elements(public.mobile_read_saved_meals()) where (value->>'is_active')::boolean;
 exception when others then saved:=jsonb_build_object('status','unavailable'); end;
 begin
  select jsonb_build_object('status','ok','rows',coalesce(jsonb_agg(fact order by created_at desc,id),'[]'::jsonb)) into suggested from (
   select m.id,m.created_at,to_jsonb(m)||jsonb_build_object('log_date',d.log_date,
    'version',public.mobile_quick_source_version(jsonb_build_object('meal',to_jsonb(m),'logDate',d.log_date))) fact
   from public.meal_entries m join public.day_logs d on d.id=m.day_log_id and d.user_id=u
   where m.user_id=u and m.deleted_at is null and m.entry_kind='meal' and m.source_type='manual'
    and d.log_date between today-60 and today-1 order by m.created_at desc,m.id limit 200
  ) facts;
 exception when others then suggested:=jsonb_build_object('status','unavailable'); end;
 return jsonb_build_object('today',today::text,'saved',saved,'suggested',suggested);
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
    scaled:=scaled||jsonb_build_array(jsonb_build_object('id',item->>'id','label',item->>'label','quantity',n,'unit',item->>'unit')||public.saved_meal_scaled_nutrients(item,n));
   end loop;
   select (t->>'calories')::numeric,(t->>'proteinG')::numeric,(t->>'carbsG')::numeric,(t->>'fatG')::numeric
   into calories,protein,carbs,fat from (select public.saved_meal_scaled_totals(scaled) t) totals;
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


revoke all on function public.saved_meal_scaled_nutrients(jsonb,numeric),public.saved_meal_scaled_totals(jsonb),public.saved_meal_snapshot_totals(jsonb),public.mobile_read_saved_meals(uuid),public.mobile_normalize_saved_fields(jsonb),public.mobile_materialize_saved_items(uuid,jsonb),public.mobile_mutate_saved_meal(jsonb) from public,anon;
grant execute on function public.saved_meal_scaled_nutrients(jsonb,numeric),public.saved_meal_scaled_totals(jsonb),public.saved_meal_snapshot_totals(jsonb),public.mobile_read_saved_meals(uuid),public.mobile_normalize_saved_fields(jsonb),public.mobile_materialize_saved_items(uuid,jsonb),public.mobile_mutate_saved_meal(jsonb) to authenticated;
commit;
