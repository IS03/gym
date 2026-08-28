-- No permite agregar el mismo ejercicio dos veces a una sesión en curso.
-- Se bloquea la sesión antes de comprobarlo para que dos solicitudes simultáneas
-- no puedan pasar la validación a la vez. No modifica tablas ni el historial.
create or replace function public.append_workout_exercise(
  p_session_id uuid,
  p_exercise_id uuid,
  p_source_type text default 'extra'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_exercise public.exercises;
  v_session_exercise_id uuid;
  v_order integer;
  v_sets integer;
begin
  if p_source_type not in ('extra', 'manual_new') then
    raise exception 'Origen inválido';
  end if;

  -- Serializa los intentos de append de una misma sesión.
  perform 1
  from public.workout_sessions
  where id = p_session_id
    and user_id = v_user_id
    and status = 'in_progress'
  for update;

  if not found then
    raise exception 'La sesión no existe o ya finalizó';
  end if;

  if exists (
    select 1
    from public.workout_session_exercises
    where workout_session_id = p_session_id
      and exercise_id = p_exercise_id
  ) then
    raise exception 'Este ejercicio ya está agregado a la sesión';
  end if;

  select * into v_exercise
  from public.exercises
  where id = p_exercise_id and user_id = v_user_id and is_active;

  if v_exercise.id is null then
    raise exception 'Ejercicio inválido o archivado';
  end if;

  select coalesce(max(exercise_order), 0) + 1 into v_order
  from public.workout_session_exercises
  where workout_session_id = p_session_id;

  v_sets := greatest(coalesce(v_exercise.series_sugeridas, 1), 1);

  insert into public.workout_session_exercises (
    user_id,
    workout_session_id,
    exercise_id,
    nombre_snapshot,
    grupo_muscular_snapshot,
    muscle_group_label_snapshot,
    implement_snapshot,
    weight_mode_snapshot,
    source_type,
    exercise_order,
    planned_sets_count
  ) values (
    v_user_id,
    p_session_id,
    v_exercise.id,
    v_exercise.nombre,
    v_exercise.grupo_muscular,
    v_exercise.muscle_group_label,
    v_exercise.implement,
    v_exercise.weight_mode,
    p_source_type,
    v_order,
    v_sets
  )
  returning id into v_session_exercise_id;

  insert into public.workout_sets (
    user_id,
    workout_session_exercise_id,
    set_number,
    target_reps,
    target_weight_kg,
    actual_reps,
    actual_weight_kg
  )
  select
    v_user_id,
    v_session_exercise_id,
    generated,
    v_exercise.reps_sugeridas,
    v_exercise.peso_sugerido,
    v_exercise.reps_sugeridas,
    v_exercise.peso_sugerido
  from generate_series(1, v_sets) generated;

  return v_session_exercise_id;
end;
$$;

revoke all on function public.append_workout_exercise(uuid, uuid, text) from public, anon;
grant execute on function public.append_workout_exercise(uuid, uuid, text) to authenticated;
