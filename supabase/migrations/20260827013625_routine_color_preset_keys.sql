begin;

alter table public.routines
  drop constraint if exists routines_color_format_check;

update public.routines
set color = case lower(color)
  when '#a855f7' then 'violet'
  when '#3b82f6' then 'blue'
  when '#06b6d4' then 'cyan'
  when '#22c55e' then 'green'
  when '#eab308' then 'yellow'
  when '#f97316' then 'orange'
  when '#ef4444' then 'rose'
  else color
end
where color is not null;

alter table public.routines
  drop constraint if exists routines_color_preset_key;

alter table public.routines
  add constraint routines_color_preset_key
  check (
    color is null
    or color in ('violet', 'indigo', 'blue', 'cyan', 'green', 'yellow', 'orange', 'rose')
  );

create or replace function public.import_training_plan(p_plan jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $function$
declare
  v_user_id uuid := (select auth.uid());
  v_routine jsonb;
  v_exercise jsonb;
  v_set jsonb;
  v_routine_id uuid;
  v_exercise_id uuid;
  v_routine_exercise_id uuid;
  v_routine_color text;
  v_routines integer := 0;
  v_exercises integer := 0;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if jsonb_typeof(p_plan -> 'routines') <> 'array'
    or jsonb_array_length(p_plan -> 'routines') not between 1 and 20 then
    raise exception 'Plan inválido';
  end if;
  if exists (
    select 1 from public.workout_sessions
    where user_id = v_user_id and status = 'in_progress'
  ) then
    raise exception 'Finalizá o cancelá la sesión activa antes de importar rutinas';
  end if;

  for v_routine in select value from jsonb_array_elements(p_plan -> 'routines')
  loop
    if nullif(v_routine ->> 'source_key', '') is null
      or nullif(v_routine ->> 'name', '') is null then
      raise exception 'Rutina sin identificador o nombre';
    end if;

    v_routine_color := nullif(v_routine ->> 'color', '');
    if v_routine_color is not null
      and v_routine_color not in ('violet', 'indigo', 'blue', 'cyan', 'green', 'yellow', 'orange', 'rose') then
      raise exception 'Color de rutina inválido';
    end if;

    select id into v_routine_id
    from public.routines
    where user_id = v_user_id
      and (
        source_key = v_routine ->> 'source_key'
        or lower(public.normalize_name(nombre)) =
          lower(public.normalize_name(v_routine ->> 'name'))
      )
    order by (source_key = v_routine ->> 'source_key') desc
    limit 1;

    if v_routine_id is null then
      insert into public.routines (
        user_id, source_key, nombre, color, routine_order, notes, is_active
      ) values (
        v_user_id,
        v_routine ->> 'source_key',
        v_routine ->> 'name',
        v_routine_color,
        (v_routine ->> 'order')::integer,
        nullif(v_routine ->> 'notes', ''),
        true
      ) returning id into v_routine_id;
    else
      update public.routines
      set
        source_key = v_routine ->> 'source_key',
        nombre = v_routine ->> 'name',
        color = v_routine_color,
        routine_order = (v_routine ->> 'order')::integer,
        notes = nullif(v_routine ->> 'notes', ''),
        is_active = true
      where id = v_routine_id;
    end if;

    delete from public.routine_exercises where routine_id = v_routine_id;
    v_routines := v_routines + 1;

    if jsonb_typeof(v_routine -> 'exercises') <> 'array'
      or jsonb_array_length(v_routine -> 'exercises') not between 1 and 100 then
      raise exception 'Rutina sin ejercicios válidos';
    end if;

    for v_exercise in select value from jsonb_array_elements(v_routine -> 'exercises')
    loop
      if jsonb_typeof(v_exercise -> 'sets') <> 'array'
        or jsonb_array_length(v_exercise -> 'sets') not between 1 and 50 then
        raise exception 'Ejercicio sin series válidas';
      end if;

      select id into v_exercise_id
      from public.exercises
      where user_id = v_user_id
        and (
          source_key = v_exercise ->> 'source_key'
          or lower(public.normalize_name(nombre)) =
            lower(public.normalize_name(v_exercise ->> 'name'))
        )
      order by (source_key = v_exercise ->> 'source_key') desc
      limit 1;

      if v_exercise_id is null then
        insert into public.exercises (
          user_id,
          source_key,
          nombre,
          grupo_muscular,
          muscle_group_label,
          implement,
          weight_mode,
          series_sugeridas,
          reps_sugeridas,
          peso_sugerido,
          notes,
          is_active
        ) values (
          v_user_id,
          v_exercise ->> 'source_key',
          v_exercise ->> 'name',
          nullif(v_exercise ->> 'legacy_group', '')::public.muscle_group,
          nullif(v_exercise ->> 'muscle_group', ''),
          nullif(v_exercise ->> 'implement', ''),
          nullif(v_exercise ->> 'weight_mode', ''),
          jsonb_array_length(v_exercise -> 'sets'),
          nullif(v_exercise #>> '{sets,0,reps}', '')::integer,
          nullif(v_exercise #>> '{sets,0,weight_kg}', '')::numeric,
          nullif(v_exercise ->> 'notes', ''),
          true
        ) returning id into v_exercise_id;
      else
        update public.exercises
        set
          source_key = v_exercise ->> 'source_key',
          nombre = v_exercise ->> 'name',
          grupo_muscular = nullif(v_exercise ->> 'legacy_group', '')::public.muscle_group,
          muscle_group_label = nullif(v_exercise ->> 'muscle_group', ''),
          implement = nullif(v_exercise ->> 'implement', ''),
          weight_mode = nullif(v_exercise ->> 'weight_mode', ''),
          series_sugeridas = jsonb_array_length(v_exercise -> 'sets'),
          reps_sugeridas = nullif(v_exercise #>> '{sets,0,reps}', '')::integer,
          peso_sugerido = nullif(v_exercise #>> '{sets,0,weight_kg}', '')::numeric,
          notes = nullif(v_exercise ->> 'notes', ''),
          is_active = true
        where id = v_exercise_id;
      end if;

      insert into public.routine_exercises (
        routine_id,
        exercise_id,
        exercise_order,
        next_adjustment,
        notes
      ) values (
        v_routine_id,
        v_exercise_id,
        (v_exercise ->> 'order')::integer,
        coalesce(nullif(v_exercise ->> 'next_adjustment', ''), 'maintain'),
        nullif(v_exercise ->> 'routine_notes', '')
      ) returning id into v_routine_exercise_id;

      for v_set in select value from jsonb_array_elements(v_exercise -> 'sets')
      loop
        insert into public.routine_exercise_sets (
          user_id,
          routine_exercise_id,
          set_number,
          target_reps,
          target_weight_kg
        ) values (
          v_user_id,
          v_routine_exercise_id,
          (v_set ->> 'set_number')::integer,
          nullif(v_set ->> 'reps', '')::integer,
          nullif(v_set ->> 'weight_kg', '')::numeric
        )
        on conflict (routine_exercise_id, set_number) do update
        set
          target_reps = excluded.target_reps,
          target_weight_kg = excluded.target_weight_kg;
      end loop;

      v_exercises := v_exercises + 1;
    end loop;
  end loop;

  return jsonb_build_object(
    'routines', v_routines,
    'exercises', v_exercises
  );
end;
$function$;

revoke all on function public.import_training_plan(jsonb) from public;
grant execute on function public.import_training_plan(jsonb) to authenticated, service_role;

commit;
