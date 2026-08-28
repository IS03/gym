-- Issue #29, fase 3: separación definitiva entre BMR, objetivo nutricional y
-- gasto estimado, más sincronización lateral de las fuentes del contexto.
-- No carga períodos, alimentos ni datos históricos.
begin;

-- ==========================================================
-- Antropometría: una sola derivación canónica, exclusivamente BMR
-- ==========================================================

drop trigger if exists tr_profiles_derive_current_energy on public.profiles;
drop function if exists public.trg_profiles_derive_current_energy();

create function public.trg_profiles_derive_bmr()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_age integer;
  v_bmr integer;
begin
  if new.sex is not null
    and new.birth_date is not null
    and new.height_cm is not null
    and new.current_weight_kg is not null then
    v_age := pg_catalog.date_part(
      'year', pg_catalog.age(v_today, new.birth_date)
    )::integer;
    if new.sex = 'female' then
      v_bmr := pg_catalog.round(
        447.593
        + 9.247 * new.current_weight_kg
        + 3.098 * new.height_cm
        - 4.330 * v_age
      );
    else
      v_bmr := pg_catalog.round(
        88.362
        + 13.397 * new.current_weight_kg
        + 4.799 * new.height_cm
        - 5.677 * v_age
      );
    end if;
  else
    v_bmr := null;
  end if;

  new.bmr_kcal_current := v_bmr;
  -- maintenance_kcal_current y target_kcal_current quedan preservados como
  -- legado. Ya no se derivan ni alimentan el motor nutricional nuevo.
  return new;
end;
$$;

create trigger tr_profiles_derive_bmr
before insert or update of sex, birth_date, height_cm, current_weight_kg
on public.profiles
for each row
execute function public.trg_profiles_derive_bmr();

drop trigger if exists tr_profiles_sync_today_snapshots on public.profiles;
drop function if exists public.trg_profiles_sync_today_snapshots();

create function public.trg_profiles_sync_today_bmr()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
begin
  update public.day_logs d
  set bmr_kcal_snapshot = new.bmr_kcal_current
  where d.user_id = new.user_id
    and d.log_date = v_today;

  return new;
end;
$$;

-- Las columnas fuente se listan porque el BEFORE trigger deriva BMR dentro de
-- una sentencia que originalmente puede no nombrar bmr_kcal_current.
create trigger tr_profiles_sync_today_bmr
after insert or update of
  sex,
  birth_date,
  height_cm,
  current_weight_kg,
  bmr_kcal_current
on public.profiles
for each row
execute function public.trg_profiles_sync_today_bmr();

comment on column public.profiles.bmr_kcal_current is
  'BMR antropométrico actual; derivado canónicamente desde sexo, nacimiento, altura y peso.';
comment on column public.profiles.maintenance_kcal_current is
  'LEGACY/DEPRECATED: preservado por compatibilidad; no es fuente del gasto nutricional nuevo.';
comment on column public.profiles.target_kcal_current is
  'LEGACY/DEPRECATED: preservado por compatibilidad; no es fuente del objetivo nutricional nuevo.';
comment on column public.day_logs.maintenance_kcal_snapshot is
  'LEGACY/DEPRECATED: snapshot histórico preservado; no es estimated_expenditure_kcal_snapshot.';
comment on column public.day_logs.target_kcal_snapshot is
  'LEGACY/DEPRECATED: snapshot histórico preservado; no es nutrition_target_kcal_snapshot.';

revoke all on function public.trg_profiles_derive_bmr() from public, anon, authenticated;
revoke all on function public.trg_profiles_sync_today_bmr() from public, anon, authenticated;

-- ==========================================================
-- Nuevos días: BMR separado del contexto nutricional
-- ==========================================================

create or replace function public.get_or_create_day_log(p_log_date date)
returns public.day_logs
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_row public.day_logs;
  v_bmr integer;
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

  select p.bmr_kcal_current into v_bmr
  from public.profiles p
  where p.user_id = v_user_id;

  insert into public.day_logs (
    user_id,
    log_date,
    bmr_kcal_snapshot
  )
  values (
    v_user_id,
    p_log_date,
    v_bmr
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

-- ==========================================================
-- Sincronización de fuentes del contexto nutricional
-- ==========================================================

-- Sólo las columnas fuente disparan este trigger. refresh_nutrition_day
-- actualiza snapshots distintos, por lo que no puede reingresar recursivamente.
create or replace function public.trg_day_logs_refresh_nutrition_overrides()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.refresh_nutrition_day(new.id);
  return new;
end;
$$;

drop trigger if exists tr_day_logs_refresh_nutrition_overrides on public.day_logs;
create trigger tr_day_logs_refresh_nutrition_overrides
after update of work_override, gym_override, expenditure_override_kcal
on public.day_logs
for each row
when (
  old.work_override is distinct from new.work_override
  or old.gym_override is distinct from new.gym_override
  or old.expenditure_override_kcal is distinct from new.expenditure_override_kcal
)
execute function public.trg_day_logs_refresh_nutrition_overrides();

-- El hecho de entrenamiento es lateral: no se modifican ejercicios, sets ni
-- progresión. Una transición que agrega o quita completed refresca sólo su día.
create or replace function public.trg_workout_sessions_refresh_nutrition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'completed' then
      perform public.refresh_nutrition_day(new.day_log_id);
    end if;
    return new;
  end if;

  if old.day_log_id is distinct from new.day_log_id then
    -- Orden estable si una operación excepcional mueve una sesión entre días.
    if old.day_log_id::text < new.day_log_id::text then
      perform public.refresh_nutrition_day(old.day_log_id);
      perform public.refresh_nutrition_day(new.day_log_id);
    else
      perform public.refresh_nutrition_day(new.day_log_id);
      perform public.refresh_nutrition_day(old.day_log_id);
    end if;
  elsif old.status is distinct from new.status
    and (old.status = 'completed' or new.status = 'completed') then
    perform public.refresh_nutrition_day(new.day_log_id);
  end if;

  return new;
end;
$$;

drop trigger if exists tr_workout_sessions_refresh_nutrition
on public.workout_sessions;
create trigger tr_workout_sessions_refresh_nutrition
after insert or update of status, day_log_id
on public.workout_sessions
for each row
execute function public.trg_workout_sessions_refresh_nutrition();

-- Un INSERT que se vuelve la regla vigente de hoy refresca únicamente el
-- day_log de hoy si ya existe. Un período futuro o uno histórico superado por
-- una versión posterior no reescribe ninguna fila.
create or replace function public.trg_versioned_period_refresh_today()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (pg_catalog.now() at time zone 'America/Argentina/Cordoba')::date;
  v_is_current boolean := false;
  v_day_log_id uuid;
begin
  if new.effective_from > v_today then
    return new;
  end if;

  if tg_table_name = 'nutrition_goal_periods' then
    select not exists (
      select 1 from public.nutrition_goal_periods p
      where p.user_id = new.user_id
        and p.effective_from > new.effective_from
        and p.effective_from <= v_today
    ) into v_is_current;
  elsif tg_table_name = 'expenditure_rule_periods' then
    select not exists (
      select 1 from public.expenditure_rule_periods p
      where p.user_id = new.user_id
        and p.effective_from > new.effective_from
        and p.effective_from <= v_today
    ) into v_is_current;
  elsif tg_table_name = 'work_schedule_periods' then
    select not exists (
      select 1 from public.work_schedule_periods p
      where p.user_id = new.user_id
        and p.effective_from > new.effective_from
        and p.effective_from <= v_today
    ) into v_is_current;
  end if;

  if not v_is_current then
    return new;
  end if;

  select d.id into v_day_log_id
  from public.day_logs d
  where d.user_id = new.user_id
    and d.log_date = v_today;

  if v_day_log_id is not null then
    perform public.refresh_nutrition_day(v_day_log_id);
  end if;
  return new;
end;
$$;

drop trigger if exists tr_nutrition_goal_periods_refresh_today
on public.nutrition_goal_periods;
create trigger tr_nutrition_goal_periods_refresh_today
after insert on public.nutrition_goal_periods
for each row execute function public.trg_versioned_period_refresh_today();

drop trigger if exists tr_expenditure_rule_periods_refresh_today
on public.expenditure_rule_periods;
create trigger tr_expenditure_rule_periods_refresh_today
after insert on public.expenditure_rule_periods
for each row execute function public.trg_versioned_period_refresh_today();

drop trigger if exists tr_work_schedule_periods_refresh_today
on public.work_schedule_periods;
create trigger tr_work_schedule_periods_refresh_today
after insert on public.work_schedule_periods
for each row execute function public.trg_versioned_period_refresh_today();

revoke all on function public.trg_day_logs_refresh_nutrition_overrides()
  from public, anon, authenticated;
revoke all on function public.trg_workout_sessions_refresh_nutrition()
  from public, anon, authenticated;
revoke all on function public.trg_versioned_period_refresh_today()
  from public, anon, authenticated;

comment on function public.trg_workout_sessions_refresh_nutrition() is
  'Sincroniza el contexto del mismo día cuando completed aparece o desaparece; no modifica entrenamiento.';
comment on function public.trg_versioned_period_refresh_today() is
  'Refresca sólo hoy cuando un INSERT pasa a ser el período vigente; nunca recorre históricos.';

commit;
