-- Issue #32: el peso histórico, el peso actual y los snapshots del día deben
-- quedar consistentes dentro de la misma transacción de Postgres.
begin;

create or replace function public.trg_profiles_sync_today_snapshots()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
begin
  update public.day_logs
  set
    bmr_kcal_snapshot = new.bmr_kcal_current,
    maintenance_kcal_snapshot = new.maintenance_kcal_current,
    target_kcal_snapshot = new.target_kcal_current,
    goal_type_snapshot = new.goal_type,
    delta_vs_target = case
      when new.target_kcal_current is null then null
      else total_calories_consumed - new.target_kcal_current
    end,
    delta_vs_maintenance = case
      when new.maintenance_kcal_current is null then null
      else total_calories_consumed - new.maintenance_kcal_current
    end
  where user_id = new.user_id
    and log_date = v_today;

  return new;
end;
$$;

drop trigger if exists tr_profiles_sync_today_snapshots on public.profiles;
create trigger tr_profiles_sync_today_snapshots
after insert or update of
  bmr_kcal_current,
  maintenance_kcal_current,
  target_kcal_current,
  goal_type
on public.profiles
for each row
execute function public.trg_profiles_sync_today_snapshots();

create or replace function public.trg_day_logs_sync_current_weight()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_latest_date date;
  v_latest_weight numeric(6,2);
  v_profile public.profiles;
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
  v_age integer;
  v_bmr integer;
  v_should_sync boolean := false;
begin
  select log_date, weight_kg
  into v_latest_date, v_latest_weight
  from public.day_logs
  where user_id = new.user_id
    and weight_kg is not null
  order by log_date desc
  limit 1;

  if new.weight_kg is not null and new.log_date = v_latest_date then
    v_should_sync := true;
  elsif tg_op = 'UPDATE'
    and old.weight_kg is not null
    and new.weight_kg is null
    and (v_latest_date is null or old.log_date > v_latest_date) then
    v_should_sync := true;
  end if;

  if not v_should_sync then
    return new;
  end if;

  select * into v_profile
  from public.profiles
  where user_id = new.user_id;

  if v_latest_weight is not null
    and v_profile.sex is not null
    and v_profile.birth_date is not null
    and v_profile.height_cm is not null then
    v_age := extract(year from age(v_today, v_profile.birth_date))::integer;
    if v_profile.sex = 'female' then
      v_bmr := round(
        447.593
        + 9.247 * v_latest_weight
        + 3.098 * v_profile.height_cm
        - 4.330 * v_age
      );
    else
      v_bmr := round(
        88.362
        + 13.397 * v_latest_weight
        + 4.799 * v_profile.height_cm
        - 5.677 * v_age
      );
    end if;
  else
    v_bmr := null;
  end if;

  insert into public.profiles (
    user_id,
    current_weight_kg,
    bmr_kcal_current,
    maintenance_kcal_current,
    target_kcal_current
  ) values (
    new.user_id,
    v_latest_weight,
    v_bmr,
    v_bmr,
    v_bmr
  )
  on conflict (user_id) do update
  set
    current_weight_kg = excluded.current_weight_kg,
    bmr_kcal_current = excluded.bmr_kcal_current,
    maintenance_kcal_current = excluded.maintenance_kcal_current,
    target_kcal_current = excluded.target_kcal_current;

  return new;
end;
$$;

drop trigger if exists tr_day_logs_sync_current_weight on public.day_logs;
create trigger tr_day_logs_sync_current_weight
after insert or update of weight_kg
on public.day_logs
for each row
execute function public.trg_day_logs_sync_current_weight();

revoke all on function public.trg_profiles_sync_today_snapshots() from public, anon;
revoke all on function public.trg_day_logs_sync_current_weight() from public, anon;
grant execute on function public.trg_profiles_sync_today_snapshots() to authenticated;
grant execute on function public.trg_day_logs_sync_current_weight() to authenticated;

-- Corrige perfiles legados que tenían peso actual pero ningún punto histórico.
-- El primer punto se registra en el día de producto de Córdoba y no reescribe
-- ningún día histórico anterior.
insert into public.day_logs (
  user_id,
  log_date,
  weight_kg,
  bmr_kcal_snapshot,
  maintenance_kcal_snapshot,
  target_kcal_snapshot,
  goal_type_snapshot
)
select
  p.user_id,
  (now() at time zone 'America/Argentina/Cordoba')::date,
  p.current_weight_kg,
  p.bmr_kcal_current,
  p.maintenance_kcal_current,
  p.target_kcal_current,
  p.goal_type
from public.profiles p
where p.current_weight_kg is not null
  and not exists (
    select 1
    from public.day_logs d
    where d.user_id = p.user_id
      and d.weight_kg is not null
  )
on conflict (user_id, log_date) do update
set weight_kg = excluded.weight_kg;

-- Reaplica el último punto de cada usuario para reparar cualquier divergencia
-- previa entre historial, perfil y valores derivados actuales.
with latest_weight as (
  select distinct on (user_id) id
  from public.day_logs
  where weight_kg is not null
  order by user_id, log_date desc
)
update public.day_logs d
set weight_kg = d.weight_kg
from latest_weight latest
where d.id = latest.id;

commit;
