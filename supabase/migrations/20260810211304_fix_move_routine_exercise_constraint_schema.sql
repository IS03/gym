-- `move_routine_exercise` deliberately runs with an empty search_path.  Constraint
-- names still follow search_path resolution, so the schema must be explicit here.
create or replace function public.move_routine_exercise(
  p_routine_exercise_id uuid,
  p_direction integer
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_current public.routine_exercises;
  v_other public.routine_exercises;
begin
  if p_direction not in (-1, 1) then
    raise exception 'Dirección inválida';
  end if;

  select re.* into v_current
  from public.routine_exercises re
  join public.routines r on r.id = re.routine_id
  where re.id = p_routine_exercise_id and r.user_id = v_user_id;

  if v_current.id is null then
    raise exception 'Ejercicio de rutina inválido';
  end if;

  if p_direction = -1 then
    select * into v_other
    from public.routine_exercises
    where routine_id = v_current.routine_id
      and exercise_order < v_current.exercise_order
    order by exercise_order desc
    limit 1;
  else
    select * into v_other
    from public.routine_exercises
    where routine_id = v_current.routine_id
      and exercise_order > v_current.exercise_order
    order by exercise_order asc
    limit 1;
  end if;

  if v_other.id is null then
    return;
  end if;

  perform 1
  from public.routine_exercises
  where id in (v_current.id, v_other.id)
  order by id
  for update;

  select * into v_current
  from public.routine_exercises
  where id = v_current.id;
  select * into v_other
  from public.routine_exercises
  where id = v_other.id;

  set constraints public.routine_exercises_unique_order deferred;
  update public.routine_exercises
  set exercise_order = case
    when id = v_current.id then v_other.exercise_order
    when id = v_other.id then v_current.exercise_order
  end
  where id in (v_current.id, v_other.id);
end;
$$;

revoke all on function public.move_routine_exercise(uuid, integer) from public, anon;
grant execute on function public.move_routine_exercise(uuid, integer) to authenticated;
