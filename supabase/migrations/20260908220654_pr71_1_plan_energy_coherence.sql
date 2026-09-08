-- PR71.1: personalización versionada del gasto base y coherencia del resolver V2.
begin;

alter table public.energy_config_periods
  add column base_expenditure_mode text not null default 'automatic',
  add column custom_base_expenditure_kcal integer,
  add constraint energy_config_periods_base_mode_check
    check (base_expenditure_mode in ('automatic', 'custom')),
  add constraint energy_config_periods_custom_base_range
    check (custom_base_expenditure_kcal is null or custom_base_expenditure_kcal between 1 and 20000),
  add constraint energy_config_periods_base_mode_value_check
    check (
      (base_expenditure_mode = 'automatic' and custom_base_expenditure_kcal is null)
      or (base_expenditure_mode = 'custom' and custom_base_expenditure_kcal is not null)
    );

drop function public.save_energy_config_v2(text, integer);

create function public.save_energy_config_v2(
  p_activity_level text,
  p_training_expenditure_delta_kcal integer,
  p_base_expenditure_mode text,
  p_custom_base_expenditure_kcal integer
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_factor numeric(4,2);
  v_config_id uuid;
  v_day_log_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  v_factor := case p_activity_level
    when 'low' then 1.20
    when 'moderate' then 1.25
    when 'high' then 1.35
    else null
  end;
  if v_factor is null then raise exception 'invalid_activity_level'; end if;
  if p_base_expenditure_mode not in ('automatic', 'custom') then
    raise exception 'invalid_base_expenditure_mode';
  end if;
  if (p_base_expenditure_mode = 'automatic' and p_custom_base_expenditure_kcal is not null)
    or (p_base_expenditure_mode = 'custom' and p_custom_base_expenditure_kcal is null) then
    raise exception 'invalid_custom_base_expenditure';
  end if;

  insert into public.energy_config_periods (
    user_id, effective_from, activity_level, activity_factor,
    training_expenditure_delta_kcal, formula_version,
    base_expenditure_mode, custom_base_expenditure_kcal
  ) values (
    v_user_id, v_today, p_activity_level, v_factor,
    p_training_expenditure_delta_kcal, 'harris_benedict_product_v1',
    p_base_expenditure_mode, p_custom_base_expenditure_kcal
  )
  on conflict (user_id, effective_from) do update set
    activity_level = excluded.activity_level,
    activity_factor = excluded.activity_factor,
    training_expenditure_delta_kcal = excluded.training_expenditure_delta_kcal,
    formula_version = excluded.formula_version,
    base_expenditure_mode = excluded.base_expenditure_mode,
    custom_base_expenditure_kcal = excluded.custom_base_expenditure_kcal
  returning id into v_config_id;

  select d.id into v_day_log_id from public.day_logs d
  where d.user_id = v_user_id and d.log_date = v_today;
  if v_day_log_id is not null then perform public.refresh_nutrition_day(v_day_log_id); end if;
  return v_config_id;
end;
$$;

revoke all on function public.save_energy_config_v2(text, integer, text, integer) from public, anon;
grant execute on function public.save_energy_config_v2(text, integer, text, integer) to authenticated;

create or replace function public.resolve_nutrition_context(p_log_date date)
returns table (
  day_log_id uuid,
  work_effective boolean,
  gym_effective boolean,
  work_source text,
  gym_source text,
  work_schedule_period_id uuid,
  nutrition_goal_period_id uuid,
  expenditure_rule_period_id uuid,
  nutrition_target_kcal integer,
  protein_target_g numeric,
  water_target_l numeric,
  estimated_expenditure_kcal integer,
  total_calories_consumed integer,
  total_protein_g numeric,
  total_carbs_g numeric,
  total_fat_g numeric,
  water_l numeric,
  mate_l numeric,
  steps integer,
  delta_vs_nutrition_target integer,
  energy_balance_kcal integer
)
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_day public.day_logs;
  v_schedule public.work_schedule_periods;
  v_goal public.nutrition_goal_periods;
  v_expenditure public.expenditure_rule_periods;
  v_plan public.nutrition_plan_periods;
  v_plan_day public.nutrition_plan_weekdays;
  v_energy public.energy_config_periods;
  v_profile public.profiles;
  v_work boolean;
  v_completed_training boolean := false;
  v_legacy_gym boolean := false;
  v_gym boolean := false;
  v_work_source text;
  v_gym_source text := 'none';
  v_target integer;
  v_protein numeric;
  v_water numeric;
  v_estimated_expenditure integer;
  v_total_calories integer := 0;
  v_total_protein numeric := 0;
  v_total_carbs numeric := 0;
  v_total_fat numeric := 0;
  v_bmr integer;
  v_automatic_base integer;
  v_base_used integer;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select d.* into v_day from public.day_logs d
  where d.user_id = v_user_id and d.log_date = p_log_date;

  if v_day.id is not null and p_log_date < v_today and v_day.nutrition_resolved_at is not null then
    return query select
      v_day.id, v_day.work_effective_snapshot, coalesce(v_day.gym_effective_snapshot, false),
      v_day.work_source_snapshot, coalesce(v_day.gym_source_snapshot, 'none'),
      v_day.work_schedule_period_id, v_day.nutrition_goal_period_id, v_day.expenditure_rule_period_id,
      v_day.nutrition_target_kcal_snapshot, v_day.protein_target_g_snapshot,
      v_day.water_target_l_snapshot, v_day.estimated_expenditure_kcal_snapshot,
      v_day.total_calories_consumed, v_day.total_protein_g, v_day.total_carbs_g, v_day.total_fat_g,
      v_day.water_l, v_day.mate_l, v_day.steps,
      v_day.delta_vs_nutrition_target, v_day.energy_balance_kcal;
    return;
  end if;

  select p.* into v_schedule from public.work_schedule_periods p
  where p.user_id = v_user_id and p.effective_from <= p_log_date
  order by p.effective_from desc limit 1;

  if v_day.id is not null and v_day.work_override is not null then
    v_work := v_day.work_override; v_work_source := 'override';
  elsif v_schedule.id is not null then
    v_work := case pg_catalog.date_part('isodow', p_log_date)::integer
      when 1 then v_schedule.monday when 2 then v_schedule.tuesday
      when 3 then v_schedule.wednesday when 4 then v_schedule.thursday
      when 5 then v_schedule.friday when 6 then v_schedule.saturday
      when 7 then v_schedule.sunday end;
    v_work_source := 'schedule';
  end if;

  if v_day.id is not null then
    select exists (
      select 1 from public.workout_sessions s
      where s.user_id = v_user_id and s.day_log_id = v_day.id and s.status = 'completed'
    ) into v_completed_training;
  end if;
  if v_completed_training then
    v_legacy_gym := true; v_gym_source := 'workout';
  elsif v_day.id is not null and v_day.gym_override is true then
    v_legacy_gym := true; v_gym_source := 'override';
  end if;

  select p.* into v_plan from public.nutrition_plan_periods p
  where p.user_id = v_user_id and p.effective_from <= p_log_date
  order by p.effective_from desc limit 1;
  if v_plan.id is not null then
    select w.* into v_plan_day from public.nutrition_plan_weekdays w
    where w.plan_id = v_plan.id and w.user_id = v_user_id
      and w.weekday = pg_catalog.date_part('isodow', p_log_date)::integer;
    if v_plan_day.id is not null then
      v_target := v_plan_day.calorie_target_kcal
        + case when v_completed_training then v_plan.training_calorie_delta_kcal else 0 end;
      v_protein := v_plan_day.protein_target_g;
      v_water := v_plan.base_water_l
        + case when v_completed_training then v_plan.training_water_delta_l else 0 end;
    end if;
  else
    select p.* into v_goal from public.nutrition_goal_periods p
    where p.user_id = v_user_id and p.effective_from <= p_log_date
    order by p.effective_from desc limit 1;
    if v_goal.id is not null then
      if v_legacy_gym then
        v_target := v_goal.calories_gym; v_protein := v_goal.protein_gym_g; v_water := v_goal.water_gym_l;
      else
        v_target := v_goal.calories_no_gym; v_protein := v_goal.protein_no_gym_g; v_water := v_goal.water_no_gym_l;
      end if;
    end if;
  end if;

  select p.* into v_energy from public.energy_config_periods p
  where p.user_id = v_user_id and p.effective_from <= p_log_date
  order by p.effective_from desc limit 1;
  if v_day.id is not null and v_day.expenditure_override_kcal is not null then
    v_estimated_expenditure := v_day.expenditure_override_kcal;
  elsif v_energy.id is not null then
    if v_day.id is not null then v_bmr := v_day.bmr_kcal_snapshot; end if;
    if v_bmr is null then
      select p.* into v_profile from public.profiles p where p.user_id = v_user_id;
      v_bmr := v_profile.bmr_kcal_current;
    end if;
    if v_bmr is not null then
      v_automatic_base := pg_catalog.round(v_bmr * v_energy.activity_factor);
      v_base_used := case
        when v_energy.base_expenditure_mode = 'custom' then v_energy.custom_base_expenditure_kcal
        else v_automatic_base
      end;
      v_estimated_expenditure := v_base_used
        + case when v_completed_training then v_energy.training_expenditure_delta_kcal else 0 end;
    end if;
  else
    select p.* into v_expenditure from public.expenditure_rule_periods p
    where p.user_id = v_user_id and p.effective_from <= p_log_date
    order by p.effective_from desc limit 1;
    if v_expenditure.id is not null and v_work is not null then
      v_estimated_expenditure := case
        when v_work and v_legacy_gym then v_expenditure.work_gym_kcal
        when v_work and not v_legacy_gym then v_expenditure.work_no_gym_kcal
        when not v_work and v_legacy_gym then v_expenditure.no_work_gym_kcal
        else v_expenditure.no_work_no_gym_kcal end;
    end if;
  end if;

  v_gym := case when v_plan.id is not null or v_energy.id is not null
    then v_completed_training else v_legacy_gym end;
  if v_gym then v_gym_source := 'workout';
  elsif v_plan.id is not null or v_energy.id is not null then v_gym_source := 'none'; end if;

  if v_day.id is not null then
    v_total_calories := v_day.total_calories_consumed;
    v_total_protein := v_day.total_protein_g;
    v_total_carbs := v_day.total_carbs_g;
    v_total_fat := v_day.total_fat_g;
  end if;

  return query select
    v_day.id, v_work, v_gym, v_work_source, v_gym_source, v_schedule.id,
    case when v_plan.id is null then v_goal.id else null end,
    case when v_energy.id is null then v_expenditure.id else null end,
    v_target, v_protein, v_water, v_estimated_expenditure,
    v_total_calories, v_total_protein, v_total_carbs, v_total_fat,
    v_day.water_l, v_day.mate_l, v_day.steps,
    case when v_target is null then null else v_total_calories - v_target end,
    case when v_estimated_expenditure is null then null else v_total_calories - v_estimated_expenditure end;
end;
$$;

comment on column public.energy_config_periods.base_expenditure_mode is
  'El gasto base V2 usa la estimación automática o un valor personalizado versionado.';
comment on column public.energy_config_periods.custom_base_expenditure_kcal is
  'Gasto base canónico cuando base_expenditure_mode es custom; no incluye entrenamiento.';

commit;
