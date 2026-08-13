-- Issue #29, fase 2: motor diario nutricional canónico.
-- No carga configuración real ni reinterpreta snapshots legacy/BMR.
begin;

-- Resuelve el contexto vigente de una fecha sin crear ni modificar filas.
-- El usuario siempre proviene de auth.uid(); RLS sigue siendo la barrera de
-- ownership para todas las tablas consultadas.
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
  v_day public.day_logs;
  v_schedule public.work_schedule_periods;
  v_goal public.nutrition_goal_periods;
  v_expenditure public.expenditure_rule_periods;
  v_work boolean;
  v_gym boolean;
  v_work_source text;
  v_gym_source text;
  v_target integer;
  v_protein numeric;
  v_water numeric;
  v_estimated_expenditure integer;
  v_total_calories integer := 0;
  v_total_protein numeric := 0;
  v_total_carbs numeric := 0;
  v_total_fat numeric := 0;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select d.* into v_day
  from public.day_logs d
  where d.user_id = v_user_id
    and d.log_date = p_log_date;

  select p.* into v_schedule
  from public.work_schedule_periods p
  where p.user_id = v_user_id
    and p.effective_from <= p_log_date
  order by p.effective_from desc
  limit 1;

  if v_day.id is not null and v_day.work_override is not null then
    v_work := v_day.work_override;
    v_work_source := 'override';
  elsif v_schedule.id is not null then
    v_work := case pg_catalog.date_part('isodow', p_log_date)::integer
      when 1 then v_schedule.monday
      when 2 then v_schedule.tuesday
      when 3 then v_schedule.wednesday
      when 4 then v_schedule.thursday
      when 5 then v_schedule.friday
      when 6 then v_schedule.saturday
      when 7 then v_schedule.sunday
    end;
    v_work_source := 'schedule';
  else
    v_work := null;
    v_work_source := null;
  end if;

  if v_day.id is not null and exists (
    select 1
    from public.workout_sessions s
    where s.user_id = v_user_id
      and s.day_log_id = v_day.id
      and s.status = 'completed'
  ) then
    v_gym := true;
    v_gym_source := 'workout';
  elsif v_day.id is not null and v_day.gym_override is true then
    v_gym := true;
    v_gym_source := 'override';
  else
    v_gym := false;
    v_gym_source := 'none';
  end if;

  select p.* into v_goal
  from public.nutrition_goal_periods p
  where p.user_id = v_user_id
    and p.effective_from <= p_log_date
  order by p.effective_from desc
  limit 1;

  if v_goal.id is not null then
    if v_gym then
      v_target := v_goal.calories_gym;
      v_protein := v_goal.protein_gym_g;
      v_water := v_goal.water_gym_l;
    else
      v_target := v_goal.calories_no_gym;
      v_protein := v_goal.protein_no_gym_g;
      v_water := v_goal.water_no_gym_l;
    end if;
  end if;

  select p.* into v_expenditure
  from public.expenditure_rule_periods p
  where p.user_id = v_user_id
    and p.effective_from <= p_log_date
  order by p.effective_from desc
  limit 1;

  if v_day.id is not null and v_day.expenditure_override_kcal is not null then
    v_estimated_expenditure := v_day.expenditure_override_kcal;
  elsif v_expenditure.id is not null and v_work is not null then
    v_estimated_expenditure := case
      when v_work and v_gym then v_expenditure.work_gym_kcal
      when v_work and not v_gym then v_expenditure.work_no_gym_kcal
      when not v_work and v_gym then v_expenditure.no_work_gym_kcal
      else v_expenditure.no_work_no_gym_kcal
    end;
  end if;

  if v_day.id is not null then
    v_total_calories := v_day.total_calories_consumed;
    v_total_protein := v_day.total_protein_g;
    v_total_carbs := v_day.total_carbs_g;
    v_total_fat := v_day.total_fat_g;
  end if;

  return query select
    v_day.id,
    v_work,
    v_gym,
    v_work_source,
    v_gym_source,
    v_schedule.id,
    v_goal.id,
    v_expenditure.id,
    v_target,
    v_protein,
    v_water,
    v_estimated_expenditure,
    v_total_calories,
    v_total_protein,
    v_total_carbs,
    v_total_fat,
    v_day.water_l,
    v_day.mate_l,
    v_day.steps,
    case when v_target is null then null else v_total_calories - v_target end,
    case
      when v_estimated_expenditure is null then null
      else v_total_calories - v_estimated_expenditure
    end;
end;
$$;

-- Materializa una resolución en un day_log existente. Toma primero el mismo
-- lock de día que recalculate_day_log, manteniendo un único orden de bloqueo.
create or replace function public.refresh_nutrition_day(p_day_log_id uuid)
returns public.day_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_day public.day_logs;
  v_context record;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select d.* into v_day
  from public.day_logs d
  where d.id = p_day_log_id
    and d.user_id = v_user_id
  for update;

  if not found then
    raise exception 'day_log_not_found';
  end if;

  select * into v_context
  from public.resolve_nutrition_context(v_day.log_date);

  update public.day_logs d
  set
    work_effective_snapshot = v_context.work_effective,
    gym_effective_snapshot = v_context.gym_effective,
    work_source_snapshot = v_context.work_source,
    gym_source_snapshot = v_context.gym_source,
    work_schedule_period_id = v_context.work_schedule_period_id,
    nutrition_goal_period_id = v_context.nutrition_goal_period_id,
    expenditure_rule_period_id = v_context.expenditure_rule_period_id,
    nutrition_target_kcal_snapshot = v_context.nutrition_target_kcal,
    protein_target_g_snapshot = v_context.protein_target_g,
    water_target_l_snapshot = v_context.water_target_l,
    estimated_expenditure_kcal_snapshot = v_context.estimated_expenditure_kcal,
    delta_vs_nutrition_target = v_context.delta_vs_nutrition_target,
    energy_balance_kcal = v_context.energy_balance_kcal,
    nutrition_resolved_at = pg_catalog.now()
  where d.id = v_day.id
  returning d.* into v_day;

  return v_day;
end;
$$;

revoke all on function public.resolve_nutrition_context(date) from public, anon;
revoke all on function public.refresh_nutrition_day(uuid) from public, anon;
grant execute on function public.resolve_nutrition_context(date) to authenticated;
grant execute on function public.refresh_nutrition_day(uuid) to authenticated;

-- Mantiene la interfaz endurecida. Sólo una inserción nueva materializa el
-- contexto; encontrar un día existente nunca reescribe sus snapshots.
create or replace function public.get_or_create_day_log(p_log_date date)
returns public.day_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.day_logs;
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'not_authenticated';
  end if;

  select d.* into v_row
  from public.day_logs d
  where d.user_id = v_user_id
    and d.log_date = p_log_date;

  if found then
    return v_row;
  end if;

  select p.* into v_profile
  from public.profiles p
  where p.user_id = v_user_id;

  insert into public.day_logs (
    user_id,
    log_date,
    bmr_kcal_snapshot,
    maintenance_kcal_snapshot,
    target_kcal_snapshot,
    goal_type_snapshot
  )
  values (
    v_user_id,
    p_log_date,
    v_profile.bmr_kcal_current,
    v_profile.maintenance_kcal_current,
    v_profile.target_kcal_current,
    v_profile.goal_type
  )
  on conflict (user_id, log_date) do nothing
  returning * into v_row;

  if found then
    v_row := public.refresh_nutrition_day(v_row.id);
    return v_row;
  end if;

  select d.* into v_row
  from public.day_logs d
  where d.user_id = v_user_id
    and d.log_date = p_log_date;

  if not found then
    raise exception 'day_log_not_created';
  end if;

  return v_row;
end;
$$;

revoke all on function public.get_or_create_day_log(date) from public, anon;
grant execute on function public.get_or_create_day_log(date) to authenticated;

comment on function public.resolve_nutrition_context(date) is
  'Resuelve contexto nutricional para auth.uid() sin escribir ni crear day_logs.';
comment on function public.refresh_nutrition_day(uuid) is
  'Materializa snapshots nutricionales con lock de day_logs y ownership por auth.uid().';

commit;
