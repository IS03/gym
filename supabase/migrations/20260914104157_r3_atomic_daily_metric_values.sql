create function public.save_daily_metric_values(
  p_metric_date date,
  p_values jsonb,
  p_historical boolean
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_metric record;
  v_supplied_count integer;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;
  if p_metric_date is null
    or p_values is null
    or jsonb_typeof(p_values) is distinct from 'object'
    or p_historical is null then
    raise exception 'invalid_daily_metric_values';
  end if;

  select count(*) into v_supplied_count
  from jsonb_object_keys(p_values);

  if v_supplied_count <> (
    select count(*)
    from public.user_metrics m
    join jsonb_object_keys(p_values) supplied(metric_id)
      on m.id = supplied.metric_id::uuid
    where m.user_id = v_user_id
      and (p_historical or m.is_active)
  ) then
    raise exception 'metric_not_available';
  end if;

  if p_historical and exists (
    select 1
    from public.user_metrics m
    join jsonb_object_keys(p_values) supplied(metric_id)
      on m.id = supplied.metric_id::uuid
    where m.user_id = v_user_id
      and not m.is_active
      and not exists (
        select 1
        from public.daily_metric_values v
        where v.user_id = v_user_id
          and v.metric_id = m.id
          and v.metric_date = p_metric_date
      )
  ) then
    raise exception 'archived_metric_without_history';
  end if;

  for v_metric in
    select supplied.metric_id::uuid as metric_id, supplied.value
    from jsonb_each(p_values) supplied(metric_id, value)
  loop
    if jsonb_typeof(v_metric.value) = 'null' then
      delete from public.daily_metric_values
      where user_id = v_user_id
        and metric_id = v_metric.metric_id
        and metric_date = p_metric_date;
    else
      insert into public.daily_metric_values (user_id, metric_id, metric_date, value)
      values (
        v_user_id,
        v_metric.metric_id,
        p_metric_date,
        (v_metric.value #>> '{}')::numeric
      )
      on conflict (user_id, metric_date, metric_id)
      do update set value = excluded.value;
    end if;
  end loop;
end;
$$;

revoke all on function public.save_daily_metric_values(date, jsonb, boolean)
from public, anon;
grant execute on function public.save_daily_metric_values(date, jsonb, boolean)
to authenticated;
