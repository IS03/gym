-- Issue #32: la base mantiene una única implementación de los valores
-- energéticos actuales. Las acciones sólo escriben los datos fuente.
begin;

create or replace function public.trg_profiles_derive_current_energy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'America/Argentina/Cordoba')::date;
  v_age integer;
  v_bmr integer;
begin
  if new.sex is not null
    and new.birth_date is not null
    and new.height_cm is not null
    and new.current_weight_kg is not null then
    v_age := extract(year from age(v_today, new.birth_date))::integer;
    if new.sex = 'female' then
      v_bmr := round(
        447.593
        + 9.247 * new.current_weight_kg
        + 3.098 * new.height_cm
        - 4.330 * v_age
      );
    else
      v_bmr := round(
        88.362
        + 13.397 * new.current_weight_kg
        + 4.799 * new.height_cm
        - 5.677 * v_age
      );
    end if;
  else
    v_bmr := null;
  end if;

  -- Semántica vigente: mantenimiento y target base coinciden con BMR.
  -- La futura ampliación nutricional deberá evolucionar esta regla canónica.
  new.bmr_kcal_current := v_bmr;
  new.maintenance_kcal_current := v_bmr;
  new.target_kcal_current := v_bmr;
  return new;
end;
$$;

drop trigger if exists tr_profiles_derive_current_energy on public.profiles;
create trigger tr_profiles_derive_current_energy
before insert or update of sex, birth_date, height_cm, current_weight_kg
on public.profiles
for each row
execute function public.trg_profiles_derive_current_energy();

create or replace function public.trg_day_logs_sync_current_weight()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_latest_date date;
  v_latest_weight numeric(6,2);
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

  insert into public.profiles (user_id, current_weight_kg)
  values (new.user_id, v_latest_weight)
  on conflict (user_id) do update
  set current_weight_kg = excluded.current_weight_kg;

  return new;
end;
$$;

drop trigger if exists tr_profiles_sync_today_snapshots on public.profiles;
create trigger tr_profiles_sync_today_snapshots
after insert or update of
  sex,
  birth_date,
  height_cm,
  current_weight_kg,
  bmr_kcal_current,
  maintenance_kcal_current,
  target_kcal_current,
  goal_type
on public.profiles
for each row
execute function public.trg_profiles_sync_today_snapshots();

revoke all on function public.trg_profiles_derive_current_energy() from public, anon;
revoke all on function public.trg_day_logs_sync_current_weight() from public, anon;
grant execute on function public.trg_profiles_derive_current_energy() to authenticated;
grant execute on function public.trg_day_logs_sync_current_weight() to authenticated;

-- Recalcula con la implementación canónica y sincroniza únicamente el snapshot
-- del día actual. Los snapshots históricos no participan de este update.
update public.profiles
set current_weight_kg = current_weight_kg;

commit;
