-- M4.1-2 EXPAND. Ledger remains private; the RPC derives identity from auth.uid()
-- and explicitly scopes every domain row. DEFINER is required only because the
-- shared Training ledger has no client grants/policies. No existing RPC changes.
begin;
create function public.mobile_mutate_manual_meal(p_intent jsonb)
returns table(response_status smallint, response_body jsonb, replayed boolean)
language plpgsql security definer set search_path = ''
set lock_timeout = '3s' set statement_timeout = '8s'
set timezone = 'UTC'
as $$
declare
  u uuid := (select auth.uid());
  op text; key text; src date; dst date; mid uuid; expected timestamptz;
  f jsonb; normalized jsonb; hash text; ledger public.mobile_idempotency_keys;
  meal public.meal_entries; day public.day_logs; old_date date;
  result jsonb; code smallint := 200; v_title text; v_description text;
begin
  if u is null then raise exception using errcode='PT401', message='UNAUTHORIZED'; end if;
  if p_intent is null or jsonb_typeof(p_intent) <> 'object'
    or (select count(*) from jsonb_object_keys(p_intent)) <> 7
    or not p_intent ?& array['operation','sourceDate','mealId','expectedUpdatedAt','idempotencyKey','fields','forceDuplicate']
    or p_intent->>'operation' not in ('create','edit','delete')
    or jsonb_typeof(p_intent->'forceDuplicate') <> 'boolean'
    or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$'
    or coalesce(p_intent->>'sourceDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode='22023', message='INVALID_MEAL';
  end if;
  op := p_intent->>'operation'; key := p_intent->>'idempotencyKey'; src := (p_intent->>'sourceDate')::date;
  if not isfinite(src) or src::text <> p_intent->>'sourceDate' then raise exception using errcode='22023', message='INVALID_DATE'; end if;
  if op = 'create' then
    if p_intent->'mealId' <> 'null'::jsonb or p_intent->'expectedUpdatedAt' <> 'null'::jsonb then
      raise exception using errcode='22023', message='INVALID_MEAL';
    end if;
  else
    mid := (p_intent->>'mealId')::uuid; expected := (p_intent->>'expectedUpdatedAt')::timestamptz;
    if mid is null or expected is null or not isfinite(expected) or (p_intent->>'forceDuplicate')::boolean then
      raise exception using errcode='22023', message='INVALID_MEAL';
    end if;
  end if;
  f := p_intent->'fields';
  if op = 'delete' then
    if f <> 'null'::jsonb then raise exception using errcode='22023', message='INVALID_MEAL'; end if;
    dst := src;
  else
    if jsonb_typeof(f) <> 'object' or (select count(*) from jsonb_object_keys(f)) <> 7
      or not f ?& array['date','title','description','calories','proteinG','carbsG','fatG']
      or jsonb_typeof(f->'title') not in ('string','null') or jsonb_typeof(f->'description') not in ('string','null')
      or jsonb_typeof(f->'calories') <> 'number' or (f->>'calories')::numeric <= 0
      or (f->>'calories')::numeric <> trunc((f->>'calories')::numeric) or (f->>'calories')::numeric > 2147483647
      or exists(select 1 from unnest(array['proteinG','carbsG','fatG']) n where
        jsonb_typeof(f->n) not in ('number','null') or (f->>'calories') is null
        or (f->>n)::numeric < 0 or (f->>n)::numeric > case when n='proteinG' then 999999.99 else 99999999.99 end
        or (f->>n)::numeric <> round((f->>n)::numeric,2)) then
      raise exception using errcode='22023', message='INVALID_MEAL';
    end if;
    dst := (f->>'date')::date;
    if dst is null or not isfinite(dst) or dst::text <> f->>'date' or (op='create' and dst<>src) then
      raise exception using errcode='22023', message='INVALID_DATE';
    end if;
    v_title := nullif(upper(regexp_replace(btrim(f->>'title'),'\s+',' ','g')),'');
    v_description := nullif(upper(regexp_replace(btrim(f->>'description'),'\s+',' ','g')),'');
    f := jsonb_build_object('date',dst::text,'title',v_title,'description',v_description,'calories',(f->>'calories')::integer,
      'proteinG',(f->>'proteinG')::numeric(8,2),'carbsG',(f->>'carbsG')::numeric(10,2),'fatG',(f->>'fatG')::numeric(10,2));
  end if;
  normalized := jsonb_build_object('operation',op,'sourceDate',src::text,'mealId',mid,'expectedUpdatedAt',expected,
    'fields',f,'forceDuplicate',(p_intent->>'forceDuplicate')::boolean);
  hash := encode(extensions.digest(convert_to(normalized::text,'UTF8'),'sha256'),'hex');
  op := 'nutrition.meal.' || op || '.v1';
  perform pg_advisory_xact_lock(hashtextextended(u::text, 412));
  -- Durable unresolved intents must never turn into new writes after cleanup.
  -- Nutrition receipts are retained (unlike bounded Training intents).
  insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
  values(u,op,key,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
  select * into ledger from public.mobile_idempotency_keys where user_id=u and operation=op and idempotency_key=key for update;
  if ledger.request_hash <> hash then
    return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','La clave ya fue usada con otros datos.'),false; return;
  end if;
  if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;

  if p_intent->>'operation' <> 'create' then
    select * into meal from public.meal_entries where id=mid and user_id=u for update;
    if not found then code:=404; result:=jsonb_build_object('error','NOT_FOUND','message','La comida no está disponible.');
    else
      select log_date into old_date from public.day_logs where id=meal.day_log_id and user_id=u;
      if meal.deleted_at is not null or meal.entry_kind<>'meal' or meal.source_type is distinct from 'manual' then
        code:=409; result:=jsonb_build_object('error','MEAL_UNAVAILABLE','message','Esta comida ya no se puede editar.');
      elsif meal.updated_at is distinct from expected or old_date is distinct from src then
        code:=409; result:=jsonb_build_object('error','MEAL_CHANGED','message','La comida cambió desde que la abriste.','currentDate',old_date::text);
      end if;
    end if;
  end if;
  if result is null and p_intent->>'operation'<>'delete' then
    select * into day from public.day_logs where user_id=u and log_date=dst;
    -- Match the domain composition trigger's ordering before resolving or
    -- writing a destination; moves must not pre-lock the destination first.
    perform 1 from public.day_logs where user_id=u and id in (day.id,meal.day_log_id) order by id for update;
    if exists(select 1 from public.meal_entries where user_id=u and day_log_id=day.id and deleted_at is null and entry_kind='legacy_daily_summary') then
      code:=409; result:=jsonb_build_object('error','DAY_HAS_HISTORICAL_SUMMARY','message','Ese día contiene un resumen histórico y no admite comidas detalladas.');
    elsif p_intent->>'operation'='create' and not (p_intent->>'forceDuplicate')::boolean and exists(
      select 1 from public.meal_entries m where m.user_id=u and m.day_log_id=day.id and m.deleted_at is null
      and m.created_at>=clock_timestamp()-interval '60 seconds' and trunc(m.final_calories)=(f->>'calories')::integer
      and ((m.final_protein_g is null and f->>'proteinG' is null) or abs(m.final_protein_g-(f->>'proteinG')::numeric)<=0.01)
      and ((m.final_carbs_g is null and f->>'carbsG' is null) or abs(m.final_carbs_g-(f->>'carbsG')::numeric)<=0.01)
      and ((m.final_fat_g is null and f->>'fatG' is null) or abs(m.final_fat_g-(f->>'fatG')::numeric)<=0.01)
      and ((v_title is not null and v_title=m.title) or (v_description is not null and v_description=m.description))) then
      code:=409; result:=jsonb_build_object('error','POSSIBLE_DUPLICATE','message','Hay una comida reciente con los mismos datos. ¿Guardar igual?');
    else day:=public.get_or_create_day_log(dst);
    end if;
  end if;
  if result is null then
    if p_intent->>'operation'='create' then
      insert into public.meal_entries(user_id,day_log_id,title,description,final_calories,final_protein_g,final_carbs_g,final_fat_g,source_type,entry_kind)
      values(u,day.id,v_title,v_description,(f->>'calories')::integer,(f->>'proteinG')::numeric,(f->>'carbsG')::numeric,(f->>'fatG')::numeric,'manual','meal') returning * into meal;
      mid:=meal.id; code:=201;
    elsif p_intent->>'operation'='edit' then
      update public.meal_entries set day_log_id=day.id,title=v_title,description=v_description,final_calories=(f->>'calories')::integer,
        final_protein_g=(f->>'proteinG')::numeric,final_carbs_g=(f->>'carbsG')::numeric,final_fat_g=(f->>'fatG')::numeric
      where id=mid and user_id=u returning * into meal;
    else
      update public.meal_entries set deleted_at=clock_timestamp() where id=mid and user_id=u returning * into meal;
    end if;
    -- Existing composition/owner/normalization/recalculation triggers preserve
    -- snapshots, soft delete, and both origin/destination aggregates atomically.
    result:=jsonb_build_object('status',case when p_intent->>'operation'='delete' then 'deleted' else 'saved' end,
      'mealId',mid,'sourceDate',src::text,'destinationDate',dst::text,'updatedAt',meal.updated_at);
  end if;
  update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,
    resource_type='meal',resource_id=mid,completed_at=clock_timestamp() where user_id=u and operation=op and idempotency_key=key;
  return query select code,result,false;
end;
$$;
revoke all on function public.mobile_mutate_manual_meal(jsonb) from public,anon;
grant execute on function public.mobile_mutate_manual_meal(jsonb) to authenticated;
commit;
