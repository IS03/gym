-- M4.3-2 EXPAND: coherent, read-only period facts. No day initialization/resolvers.
begin;
create or replace function public.mobile_read_nutrition_report(
  p_start date, p_end date, p_expected_today date
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_today date := (pg_catalog.statement_timestamp() at time zone 'America/Argentina/Cordoba')::date;
  v_days jsonb; v_meals jsonb; v_workouts jsonb; v_names jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if p_expected_today is distinct from v_today then
    return jsonb_build_object('status','day_changed','today',v_today::text);
  end if;
  if p_start is null or p_end is null or not pg_catalog.isfinite(p_start)
     or not pg_catalog.isfinite(p_end) or p_start > p_end or p_end > v_today
     or p_end - p_start + 1 > 366 then
    raise exception using errcode='22023', message='invalid_report_range';
  end if;
  -- Every statement shares the calling query's MVCC snapshot (STABLE). RLS
  -- remains authoritative; explicit owner predicates also scope every source.
  begin
    select coalesce(jsonb_agg(to_jsonb(f) order by f.log_date desc),'[]'::jsonb) into v_days
    from (select d.id,d.log_date,d.total_calories_consumed,d.total_protein_g,d.total_carbs_g,d.total_fat_g,
      d.nutrition_target_kcal_snapshot,d.protein_target_g_snapshot,d.water_target_l_snapshot,
      d.estimated_expenditure_kcal_snapshot,d.delta_vs_nutrition_target,d.energy_balance_kcal,
      d.water_l,d.mate_l,d.steps,d.work_effective_snapshot,d.gym_effective_snapshot,d.gym_source_snapshot,
      d.nutrition_goal_period_id,d.nutrition_plan_period_id,d.goal_type_snapshot
      from public.day_logs d where d.user_id=v_uid and d.log_date between p_start and p_end) f;
    select coalesce(jsonb_agg(jsonb_build_object(
      'day_log_id',m.day_log_id,'entry_kind',m.entry_kind,'final_calories',m.final_calories,
      'final_protein_g',m.final_protein_g,'final_carbs_g',m.final_carbs_g,'final_fat_g',m.final_fat_g,
      'source_type',m.source_type,'deleted_at',m.deleted_at)),'[]'::jsonb) into v_meals
    from public.meal_entries m join public.day_logs d on d.id=m.day_log_id
    where m.user_id=v_uid and d.user_id=v_uid and d.log_date between p_start and p_end and m.deleted_at is null;
    select coalesce(jsonb_agg(jsonb_build_object('day_log_id',s.day_log_id,'status',s.status)),'[]'::jsonb) into v_workouts
    from public.workout_sessions s join public.day_logs d on d.id=s.day_log_id
    where s.user_id=v_uid and d.user_id=v_uid and d.log_date between p_start and p_end and s.status='completed';
    select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'name',n.name)),'[]'::jsonb) into v_names
    from (
      select p.id,p.name from public.nutrition_plan_periods p where p.user_id=v_uid and exists
        (select 1 from public.day_logs d where d.user_id=v_uid and d.log_date between p_start and p_end and d.nutrition_plan_period_id=p.id)
      union all
      select p.id,p.name from public.nutrition_goal_periods p where p.user_id=v_uid and exists
        (select 1 from public.day_logs d where d.user_id=v_uid and d.log_date between p_start and p_end and d.nutrition_goal_period_id=p.id)
    ) n;
  exception when others then
    return jsonb_build_object('status','unavailable','today',v_today::text);
  end;
  return jsonb_build_object('status','ok','today',v_today::text,'start',p_start::text,'end',p_end::text,
    'dayLogs',v_days,'meals',v_meals,'workouts',v_workouts,'goalNames',v_names);
end;
$$;
revoke all on function public.mobile_read_nutrition_report(date,date,date) from public,anon;
grant execute on function public.mobile_read_nutrition_report(date,date,date) to authenticated;
comment on function public.mobile_read_nutrition_report(date,date,date) is
  'Mobile period snapshot under caller identity/RLS. Read only; no materialization or current-configuration reinterpretation.';
commit;
