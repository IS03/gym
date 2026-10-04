-- M6 EXPAND: calculated discovery and exact-date Body; no new tables/writers.
begin;
create function public.mobile_read_history_range(p_from date default null, p_to date default null)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare
 u uuid := (select auth.uid()); today date := (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 start_date date; requested_end date; end_date date;
 training jsonb := null; nutrition jsonb := null; weights jsonb := null; measurements jsonb := null; metrics jsonb := null;
 days jsonb;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if (p_from is null) <> (p_to is null) then raise exception using errcode='22023',message='INVALID_HISTORY_RANGE'; end if;
 start_date := coalesce(p_from,today-29); requested_end := coalesce(p_to,today);
 if not isfinite(start_date) or not isfinite(requested_end) or start_date>requested_end
  or requested_end-start_date+1>62 or start_date>today then
  raise exception using errcode='22023',message='INVALID_HISTORY_RANGE';
 end if;
 end_date := least(requested_end,today);
 -- Independent subqueries: a failed source stays unknown, never zero/false.
 begin
  select coalesce(jsonb_object_agg(x.dt::text,x.n),'{}'::jsonb) into training from (
   select d.log_date dt,count(*) n from public.workout_sessions s
   join public.day_logs d on d.id=s.day_log_id and d.user_id=u
   where s.user_id=u and s.status='completed' and s.ended_at is not null
    and d.log_date between start_date and end_date group by d.log_date) x;
 exception when others then training := null; end;
 begin
  select coalesce(jsonb_object_agg(d.log_date::text,jsonb_build_object('entries',coalesce(m.n,0),
   'overrides',d.nutrition_target_override_kcal is not null or d.expenditure_override_kcal is not null
    or d.work_override is not null or d.gym_override is not null)),'{}'::jsonb)
  into nutrition from public.day_logs d left join (
   select e.day_log_id,count(*) n from public.meal_entries e
   join public.day_logs dl on dl.id=e.day_log_id and dl.user_id=u
   where e.user_id=u and e.deleted_at is null and e.entry_kind in ('meal','legacy_daily_summary')
    and dl.log_date between start_date and end_date group by e.day_log_id
  ) m on m.day_log_id=d.id where d.user_id=u and d.log_date between start_date and end_date;
 exception when others then nutrition := null; end;
 begin
  select coalesce(jsonb_object_agg(d.log_date::text,true),'{}'::jsonb) into weights
   from public.day_logs d where d.user_id=u and d.weight_kg is not null and d.log_date between start_date and end_date;
 exception when others then weights := null; end;
 begin
  select coalesce(jsonb_object_agg(x.dt::text,x.n),'{}'::jsonb) into measurements from (
   select m.measured_on dt,count(*) n from public.body_measurements m
    where m.user_id=u and m.measured_on between start_date and end_date group by m.measured_on) x;
 exception when others then measurements := null; end;
 begin
  select coalesce(jsonb_object_agg(x.dt::text,x.n),'{}'::jsonb) into metrics from (
   select v.metric_date dt,count(*) n from public.daily_metric_values v
    where v.user_id=u and v.metric_date between start_date and end_date group by v.metric_date) x;
 exception when others then metrics := null; end;
 select jsonb_agg(jsonb_build_object('date',dt::text,
  'completedSessionsCount',case when training is null then null else coalesce((training->>dt::text)::bigint,0) end,
  'nutritionEntriesCount',case when nutrition is null then null else coalesce((nutrition->dt::text->>'entries')::bigint,0) end,
  'hasExplicitOverrides',case when nutrition is null then null else coalesce((nutrition->dt::text->>'overrides')::boolean,false) end,
  'hasWeight',case when weights is null then null else coalesce((weights->>dt::text)::boolean,false) end,
  'measurementsCount',case when measurements is null then null else coalesce((measurements->>dt::text)::bigint,0) end,
  'metricValuesCount',case when metrics is null then null else coalesce((metrics->>dt::text)::bigint,0) end) order by dt)
 into days from (select start_date+i dt from generate_series(0,end_date-start_date) i) dates;
 return jsonb_build_object('today',today::text,
  'requestedRange',jsonb_build_object('from',start_date::text,'to',requested_end::text),
  'effectiveRange',jsonb_build_object('from',start_date::text,'to',end_date::text),
  'availability',jsonb_build_object('training',case when training is null then 'unavailable' else 'ok' end,
   'nutrition',case when nutrition is null then 'unavailable' else 'ok' end,
   'weight',case when weights is null then 'unavailable' else 'ok' end,
   'measurements',case when measurements is null then 'unavailable' else 'ok' end,
   'metrics',case when metrics is null then 'unavailable' else 'ok' end), 'days',days);
end;
$$;
revoke all on function public.mobile_read_history_range(date,date) from public,anon;
grant execute on function public.mobile_read_history_range(date,date) to authenticated;

create function public.mobile_read_body_day(p_date date)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
declare u uuid := (select auth.uid()); today date := (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
 weight jsonb; measurement jsonb; kg numeric; m public.body_measurements;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if p_date is null or not isfinite(p_date) or p_date>today then raise exception using errcode='22023',message='INVALID_BODY_DATE'; end if;
 begin
  select d.weight_kg into kg from public.day_logs d where d.user_id=u and d.log_date=p_date;
  weight := jsonb_build_object('status','ok','data',case when kg is null then null
   else jsonb_build_object('date',p_date::text,'weightKg',kg) end);
 exception when others then weight := jsonb_build_object('status','unavailable'); end;
 begin
  select b.* into m from public.body_measurements b where b.user_id=u and b.measured_on=p_date;
  measurement := jsonb_build_object('status','ok','data',case when m.id is null then null else public.mobile_body_measurement_dto(m) end);
 exception when others then measurement := jsonb_build_object('status','unavailable'); end;
 return jsonb_build_object('date',p_date::text,'today',today::text,'weight',weight,'measurement',measurement);
end;
$$;
revoke all on function public.mobile_read_body_day(date) from public,anon;
grant execute on function public.mobile_read_body_day(date) to authenticated;

-- Read archived values even today; the existing writer still forbids editing
-- archived metrics today. This replaces only the visibility predicate.
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
      and (m.is_active or v.id is not null);

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


-- Identity read for conflict recovery when a measurement changed date.
create function public.mobile_read_body_measurement(p_id uuid)
returns jsonb language plpgsql stable security invoker set search_path='' set timezone='UTC' as $$
begin
 return (select public.mobile_body_measurement_dto(m) from public.body_measurements m
 where m.id=p_id and m.user_id=(select auth.uid()));
end;
$$;
revoke all on function public.mobile_read_body_measurement(uuid) from public,anon;
grant execute on function public.mobile_read_body_measurement(uuid) to authenticated;
commit;
