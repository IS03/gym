-- La RPC sólo puede operar sobre el usuario autenticado y conserva la creación
-- atómica del log diario sin elevar privilegios ni exponer un user_id arbitrario.
begin;

drop function if exists public.get_or_create_day_log(uuid, date);

create function public.get_or_create_day_log(p_log_date date)
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

  select * into v_row
  from public.day_logs
  where user_id = v_user_id
    and log_date = p_log_date;

  if found then
    return v_row;
  end if;

  select * into v_profile
  from public.profiles
  where user_id = v_user_id;

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
    return v_row;
  end if;

  select * into v_row
  from public.day_logs
  where user_id = v_user_id
    and log_date = p_log_date;

  if not found then
    raise exception 'day_log_not_created';
  end if;

  return v_row;
end;
$$;

revoke all on function public.get_or_create_day_log(date) from public, anon;
grant execute on function public.get_or_create_day_log(date) to authenticated;

commit;
