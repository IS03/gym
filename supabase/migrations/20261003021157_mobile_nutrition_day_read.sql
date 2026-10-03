-- M4.1-1 EXPAND. A read-only snapshot; no resolver, initialization or writes.
begin;

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
      'value', v.value, 'updatedAt', v.updated_at
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
