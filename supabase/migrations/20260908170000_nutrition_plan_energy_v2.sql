-- PR71: plan nutricional semanal y cálculo energético v2.
-- El modelo legacy permanece disponible para fechas anteriores al cutover.
begin;

create table public.nutrition_plan_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  name text not null,
  base_water_l numeric(5,2) not null,
  training_calorie_delta_kcal integer not null default 0,
  training_water_delta_l numeric(5,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_plan_periods_user_date_unique unique (user_id, effective_from),
  constraint nutrition_plan_periods_id_user_unique unique (id, user_id),
  constraint nutrition_plan_periods_name_not_blank check (nullif(btrim(name), '') is not null),
  constraint nutrition_plan_periods_water_range check (base_water_l between 0 and 50),
  constraint nutrition_plan_periods_training_calorie_range check (training_calorie_delta_kcal between 0 and 5000),
  constraint nutrition_plan_periods_training_water_range check (training_water_delta_l between 0 and 20)
);

create table public.nutrition_plan_weekdays (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null,
  calorie_target_kcal integer not null,
  protein_target_g numeric(8,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nutrition_plan_weekdays_plan_day_unique unique (plan_id, weekday),
  constraint nutrition_plan_weekdays_plan_owner_fk foreign key (plan_id, user_id)
    references public.nutrition_plan_periods(id, user_id) on delete cascade,
  constraint nutrition_plan_weekdays_day_range check (weekday between 1 and 7),
  constraint nutrition_plan_weekdays_calorie_range check (calorie_target_kcal between 1 and 20000),
  constraint nutrition_plan_weekdays_protein_range check (protein_target_g between 0 and 2000)
);

create table public.energy_config_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  activity_level text not null,
  activity_factor numeric(4,2) not null,
  training_expenditure_delta_kcal integer not null default 0,
  formula_version text not null default 'harris_benedict_product_v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint energy_config_periods_user_date_unique unique (user_id, effective_from),
  constraint energy_config_periods_id_user_unique unique (id, user_id),
  constraint energy_config_periods_activity_level_check check (activity_level in ('low', 'moderate', 'high')),
  constraint energy_config_periods_activity_factor_check check (
    (activity_level = 'low' and activity_factor = 1.20)
    or (activity_level = 'moderate' and activity_factor = 1.25)
    or (activity_level = 'high' and activity_factor = 1.35)
  ),
  constraint energy_config_periods_training_delta_range check (training_expenditure_delta_kcal between 0 and 5000),
  constraint energy_config_periods_formula_check check (formula_version = 'harris_benedict_product_v1')
);

create index idx_nutrition_plan_periods_user_effective
  on public.nutrition_plan_periods (user_id, effective_from desc);
create index idx_nutrition_plan_weekdays_user_plan
  on public.nutrition_plan_weekdays (user_id, plan_id);
create index idx_energy_config_periods_user_effective
  on public.energy_config_periods (user_id, effective_from desc);

alter table public.day_logs
  add column nutrition_plan_period_id uuid,
  add column energy_config_period_id uuid,
  add constraint day_logs_nutrition_plan_period_owner_fk
    foreign key (nutrition_plan_period_id, user_id)
    references public.nutrition_plan_periods(id, user_id) on delete restrict,
  add constraint day_logs_energy_config_period_owner_fk
    foreign key (energy_config_period_id, user_id)
    references public.energy_config_periods(id, user_id) on delete restrict;

create index idx_day_logs_nutrition_plan_period
  on public.day_logs (nutrition_plan_period_id, user_id)
  where nutrition_plan_period_id is not null;
create index idx_day_logs_energy_config_period
  on public.day_logs (energy_config_period_id, user_id)
  where energy_config_period_id is not null;

create trigger tr_nutrition_plan_periods_updated_at
before update on public.nutrition_plan_periods
for each row execute function public.set_updated_at();
create trigger tr_nutrition_plan_weekdays_updated_at
before update on public.nutrition_plan_weekdays
for each row execute function public.set_updated_at();
create trigger tr_energy_config_periods_updated_at
before update on public.energy_config_periods
for each row execute function public.set_updated_at();

alter table public.nutrition_plan_periods enable row level security;
alter table public.nutrition_plan_weekdays enable row level security;
alter table public.energy_config_periods enable row level security;

create policy nutrition_plan_periods_select_own
on public.nutrition_plan_periods for select to authenticated
using ((select auth.uid()) = user_id);
create policy nutrition_plan_periods_insert_own
on public.nutrition_plan_periods for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy nutrition_plan_periods_update_today_own
on public.nutrition_plan_periods for update to authenticated
using (
  (select auth.uid()) = user_id
  and effective_from = (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date
)
with check (
  (select auth.uid()) = user_id
  and effective_from = (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date
);

create policy nutrition_plan_weekdays_select_own
on public.nutrition_plan_weekdays for select to authenticated
using ((select auth.uid()) = user_id);
create policy nutrition_plan_weekdays_insert_own
on public.nutrition_plan_weekdays for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.nutrition_plan_periods p
    where p.id = plan_id and p.user_id = (select auth.uid())
  )
);
create policy nutrition_plan_weekdays_update_today_own
on public.nutrition_plan_weekdays for update to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.nutrition_plan_periods p
    where p.id = plan_id
      and p.user_id = (select auth.uid())
      and p.effective_from = (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.nutrition_plan_periods p
    where p.id = plan_id
      and p.user_id = (select auth.uid())
      and p.effective_from = (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date
  )
);

create policy energy_config_periods_select_own
on public.energy_config_periods for select to authenticated
using ((select auth.uid()) = user_id);
create policy energy_config_periods_insert_own
on public.energy_config_periods for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy energy_config_periods_update_today_own
on public.energy_config_periods for update to authenticated
using (
  (select auth.uid()) = user_id
  and effective_from = (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date
)
with check (
  (select auth.uid()) = user_id
  and effective_from = (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date
);

revoke all on table public.nutrition_plan_periods, public.nutrition_plan_weekdays, public.energy_config_periods
from public, anon, authenticated;
grant select, insert, update on table public.nutrition_plan_periods, public.nutrition_plan_weekdays, public.energy_config_periods
to authenticated;

-- Una misma versión del día se actualiza de forma atómica para no crear ruido.
create function public.save_nutrition_plan_v2(
  p_name text,
  p_base_water_l numeric,
  p_training_calorie_delta_kcal integer,
  p_training_water_delta_l numeric,
  p_weekdays jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_plan_id uuid;
  v_day_log_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if nullif(pg_catalog.btrim(p_name), '') is null then raise exception 'invalid_plan_name'; end if;
  if pg_catalog.jsonb_typeof(p_weekdays) <> 'array'
    or pg_catalog.jsonb_array_length(p_weekdays) <> 7 then
    raise exception 'invalid_weekdays';
  end if;
  if (
    select pg_catalog.count(distinct x.weekday)
    from pg_catalog.jsonb_to_recordset(p_weekdays) as x(weekday smallint, calorie_target_kcal integer, protein_target_g numeric)
    where x.weekday between 1 and 7
  ) <> 7 then
    raise exception 'invalid_weekdays';
  end if;

  insert into public.nutrition_plan_periods (
    user_id, effective_from, name, base_water_l,
    training_calorie_delta_kcal, training_water_delta_l
  ) values (
    v_user_id, v_today, pg_catalog.btrim(p_name), p_base_water_l,
    p_training_calorie_delta_kcal, p_training_water_delta_l
  )
  on conflict (user_id, effective_from) do update set
    name = excluded.name,
    base_water_l = excluded.base_water_l,
    training_calorie_delta_kcal = excluded.training_calorie_delta_kcal,
    training_water_delta_l = excluded.training_water_delta_l
  returning id into v_plan_id;

  insert into public.nutrition_plan_weekdays (
    plan_id, user_id, weekday, calorie_target_kcal, protein_target_g
  )
  select v_plan_id, v_user_id, x.weekday, x.calorie_target_kcal, x.protein_target_g
  from pg_catalog.jsonb_to_recordset(p_weekdays) as x(
    weekday smallint, calorie_target_kcal integer, protein_target_g numeric
  )
  on conflict (plan_id, weekday) do update set
    calorie_target_kcal = excluded.calorie_target_kcal,
    protein_target_g = excluded.protein_target_g;

  select d.id into v_day_log_id from public.day_logs d
  where d.user_id = v_user_id and d.log_date = v_today;
  if v_day_log_id is not null then perform public.refresh_nutrition_day(v_day_log_id); end if;
  return v_plan_id;
end;
$$;

create function public.save_energy_config_v2(
  p_activity_level text,
  p_training_expenditure_delta_kcal integer
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

  insert into public.energy_config_periods (
    user_id, effective_from, activity_level, activity_factor,
    training_expenditure_delta_kcal, formula_version
  ) values (
    v_user_id, v_today, p_activity_level, v_factor,
    p_training_expenditure_delta_kcal, 'harris_benedict_product_v1'
  )
  on conflict (user_id, effective_from) do update set
    activity_level = excluded.activity_level,
    activity_factor = excluded.activity_factor,
    training_expenditure_delta_kcal = excluded.training_expenditure_delta_kcal,
    formula_version = excluded.formula_version
  returning id into v_config_id;

  select d.id into v_day_log_id from public.day_logs d
  where d.user_id = v_user_id and d.log_date = v_today;
  if v_day_log_id is not null then perform public.refresh_nutrition_day(v_day_log_id); end if;
  return v_config_id;
end;
$$;

revoke all on function public.save_nutrition_plan_v2(text, numeric, integer, numeric, jsonb) from public, anon;
revoke all on function public.save_energy_config_v2(text, integer) from public, anon;
grant execute on function public.save_nutrition_plan_v2(text, numeric, integer, numeric, jsonb) to authenticated;
grant execute on function public.save_energy_config_v2(text, integer) to authenticated;

-- Conserva la firma pública del resolver para no romper consumidores ni
-- funciones existentes que dependen de ella.
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
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;

  select d.* into v_day from public.day_logs d
  where d.user_id = v_user_id and d.log_date = p_log_date;

  -- Un día materializado y ya pasado es histórico: sus snapshots mandan.
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
      v_estimated_expenditure := pg_catalog.round(v_bmr * v_energy.activity_factor)
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
  v_plan_id uuid;
  v_energy_id uuid;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select d.* into v_day from public.day_logs d
  where d.id = p_day_log_id and d.user_id = v_user_id for update;
  if not found then raise exception 'day_log_not_found'; end if;
  select * into v_context from public.resolve_nutrition_context(v_day.log_date);
  select p.id into v_plan_id from public.nutrition_plan_periods p
  where p.user_id = v_user_id and p.effective_from <= v_day.log_date
  order by p.effective_from desc limit 1;
  select p.id into v_energy_id from public.energy_config_periods p
  where p.user_id = v_user_id and p.effective_from <= v_day.log_date
  order by p.effective_from desc limit 1;
  update public.day_logs d set
    work_effective_snapshot = v_context.work_effective,
    gym_effective_snapshot = v_context.gym_effective,
    work_source_snapshot = v_context.work_source,
    gym_source_snapshot = v_context.gym_source,
    work_schedule_period_id = v_context.work_schedule_period_id,
    nutrition_goal_period_id = v_context.nutrition_goal_period_id,
    expenditure_rule_period_id = v_context.expenditure_rule_period_id,
    nutrition_plan_period_id = v_plan_id,
    energy_config_period_id = v_energy_id,
    nutrition_target_kcal_snapshot = v_context.nutrition_target_kcal,
    protein_target_g_snapshot = v_context.protein_target_g,
    water_target_l_snapshot = v_context.water_target_l,
    estimated_expenditure_kcal_snapshot = v_context.estimated_expenditure_kcal,
    delta_vs_nutrition_target = v_context.delta_vs_nutrition_target,
    energy_balance_kcal = v_context.energy_balance_kcal,
    nutrition_resolved_at = pg_catalog.now()
  where d.id = v_day.id returning d.* into v_day;
  return v_day;
end;
$$;

revoke all on function public.resolve_nutrition_context(date) from public, anon;
revoke all on function public.refresh_nutrition_day(uuid) from public, anon;
grant execute on function public.resolve_nutrition_context(date) to authenticated;
grant execute on function public.refresh_nutrition_day(uuid) to authenticated;

-- Al cambiar el perfil hoy, primero actualiza el BMR snapshot y después el gasto v2.
create or replace function public.trg_profiles_sync_today_bmr()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_day_log_id uuid;
begin
  update public.day_logs d set bmr_kcal_snapshot = new.bmr_kcal_current
  where d.user_id = new.user_id and d.log_date = v_today
  returning d.id into v_day_log_id;
  if v_day_log_id is not null then perform public.refresh_nutrition_day(v_day_log_id); end if;
  return new;
end;
$$;

revoke all on function public.trg_profiles_sync_today_bmr() from public, anon, authenticated;

comment on table public.nutrition_plan_periods is
  'Plan nutricional v2 versionado por fecha civil de Córdoba; no reemplaza períodos legacy históricos.';
comment on table public.energy_config_periods is
  'Cálculo energético v2 versionado: BMR canónico por actividad cotidiana más un delta diario por entrenamiento completado.';
comment on function public.resolve_nutrition_context(date) is
  'Resolver canónico: snapshots históricos primero, luego v2 por cutover y finalmente fallback legacy.';

commit;
