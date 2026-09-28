-- M3.2A: atomic routine editor reads/writes and idempotent Mobile session start.
-- This migration is additive. Web and Mobile share the same transactional
-- template-version and workout-snapshot primitives.
begin;

alter table public.routines
  add column if not exists template_version bigint not null default 1;

alter table public.routines
  drop constraint if exists routines_template_version_check;

alter table public.routines
  add constraint routines_template_version_check
  check (template_version >= 1);

comment on column public.routines.template_version is
  'Monotonic CAS token for the routine template. Each logical transaction advances it at most once per affected routine.';

-- Every Training writer takes the same transaction-scoped user lock before it
-- can lock a routine, exercise, relation, or set. This is also the lock used by
-- Web and Mobile start, so template edits, exercise metadata edits, and workout
-- snapshots cannot form child -> parent / parent -> child lock cycles.
create function public.lock_training_user_mutations()
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 771923)
  );
  return v_user_id;
end;
$$;

create function public.lock_training_user_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Maintenance sessions without an Auth JWT remain the responsibility of the
  -- migration/operator. Every product writer has auth.uid() and is serialized.
  if (select auth.uid()) is not null then
    perform public.lock_training_user_mutations();
  end if;
  return null;
end;
$$;

-- A custom transaction-local setting is the per-routine change registry. All
-- statements belonging to one PostgreSQL transaction converge on this helper,
-- so one logical mutation advances each affected routine exactly once. A full
-- rollback also rolls back both the bump and the local registry entry.
create function public.bump_training_routine_template_once(p_routine_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_setting text := 'ownlevel.template_bumped_' || pg_catalog.replace(p_routine_id::text, '-', '_');
  v_version bigint;
begin
  -- Authenticated product traffic is user-scoped and serialized. Migration or
  -- maintenance roles can have no JWT; their existing SQL privileges and RLS
  -- semantics remain authoritative instead of making ordinary DML impossible.
  if v_user_id is not null then
    perform public.lock_training_user_mutations();
  end if;

  if pg_catalog.current_setting(v_setting, true) = '1' then
    select r.template_version into v_version
    from public.routines r
    where r.id = p_routine_id
      and (v_user_id is null or r.user_id = v_user_id);
    return v_version;
  end if;

  update public.routines r
  set template_version = r.template_version + 1
  where r.id = p_routine_id
    and (v_user_id is null or r.user_id = v_user_id)
  returning r.template_version into v_version;

  if found then
    perform pg_catalog.set_config(v_setting, '1', true);
  end if;
  return v_version;
end;
$$;

create function public.bump_routine_templates_from_relations()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_routine_id uuid;
begin
  if tg_op = 'INSERT' then
    for v_routine_id in select distinct routine_id from new_rows order by routine_id
    loop
      perform public.bump_training_routine_template_once(v_routine_id);
    end loop;
  elsif tg_op = 'DELETE' then
    for v_routine_id in select distinct routine_id from old_rows order by routine_id
    loop
      perform public.bump_training_routine_template_once(v_routine_id);
    end loop;
  else
    for v_routine_id in
      select changed.routine_id
      from (
        select routine_id from old_rows
        union
        select routine_id from new_rows
      ) changed
      order by changed.routine_id
    loop
      perform public.bump_training_routine_template_once(v_routine_id);
    end loop;
  end if;
  return null;
end;
$$;

create function public.bump_routine_templates_from_sets()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_routine_id uuid;
begin
  if tg_op = 'INSERT' then
    for v_routine_id in
      select distinct re.routine_id
      from new_rows changed
      join public.routine_exercises re on re.id = changed.routine_exercise_id
      order by re.routine_id
    loop
      perform public.bump_training_routine_template_once(v_routine_id);
    end loop;
  elsif tg_op = 'DELETE' then
    for v_routine_id in
      select distinct re.routine_id
      from old_rows changed
      join public.routine_exercises re on re.id = changed.routine_exercise_id
      order by re.routine_id
    loop
      perform public.bump_training_routine_template_once(v_routine_id);
    end loop;
  else
    for v_routine_id in
      select distinct re.routine_id
      from (
        select routine_exercise_id from old_rows
        union
        select routine_exercise_id from new_rows
      ) changed
      join public.routine_exercises re on re.id = changed.routine_exercise_id
      order by re.routine_id
    loop
      perform public.bump_training_routine_template_once(v_routine_id);
    end loop;
  end if;
  return null;
end;
$$;

create trigger tr_00_training_user_lock_routines
before insert or update or delete on public.routines
for each statement execute function public.lock_training_user_before_write();

create trigger tr_00_training_user_lock_exercises
before insert or update or delete on public.exercises
for each statement execute function public.lock_training_user_before_write();

create trigger tr_00_training_user_lock_routine_exercises
before insert or update or delete on public.routine_exercises
for each statement execute function public.lock_training_user_before_write();

create trigger tr_00_training_user_lock_routine_exercise_sets
before insert or update or delete on public.routine_exercise_sets
for each statement execute function public.lock_training_user_before_write();

create trigger tr_routine_template_version_exercise_insert
after insert on public.routine_exercises
referencing new table as new_rows
for each statement execute function public.bump_routine_templates_from_relations();

create trigger tr_routine_template_version_exercise_update
after update on public.routine_exercises
referencing old table as old_rows new table as new_rows
for each statement execute function public.bump_routine_templates_from_relations();

create trigger tr_routine_template_version_exercise_delete
after delete on public.routine_exercises
referencing old table as old_rows
for each statement execute function public.bump_routine_templates_from_relations();

create trigger tr_routine_template_version_set_insert
after insert on public.routine_exercise_sets
referencing new table as new_rows
for each statement execute function public.bump_routine_templates_from_sets();

create trigger tr_routine_template_version_set_update
after update on public.routine_exercise_sets
referencing old table as old_rows new table as new_rows
for each statement execute function public.bump_routine_templates_from_sets();

create trigger tr_routine_template_version_set_delete
after delete on public.routine_exercise_sets
referencing old table as old_rows
for each statement execute function public.bump_routine_templates_from_sets();

revoke all on function public.lock_training_user_before_write() from public, anon, authenticated;
revoke all on function public.bump_routine_templates_from_relations() from public, anon, authenticated;
revoke all on function public.bump_routine_templates_from_sets() from public, anon, authenticated;
revoke all on function public.lock_training_user_mutations() from public, anon;
revoke all on function public.bump_training_routine_template_once(uuid) from public, anon;
grant execute on function public.lock_training_user_mutations() to authenticated;
grant execute on function public.bump_training_routine_template_once(uuid) to authenticated;

-- Mobile desired-state writes provide their own targets and sets. The
-- transaction-local flag below lets that one RPC bypass legacy default
-- generation without changing ordinary Web inserts.
create or replace function public.routine_exercises_apply_exercise_defaults()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_rest_min integer;
  v_rest_max integer;
begin
  if pg_catalog.current_setting('ownlevel.skip_routine_default_sets', true) = 'on' then
    return new;
  end if;

  if new.rest_min_seconds is null and new.rest_max_seconds is null then
    select
      e.descanso_min_sugerido_segundos,
      e.descanso_max_sugerido_segundos
    into v_rest_min, v_rest_max
    from public.exercises e
    where e.id = new.exercise_id;

    new.rest_min_seconds := v_rest_min;
    new.rest_max_seconds := v_rest_max;
  end if;
  return new;
end;
$$;

create or replace function public.routine_exercises_create_default_sets()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
  v_sets integer;
  v_reps integer;
  v_weight numeric;
  v_rir smallint;
begin
  if pg_catalog.current_setting('ownlevel.skip_routine_default_sets', true) = 'on' then
    return new;
  end if;

  select
    r.user_id,
    greatest(coalesce(e.series_sugeridas, 1), 1),
    e.reps_sugeridas,
    e.peso_sugerido,
    e.rir_sugerido
  into v_owner, v_sets, v_reps, v_weight, v_rir
  from public.routines r
  join public.exercises e on e.id = new.exercise_id
  where r.id = new.routine_id;

  insert into public.routine_exercise_sets (
    user_id, routine_exercise_id, set_number,
    target_reps, target_weight_kg, target_rir
  )
  select v_owner, new.id, generated, v_reps, v_weight, v_rir
  from pg_catalog.generate_series(1, v_sets) generated
  on conflict (routine_exercise_id, set_number) do nothing;

  return new;
end;
$$;

create function public.mobile_training_routine_detail(p_routine_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_routine public.routines%rowtype;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;

  select * into v_routine
  from public.routines r
  where r.id = p_routine_id and r.user_id = v_user_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_ROUTINE_NOT_FOUND';
  end if;

  if exists (
    select 1
    from public.routine_exercises re
    left join public.exercises e
      on e.id = re.exercise_id and e.user_id = v_user_id
    where re.routine_id = p_routine_id and e.id is null
  ) or exists (
    select 1
    from public.routine_exercises re
    left join public.routine_exercise_sets rs on rs.routine_exercise_id = re.id
    where re.routine_id = p_routine_id
    group by re.id
    having count(rs.id) not between 1 and 50
       or min(rs.set_number) <> 1
       or max(rs.set_number) <> count(rs.id)
  ) then
    raise exception using errcode = 'P0001', message = 'TRAINING_ROUTINE_TEMPLATE_CORRUPT';
  end if;

  select jsonb_build_object(
    'routine', jsonb_build_object(
      'id', r.id,
      'name', r.nombre,
      'color', r.color,
      'isActive', r.is_active,
      'updatedAt', r.updated_at,
      'templateVersion', r.template_version
    ),
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'routineExerciseId', re.id,
          'exerciseOrder', re.exercise_order,
          'exercise', jsonb_build_object(
            'id', e.id,
            'name', e.nombre,
            'muscleGroup', e.grupo_muscular,
            'muscleGroupLabel', e.muscle_group_label,
            'implement', e.implement,
            'weightMode', e.weight_mode,
            'isActive', e.is_active
          ),
          'updatedAt', re.updated_at,
          'targets', jsonb_build_object(
            'nextAdjustment', re.next_adjustment,
            'nextAdjustmentNote', re.next_adjustment_note,
            'restMinSeconds', re.rest_min_seconds,
            'restMaxSeconds', re.rest_max_seconds,
            'notes', re.notes,
            'sets', (
              select jsonb_agg(
                jsonb_build_object(
                  'setNumber', rs.set_number,
                  'targetReps', rs.target_reps,
                  'targetWeightKg', rs.target_weight_kg,
                  'targetRir', rs.target_rir,
                  'notes', rs.notes
                ) order by rs.set_number
              )
              from public.routine_exercise_sets rs
              where rs.routine_exercise_id = re.id
            )
          )
        ) order by re.exercise_order
      )
      from public.routine_exercises re
      join public.exercises e on e.id = re.exercise_id
      where re.routine_id = r.id
    ), '[]'::jsonb)
  ) into v_result
  from public.routines r
  where r.id = p_routine_id and r.user_id = v_user_id;

  return v_result;
end;
$$;

create function public.mobile_update_training_routine_identity(
  p_routine_id uuid,
  p_name text,
  p_color text,
  p_expected_updated_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_routine public.routines%rowtype;
  v_name text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  v_name := public.normalize_name(p_name);
  if v_name is null then
    raise exception using errcode = '22023', message = 'El nombre es obligatorio.';
  end if;
  if p_color is not null and p_color not in (
    'violet', 'indigo', 'blue', 'cyan', 'green', 'yellow', 'orange', 'rose'
  ) then
    raise exception using errcode = '22023', message = 'Elegí un color de rutina válido.';
  end if;

  perform public.lock_training_user_mutations();

  select * into v_routine
  from public.routines r
  where r.id = p_routine_id and r.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_ROUTINE_NOT_FOUND';
  end if;
  if p_expected_updated_at is null or v_routine.updated_at <> p_expected_updated_at then
    raise exception using errcode = '40001', message = 'ROUTINE_CHANGED';
  end if;

  begin
    update public.routines
    set nombre = v_name, color = p_color
    where id = p_routine_id and user_id = v_user_id
    returning * into v_routine;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'Ya existe una rutina con ese nombre.';
  end;

  return jsonb_build_object(
    'routine', jsonb_build_object(
      'id', v_routine.id,
      'name', v_routine.nombre,
      'color', v_routine.color,
      'isActive', v_routine.is_active,
      'updatedAt', v_routine.updated_at,
      'templateVersion', v_routine.template_version
    )
  );
end;
$$;

create function public.mobile_replace_training_routine_template(
  p_routine_id uuid,
  p_expected_template_version bigint,
  p_items jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_routine public.routines%rowtype;
  v_item jsonb;
  v_targets jsonb;
  v_set jsonb;
  v_resolved jsonb := '[]'::jsonb;
  v_relation_id uuid;
  v_exercise_id uuid;
  v_existing_exercise_id uuid;
  v_exercise_is_active boolean;
  v_index integer := 0;
  v_set_index integer;
  v_numeric numeric;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'La plantilla no es válida.';
  end if;

  perform public.lock_training_user_mutations();
  if pg_catalog.jsonb_array_length(p_items) > 10000 then
    raise exception using errcode = '22023', message = 'La plantilla no es válida.';
  end if;

  select * into v_routine
  from public.routines r
  where r.id = p_routine_id and r.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_ROUTINE_NOT_FOUND';
  end if;
  if p_expected_template_version is null
    or v_routine.template_version <> p_expected_template_version then
    raise exception using errcode = '40001', message = 'ROUTINE_TEMPLATE_CHANGED';
  end if;

  for v_item in select value from pg_catalog.jsonb_array_elements(p_items)
  loop
    v_index := v_index + 1;
    if pg_catalog.jsonb_typeof(v_item) <> 'object' then
      raise exception using errcode = '22023', message = 'Un ejercicio de la plantilla no es válido.';
    end if;
    if exists (
      select 1 from pg_catalog.jsonb_object_keys(v_item) supplied(key)
      where not (supplied.key = any (array['routineExerciseId','exerciseId','targets']::text[]))
    ) or not (v_item ?& array['routineExerciseId','exerciseId','targets']) then
      raise exception using errcode = '22023', message = 'Un ejercicio de la plantilla no es válido.';
    end if;
    if pg_catalog.jsonb_typeof(v_item -> 'routineExerciseId') not in ('string','null')
      or pg_catalog.jsonb_typeof(v_item -> 'exerciseId') <> 'string'
      or pg_catalog.jsonb_typeof(v_item -> 'targets') <> 'object'
      or (v_item ->> 'exerciseId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (
        pg_catalog.jsonb_typeof(v_item -> 'routineExerciseId') = 'string'
        and (v_item ->> 'routineExerciseId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      ) then
      raise exception using errcode = '22023', message = 'Un identificador de la plantilla no es válido.';
    end if;

    v_exercise_id := (v_item ->> 'exerciseId')::uuid;
    v_relation_id := case
      when pg_catalog.jsonb_typeof(v_item -> 'routineExerciseId') = 'null'
        then pg_catalog.gen_random_uuid()
      else (v_item ->> 'routineExerciseId')::uuid
    end;
    v_targets := v_item -> 'targets';

    if exists (
      select 1 from pg_catalog.jsonb_object_keys(v_targets) supplied(key)
      where not (supplied.key = any (array[
        'nextAdjustment','nextAdjustmentNote','restMinSeconds','restMaxSeconds','notes','sets'
      ]::text[]))
    ) or not (v_targets ?& array[
      'nextAdjustment','nextAdjustmentNote','restMinSeconds','restMaxSeconds','notes','sets'
    ]) then
      raise exception using errcode = '22023', message = 'Los objetivos contienen propiedades no permitidas.';
    end if;
    if pg_catalog.jsonb_typeof(v_targets -> 'nextAdjustment') <> 'string'
      or (v_targets ->> 'nextAdjustment') not in ('maintain','increase_weight','increase_reps','custom')
      or pg_catalog.jsonb_typeof(v_targets -> 'nextAdjustmentNote') not in ('string','null')
      or pg_catalog.jsonb_typeof(v_targets -> 'notes') not in ('string','null')
      or pg_catalog.jsonb_typeof(v_targets -> 'sets') <> 'array' then
      raise exception using errcode = '22023', message = 'Los objetivos no son válidos.';
    end if;
    if pg_catalog.jsonb_array_length(v_targets -> 'sets') not between 1 and 50 then
      raise exception using errcode = '22023', message = 'Los objetivos no son válidos.';
    end if;

    foreach v_set_index in array array[0,1]
    loop
      if pg_catalog.jsonb_typeof(v_targets -> case when v_set_index = 0 then 'restMinSeconds' else 'restMaxSeconds' end) not in ('number','null') then
        raise exception using errcode = '22023', message = 'Los descansos no son válidos.';
      end if;
      if pg_catalog.jsonb_typeof(v_targets -> case when v_set_index = 0 then 'restMinSeconds' else 'restMaxSeconds' end) = 'number' then
        v_numeric := (v_targets ->> case when v_set_index = 0 then 'restMinSeconds' else 'restMaxSeconds' end)::numeric;
        if v_numeric <> trunc(v_numeric) or v_numeric not between 0 and 3600 then
          raise exception using errcode = '22023', message = 'Los descansos no son válidos.';
        end if;
      end if;
    end loop;
    if (v_targets ->> 'restMinSeconds')::integer is not null
      and (v_targets ->> 'restMaxSeconds')::integer is not null
      and (v_targets ->> 'restMinSeconds')::integer > (v_targets ->> 'restMaxSeconds')::integer then
      raise exception using errcode = '22023', message = 'El descanso mínimo no puede superar al máximo.';
    end if;

    v_set_index := 0;
    for v_set in select value from pg_catalog.jsonb_array_elements(v_targets -> 'sets')
    loop
      v_set_index := v_set_index + 1;
      if pg_catalog.jsonb_typeof(v_set) <> 'object' then
        raise exception using errcode = '22023', message = 'Las series no son válidas.';
      end if;
      if exists (
        select 1 from pg_catalog.jsonb_object_keys(v_set) supplied(key)
        where not (supplied.key = any (array[
          'setNumber','targetReps','targetWeightKg','targetRir','notes'
        ]::text[]))
      ) or not (v_set ?& array['setNumber','targetReps','targetWeightKg','targetRir','notes']) then
        raise exception using errcode = '22023', message = 'Las series no son válidas.';
      end if;
      if pg_catalog.jsonb_typeof(v_set -> 'setNumber') <> 'number'
        or pg_catalog.jsonb_typeof(v_set -> 'targetReps') not in ('number','null')
        or pg_catalog.jsonb_typeof(v_set -> 'targetWeightKg') not in ('number','null')
        or pg_catalog.jsonb_typeof(v_set -> 'targetRir') not in ('number','null')
        or pg_catalog.jsonb_typeof(v_set -> 'notes') not in ('string','null') then
        raise exception using errcode = '22023', message = 'Las series no son válidas.';
      end if;
      if (v_set ->> 'setNumber')::numeric <> v_set_index then
        raise exception using errcode = '22023', message = 'Las series no son válidas.';
      end if;
      if pg_catalog.jsonb_typeof(v_set -> 'targetReps') = 'number' then
        v_numeric := (v_set ->> 'targetReps')::numeric;
        if v_numeric <> trunc(v_numeric) or v_numeric not between 0 and 1000 then
          raise exception using errcode = '22023', message = 'Las repeticiones no son válidas.';
        end if;
      end if;
      if pg_catalog.jsonb_typeof(v_set -> 'targetWeightKg') = 'number' then
        v_numeric := (v_set ->> 'targetWeightKg')::numeric;
        if v_numeric not between 0 and 9999.99 or v_numeric <> trunc(v_numeric, 2) then
          raise exception using errcode = '22023', message = 'El peso no es válido.';
        end if;
      end if;
      if pg_catalog.jsonb_typeof(v_set -> 'targetRir') = 'number' then
        v_numeric := (v_set ->> 'targetRir')::numeric;
        if v_numeric <> trunc(v_numeric) or v_numeric not between 0 and 10 then
          raise exception using errcode = '22023', message = 'El RIR no es válido.';
        end if;
      end if;
    end loop;

    if pg_catalog.jsonb_typeof(v_item -> 'routineExerciseId') = 'string' then
      select re.exercise_id into v_existing_exercise_id
      from public.routine_exercises re
      where re.id = v_relation_id and re.routine_id = p_routine_id;
      if not found then
        raise exception using errcode = 'P0002', message = 'TRAINING_ROUTINE_EXERCISE_NOT_FOUND';
      end if;
      if v_existing_exercise_id <> v_exercise_id then
        if not exists (
          select 1 from public.exercises e
          where e.id = v_exercise_id and e.user_id = v_user_id
        ) then
          raise exception using errcode = 'P0002', message = 'TRAINING_EXERCISE_NOT_FOUND';
        end if;
        raise exception using errcode = '22023', message = 'La relación de rutina no es válida.';
      end if;
    else
      select e.is_active into v_exercise_is_active
      from public.exercises e
      where e.id = v_exercise_id and e.user_id = v_user_id;
      if not found then
        raise exception using errcode = 'P0002', message = 'TRAINING_EXERCISE_NOT_FOUND';
      end if;
      if not v_exercise_is_active then
        raise exception using errcode = '22023', message = 'Sólo podés agregar ejercicios activos propios.';
      end if;
    end if;

    v_resolved := v_resolved || jsonb_build_array(jsonb_build_object(
      'routineExerciseId', v_relation_id,
      'isNew', pg_catalog.jsonb_typeof(v_item -> 'routineExerciseId') = 'null',
      'exerciseId', v_exercise_id,
      'exerciseOrder', v_index,
      'targets', v_targets
    ));
  end loop;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_resolved) item(value)
    group by item.value ->> 'exerciseId'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'Un ejercicio no puede repetirse en la rutina.';
  end if;

  set constraints public.routine_exercises_unique_order deferred;

  delete from public.routine_exercises re
  where re.routine_id = p_routine_id
    and not exists (
      select 1 from pg_catalog.jsonb_array_elements(v_resolved) item(value)
      where not (item.value ->> 'isNew')::boolean
        and (item.value ->> 'routineExerciseId')::uuid = re.id
    );

  update public.routine_exercises re
  set
    exercise_order = (item.value ->> 'exerciseOrder')::integer,
    next_adjustment = item.value #>> '{targets,nextAdjustment}',
    next_adjustment_note = item.value #>> '{targets,nextAdjustmentNote}',
    rest_min_seconds = (item.value #>> '{targets,restMinSeconds}')::integer,
    rest_max_seconds = (item.value #>> '{targets,restMaxSeconds}')::integer,
    notes = item.value #>> '{targets,notes}'
  from pg_catalog.jsonb_array_elements(v_resolved) item(value)
  where not (item.value ->> 'isNew')::boolean
    and re.id = (item.value ->> 'routineExerciseId')::uuid
    and re.routine_id = p_routine_id;

  perform pg_catalog.set_config('ownlevel.skip_routine_default_sets', 'on', true);

  insert into public.routine_exercises (
    id, routine_id, exercise_id, exercise_order, next_adjustment,
    next_adjustment_note, rest_min_seconds, rest_max_seconds, notes
  )
  select
    (item.value ->> 'routineExerciseId')::uuid,
    p_routine_id,
    (item.value ->> 'exerciseId')::uuid,
    (item.value ->> 'exerciseOrder')::integer,
    item.value #>> '{targets,nextAdjustment}',
    item.value #>> '{targets,nextAdjustmentNote}',
    (item.value #>> '{targets,restMinSeconds}')::integer,
    (item.value #>> '{targets,restMaxSeconds}')::integer,
    item.value #>> '{targets,notes}'
  from pg_catalog.jsonb_array_elements(v_resolved) item(value)
  where (item.value ->> 'isNew')::boolean;

  perform pg_catalog.set_config('ownlevel.skip_routine_default_sets', 'off', true);

  delete from public.routine_exercise_sets rs
  where exists (
    select 1 from pg_catalog.jsonb_array_elements(v_resolved) item(value)
    where (item.value ->> 'routineExerciseId')::uuid = rs.routine_exercise_id
  );

  insert into public.routine_exercise_sets (
    user_id, routine_exercise_id, set_number,
    target_reps, target_weight_kg, target_rir, notes
  )
  select
    v_user_id,
    (item.value ->> 'routineExerciseId')::uuid,
    (set_item.value ->> 'setNumber')::integer,
    (set_item.value ->> 'targetReps')::integer,
    (set_item.value ->> 'targetWeightKg')::numeric,
    (set_item.value ->> 'targetRir')::smallint,
    set_item.value ->> 'notes'
  from pg_catalog.jsonb_array_elements(v_resolved) item(value)
  cross join lateral pg_catalog.jsonb_array_elements(item.value #> '{targets,sets}') set_item(value);

  -- Child triggers may already have registered this transaction. This explicit
  -- call also advances an intentionally empty/no-op desired-state replace once.
  perform public.bump_training_routine_template_once(p_routine_id);

  return public.mobile_training_routine_detail(p_routine_id);
end;
$$;

create or replace function public.mobile_update_training_exercise(
  p_exercise_id uuid,
  p_exercise jsonb,
  p_routine_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_name text;
  v_muscle_group public.muscle_group;
  v_muscle_group_label text;
  v_implement text;
  v_weight_mode text;
  v_suggested_sets integer;
  v_suggested_sets_number numeric;
  v_suggested_reps integer;
  v_suggested_reps_number numeric;
  v_suggested_weight numeric;
  v_suggested_rir integer;
  v_suggested_rir_number numeric;
  v_rest_min integer;
  v_rest_min_number numeric;
  v_rest_max integer;
  v_rest_max_number numeric;
  v_notes text;
  v_routine_ids uuid[];
  v_locked_routine_count integer;
  v_exercise public.exercises%rowtype;
  v_response jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'No autenticado';
  end if;
  perform public.lock_training_user_mutations();
  if p_exercise_id is null then
    raise exception using errcode = '22023', message = 'El ejercicio no es válido.';
  end if;
  if p_exercise is null or pg_catalog.jsonb_typeof(p_exercise) <> 'object' then
    raise exception using errcode = '22023', message = 'El ejercicio no es válido.';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_object_keys(p_exercise) as supplied(key)
    where not (supplied.key = any (array[
      'name', 'muscleGroup', 'muscleGroupLabel', 'implement', 'weightMode',
      'suggestedSets', 'suggestedReps', 'suggestedWeight', 'suggestedRir',
      'suggestedRestMinSeconds', 'suggestedRestMaxSeconds', 'notes'
    ]::text[]))
  ) then
    raise exception using errcode = '22023', message = 'El ejercicio contiene propiedades no permitidas.';
  end if;
  if not (p_exercise ? 'name')
    or pg_catalog.jsonb_typeof(p_exercise -> 'name') <> 'string' then
    raise exception using errcode = '22023', message = 'Nombre debe ser texto.';
  end if;
  if exists (
    select 1
    from (values
      ('muscleGroup'), ('muscleGroupLabel'), ('implement'), ('weightMode'), ('notes')
    ) as string_field(key)
    where p_exercise ? string_field.key
      and pg_catalog.jsonb_typeof(p_exercise -> string_field.key) not in ('string', 'null')
  ) then
    raise exception using errcode = '22023', message = 'Los campos de texto del ejercicio no son válidos.';
  end if;
  if exists (
    select 1
    from (values
      ('suggestedSets'), ('suggestedReps'), ('suggestedWeight'), ('suggestedRir'),
      ('suggestedRestMinSeconds'), ('suggestedRestMaxSeconds')
    ) as number_field(key)
    where p_exercise ? number_field.key
      and pg_catalog.jsonb_typeof(p_exercise -> number_field.key) not in ('number', 'null')
  ) then
    raise exception using errcode = '22023', message = 'Los campos numéricos del ejercicio no son válidos.';
  end if;

  select coalesce(array_agg(distinct item order by item), '{}'::uuid[])
  into v_routine_ids
  from unnest(coalesce(p_routine_ids, '{}'::uuid[])) item;
  if cardinality(v_routine_ids) > 100 then
    raise exception using errcode = '22023', message = 'Seleccionaste demasiadas rutinas.';
  end if;

  v_name := public.normalize_name(p_exercise ->> 'name');
  if v_name is null then
    raise exception using errcode = '22023', message = 'Nombre es obligatorio.';
  end if;
  if p_exercise ->> 'muscleGroup' is not null then
    if p_exercise ->> 'muscleGroup' not in (
      'pecho', 'espalda', 'piernas', 'hombros', 'bíceps', 'tríceps', 'abdomen', 'cardio'
    ) then
      raise exception using errcode = '22023', message = 'Grupo muscular inválido.';
    end if;
    v_muscle_group := (p_exercise ->> 'muscleGroup')::public.muscle_group;
  end if;
  v_muscle_group_label := nullif(btrim(p_exercise ->> 'muscleGroupLabel'), '');
  v_implement := nullif(btrim(p_exercise ->> 'implement'), '');
  v_weight_mode := nullif(btrim(p_exercise ->> 'weightMode'), '');
  v_suggested_sets_number := (p_exercise ->> 'suggestedSets')::numeric;
  v_suggested_reps_number := (p_exercise ->> 'suggestedReps')::numeric;
  v_suggested_weight := (p_exercise ->> 'suggestedWeight')::numeric;
  v_suggested_rir_number := (p_exercise ->> 'suggestedRir')::numeric;
  v_rest_min_number := (p_exercise ->> 'suggestedRestMinSeconds')::numeric;
  v_rest_max_number := (p_exercise ->> 'suggestedRestMaxSeconds')::numeric;
  v_notes := nullif(btrim(p_exercise ->> 'notes'), '');

  if char_length(coalesce(v_muscle_group_label, '')) > 120
    or char_length(coalesce(v_implement, '')) > 120
    or char_length(coalesce(v_weight_mode, '')) > 120
    or char_length(coalesce(v_notes, '')) > 1000
    or (v_suggested_sets_number is not null and (
      v_suggested_sets_number <> trunc(v_suggested_sets_number)
      or v_suggested_sets_number not between 0 and 100
    ))
    or (v_suggested_reps_number is not null and (
      v_suggested_reps_number <> trunc(v_suggested_reps_number)
      or v_suggested_reps_number not between 0 and 1000
    ))
    or (v_suggested_weight is not null and v_suggested_weight not between 0 and 9999.99)
    or (v_suggested_rir_number is not null and (
      v_suggested_rir_number <> trunc(v_suggested_rir_number)
      or v_suggested_rir_number not between 0 and 10
    ))
    or (v_rest_min_number is not null and (
      v_rest_min_number <> trunc(v_rest_min_number)
      or v_rest_min_number not between 0 and 3600
    ))
    or (v_rest_max_number is not null and (
      v_rest_max_number <> trunc(v_rest_max_number)
      or v_rest_max_number not between 0 and 3600
    ))
    or ((v_rest_min_number is null) <> (v_rest_max_number is null))
    or (v_rest_min_number is not null and v_rest_min_number > v_rest_max_number) then
    raise exception using errcode = '22023', message = 'Los datos del ejercicio no son válidos.';
  end if;

  v_suggested_sets := v_suggested_sets_number::integer;
  v_suggested_reps := v_suggested_reps_number::integer;
  v_suggested_rir := v_suggested_rir_number::integer;
  v_rest_min := v_rest_min_number::integer;
  v_rest_max := v_rest_max_number::integer;

  select * into v_exercise
  from public.exercises e
  where e.id = p_exercise_id
    and e.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_EXERCISE_NOT_FOUND';
  end if;

  if cardinality(v_routine_ids) > 0 then
    perform 1
    from public.routines r
    where r.id = any(v_routine_ids)
      and r.user_id = v_user_id
      and r.is_active
    for update;
    get diagnostics v_locked_routine_count = row_count;
    if v_locked_routine_count <> cardinality(v_routine_ids) then
      raise exception using
        errcode = '22023',
        message = 'Una rutina seleccionada no existe, es ajena o está archivada.';
    end if;
  end if;

  begin
    update public.exercises
    set
      nombre = v_name,
      grupo_muscular = v_muscle_group,
      muscle_group_label = v_muscle_group_label,
      implement = v_implement,
      weight_mode = v_weight_mode,
      series_sugeridas = v_suggested_sets,
      reps_sugeridas = v_suggested_reps,
      peso_sugerido = v_suggested_weight,
      rir_sugerido = v_suggested_rir,
      descanso_min_sugerido_segundos = v_rest_min,
      descanso_max_sugerido_segundos = v_rest_max,
      notes = v_notes
    where id = p_exercise_id
      and user_id = v_user_id
    returning * into v_exercise;
  exception when unique_violation then
    raise exception using errcode = '23505', message = 'Ya existe un ejercicio con ese nombre.';
  end;

  delete from public.routine_exercises re
  using public.routines r
  where re.routine_id = r.id
    and re.exercise_id = p_exercise_id
    and r.user_id = v_user_id
    and r.is_active
    and not (re.routine_id = any(v_routine_ids));

  insert into public.routine_exercises (routine_id, exercise_id)
  select requested.routine_id, p_exercise_id
  from unnest(v_routine_ids) as requested(routine_id)
  where not exists (
    select 1
    from public.routine_exercises existing
    where existing.routine_id = requested.routine_id
      and existing.exercise_id = p_exercise_id
  );

  v_response := jsonb_build_object(
    'exercise', jsonb_build_object(
      'id', v_exercise.id,
      'name', v_exercise.nombre,
      'muscleGroup', v_exercise.grupo_muscular,
      'muscleGroupLabel', v_exercise.muscle_group_label,
      'implement', v_exercise.implement,
      'weightMode', v_exercise.weight_mode,
      'suggestedSets', v_exercise.series_sugeridas,
      'suggestedReps', v_exercise.reps_sugeridas,
      'suggestedWeight', v_exercise.peso_sugerido,
      'suggestedRir', v_exercise.rir_sugerido,
      'suggestedRestMinSeconds', v_exercise.descanso_min_sugerido_segundos,
      'suggestedRestMaxSeconds', v_exercise.descanso_max_sugerido_segundos,
      'notes', v_exercise.notes,
      'isActive', v_exercise.is_active,
      'routineIds', to_jsonb(v_routine_ids),
      'updatedAt', v_exercise.updated_at
    )
  );

  return v_response;
end;
$$;

-- Web bulk replacement used to issue DELETE and INSERT as separate Data API
-- transactions. Keep the helper contract but make the database mutation one
-- logical transaction and therefore one template-version bump.
create function public.replace_routine_exercises(
  p_routine_id uuid,
  p_exercise_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_routine public.routines%rowtype;
  v_exercise_ids uuid[] := coalesce(p_exercise_ids, '{}'::uuid[]);
  v_owned_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  if p_routine_id is null or array_position(v_exercise_ids, null) is not null then
    raise exception using errcode = '22023', message = 'La rutina contiene ejercicios inválidos.';
  end if;
  if cardinality(v_exercise_ids) > 10000
    or cardinality(v_exercise_ids) <> (
      select count(distinct exercise_id) from unnest(v_exercise_ids) exercise_id
    ) then
    raise exception using errcode = '22023', message = 'La rutina contiene ejercicios duplicados o inválidos.';
  end if;

  perform public.lock_training_user_mutations();
  select * into v_routine
  from public.routines r
  where r.id = p_routine_id and r.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_ROUTINE_NOT_FOUND';
  end if;

  select count(*) into v_owned_count
  from public.exercises e
  where e.user_id = v_user_id and e.id = any(v_exercise_ids);
  if v_owned_count <> cardinality(v_exercise_ids) then
    raise exception using errcode = 'P0002', message = 'TRAINING_EXERCISE_NOT_FOUND';
  end if;

  delete from public.routine_exercises re where re.routine_id = p_routine_id;

  insert into public.routine_exercises (routine_id, exercise_id, exercise_order)
  select p_routine_id, requested.exercise_id, requested.exercise_order::integer
  from unnest(v_exercise_ids) with ordinality requested(exercise_id, exercise_order)
  order by requested.exercise_order;

  perform public.bump_training_routine_template_once(p_routine_id);
end;
$$;

-- Exercise-library membership synchronization is likewise one transaction.
-- Archived routine memberships are preserved, matching the existing Web
-- behavior; only active routine membership is desired-state managed here.
create function public.sync_exercise_active_routine_memberships(
  p_exercise_id uuid,
  p_routine_ids uuid[] default '{}'::uuid[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_routine_ids uuid[];
  v_routine_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  if p_exercise_id is null or array_position(p_routine_ids, null) is not null then
    raise exception using errcode = '22023', message = 'El ejercicio o sus rutinas no son válidos.';
  end if;

  select coalesce(array_agg(distinct id order by id), '{}'::uuid[])
  into v_routine_ids
  from unnest(coalesce(p_routine_ids, '{}'::uuid[])) requested(id);

  perform public.lock_training_user_mutations();
  perform 1
  from public.exercises e
  where e.id = p_exercise_id and e.user_id = v_user_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'TRAINING_EXERCISE_NOT_FOUND';
  end if;

  select count(*) into v_routine_count
  from public.routines r
  where r.id = any(v_routine_ids) and r.user_id = v_user_id and r.is_active;
  if v_routine_count <> cardinality(v_routine_ids) then
    raise exception using errcode = '22023', message = 'Una de las rutinas seleccionadas ya no está activa.';
  end if;

  perform 1
  from public.routines r
  where r.user_id = v_user_id
    and r.is_active
    and (
      r.id = any(v_routine_ids)
      or exists (
        select 1 from public.routine_exercises re
        where re.routine_id = r.id and re.exercise_id = p_exercise_id
      )
    )
  order by r.id
  for update;

  delete from public.routine_exercises re
  using public.routines r
  where re.routine_id = r.id
    and re.exercise_id = p_exercise_id
    and r.user_id = v_user_id
    and r.is_active
    and not (re.routine_id = any(v_routine_ids));

  insert into public.routine_exercises (routine_id, exercise_id)
  select requested.routine_id, p_exercise_id
  from unnest(v_routine_ids) requested(routine_id)
  where not exists (
    select 1 from public.routine_exercises existing
    where existing.routine_id = requested.routine_id
      and existing.exercise_id = p_exercise_id
  );
end;
$$;

-- The progressive Web editor remains a single RPC, but now enters the same
-- lock domain before reading or mutating template rows.
create or replace function public.save_routine_exercise(
  p_routine_exercise_id uuid,
  p_payload jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_sets_count integer;
  v_updated_at timestamptz;
begin
  v_user_id := public.lock_training_user_mutations();

  if not exists (
    select 1
    from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = p_routine_exercise_id and r.user_id = v_user_id
  ) then
    raise exception 'Ejercicio de rutina inválido';
  end if;
  if pg_catalog.jsonb_typeof(p_payload -> 'sets') <> 'array' then
    raise exception 'sets debe ser un array';
  end if;
  v_sets_count := pg_catalog.jsonb_array_length(p_payload -> 'sets');
  if v_sets_count < 1 or v_sets_count > 50 then
    raise exception 'La cantidad de series debe estar entre 1 y 50';
  end if;

  update public.routine_exercises
  set
    next_adjustment = coalesce(nullif(p_payload ->> 'next_adjustment', ''), 'maintain'),
    rest_min_seconds = nullif(p_payload ->> 'rest_min_seconds', '')::integer,
    rest_max_seconds = nullif(p_payload ->> 'rest_max_seconds', '')::integer,
    notes = nullif(p_payload ->> 'notes', '')
  where id = p_routine_exercise_id
  returning updated_at into v_updated_at;

  delete from public.routine_exercise_sets
  where routine_exercise_id = p_routine_exercise_id;

  insert into public.routine_exercise_sets (
    user_id, routine_exercise_id, set_number,
    target_reps, target_weight_kg, target_rir, notes
  )
  select
    v_user_id, p_routine_exercise_id, item.set_number,
    item.target_reps, item.target_weight_kg, item.target_rir,
    nullif(item.notes, '')
  from pg_catalog.jsonb_to_recordset(p_payload -> 'sets') as item(
    set_number integer,
    target_reps integer,
    target_weight_kg numeric,
    target_rir smallint,
    notes text
  );

  if exists (
    select 1
    from (
      select min(set_number) as first_number, max(set_number) as last_number,
        count(*)::integer as total
      from public.routine_exercise_sets
      where routine_exercise_id = p_routine_exercise_id
    ) numbered
    where numbered.first_number <> 1 or numbered.last_number <> numbered.total
  ) then
    raise exception 'Las series deben estar numeradas en orden desde 1';
  end if;
  return v_updated_at;
end;
$$;

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
  perform public.lock_training_user_mutations();

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

-- Routine start writes its own complete workout-set snapshot. Suppress the
-- legacy AFTER INSERT defaults only for that bounded transactional operation;
-- ordinary Web/legacy inserts retain their existing default-set behavior.
create or replace function public.workout_session_exercises_create_default_sets()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if pg_catalog.current_setting('ownlevel.skip_workout_default_sets', true) = 'on' then
    return new;
  end if;

  insert into public.workout_sets (
    user_id, workout_session_exercise_id, set_number,
    target_reps, target_weight_kg, actual_reps, actual_weight_kg, is_completed
  )
  select
    new.user_id, new.id, generated,
    new.reps_reales, new.peso_real,
    new.reps_reales, new.peso_real, new.is_completed
  from pg_catalog.generate_series(1, greatest(coalesce(new.series_reales, 1), 1)) generated
  on conflict (workout_session_exercise_id, set_number) do nothing;
  return new;
end;
$$;

-- Central start path used by Web and Mobile. The user-scoped lock is acquired
-- before routine/exercise locks. Exercise rows are locked deterministically so
-- metadata and fallback target values come from one stable version.
create or replace function public.start_workout_session(
  p_day_log_id uuid,
  p_routine_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_session_id uuid;
  v_routine_name text;
  v_previous_default_sets_setting text;
begin
  v_user_id := public.lock_training_user_mutations();

  if not exists (
    select 1 from public.day_logs where id = p_day_log_id and user_id = v_user_id
  ) then
    raise exception 'Fecha inválida o ajena';
  end if;
  if exists (
    select 1 from public.workout_sessions
    where user_id = v_user_id and status = 'in_progress'
  ) then
    raise exception using errcode = 'P0001', message = 'ACTIVE_SESSION_EXISTS';
  end if;
  if p_routine_id is not null then
    select nombre into v_routine_name
    from public.routines
    where id = p_routine_id and user_id = v_user_id and is_active
    for share;
    if v_routine_name is null then
      raise exception 'Rutina inválida o archivada';
    end if;

    perform e.id
    from public.exercises e
    join public.routine_exercises re on re.exercise_id = e.id
    where re.routine_id = p_routine_id and e.user_id = v_user_id
    order by e.id
    for share of e;
  end if;

  insert into public.workout_sessions (
    user_id, day_log_id, routine_id, routine_name_snapshot, session_name, status, started_at
  ) values (
    v_user_id, p_day_log_id, p_routine_id, v_routine_name,
    coalesce(v_routine_name, 'Sesión libre'), 'in_progress', pg_catalog.now()
  ) returning id into v_session_id;

  if p_routine_id is not null then
    v_previous_default_sets_setting := pg_catalog.current_setting(
      'ownlevel.skip_workout_default_sets', true
    );
    perform pg_catalog.set_config('ownlevel.skip_workout_default_sets', 'on', true);

    insert into public.workout_session_exercises (
      user_id, workout_session_id, routine_exercise_id, exercise_id,
      nombre_snapshot, grupo_muscular_snapshot, muscle_group_label_snapshot,
      implement_snapshot, weight_mode_snapshot,
      rest_min_seconds_snapshot, rest_max_seconds_snapshot,
      source_type, exercise_order, series_reales, planned_sets_count,
      next_adjustment_snapshot, next_adjustment_note_snapshot,
      decision, decision_note, routine_note_snapshot, notes
    )
    select
      v_user_id, v_session_id, re.id, e.id,
      e.nombre, e.grupo_muscular, e.muscle_group_label,
      e.implement, e.weight_mode,
      re.rest_min_seconds, re.rest_max_seconds,
      'routine', re.exercise_order,
      greatest(coalesce(nullif(count(res.id), 0), e.series_sugeridas, 1), 1)::integer,
      greatest(coalesce(nullif(count(res.id), 0), e.series_sugeridas, 1), 1)::integer,
      re.next_adjustment, re.next_adjustment_note,
      'maintain', null, re.notes, re.notes
    from public.routine_exercises re
    join public.exercises e on e.id = re.exercise_id
    left join public.routine_exercise_sets res on res.routine_exercise_id = re.id
    where re.routine_id = p_routine_id
    group by re.id, e.id
    order by re.exercise_order;

    insert into public.workout_sets (
      user_id, workout_session_exercise_id, set_number,
      target_reps, target_weight_kg, target_rir,
      actual_reps, actual_weight_kg
    )
    select
      v_user_id, se.id, generated.set_number,
      coalesce(res.target_reps, e.reps_sugeridas),
      coalesce(res.target_weight_kg, e.peso_sugerido),
      res.target_rir,
      coalesce(res.target_reps, e.reps_sugeridas),
      coalesce(res.target_weight_kg, e.peso_sugerido)
    from public.workout_session_exercises se
    join public.exercises e on e.id = se.exercise_id
    cross join lateral pg_catalog.generate_series(1, se.planned_sets_count) as generated(set_number)
    left join public.routine_exercise_sets res
      on res.routine_exercise_id = se.routine_exercise_id
      and res.set_number = generated.set_number
    where se.workout_session_id = v_session_id
    on conflict (workout_session_exercise_id, set_number) do update
    set
      target_reps = excluded.target_reps,
      target_weight_kg = excluded.target_weight_kg,
      target_rir = excluded.target_rir,
      actual_reps = excluded.actual_reps,
      actual_weight_kg = excluded.actual_weight_kg;

    perform pg_catalog.set_config(
      'ownlevel.skip_workout_default_sets',
      coalesce(v_previous_default_sets_setting, 'off'),
      true
    );
  end if;

  return v_session_id;
end;
$$;

-- Finishing can write routine targets. Acquire the shared user lock before the
-- session row lock so it cannot invert the template/start lock order.
create or replace function public.finish_workout_session(
  p_session_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_session public.workout_sessions;
  v_exercise record;
begin
  v_user_id := public.lock_training_user_mutations();

  select * into v_session
  from public.workout_sessions
  where id = p_session_id and user_id = v_user_id and status = 'in_progress'
  for update;
  if v_session.id is null then
    raise exception 'La sesión no existe o ya finalizó';
  end if;
  if not exists (
    select 1
    from public.workout_session_exercises se
    join public.workout_sets ws on ws.workout_session_exercise_id = se.id
    where se.workout_session_id = p_session_id and se.is_completed and ws.is_completed
  ) then
    raise exception 'Marcá y guardá al menos una serie antes de finalizar';
  end if;

  update public.routine_exercises re
  set
    next_adjustment = se.decision,
    next_adjustment_note = case
      when se.decision = 'custom' then nullif(pg_catalog.btrim(se.decision_note), '')
      else null
    end
  from public.workout_session_exercises se
  where se.workout_session_id = p_session_id
    and se.routine_exercise_id = re.id;

  update public.routine_exercises re
  set notes = se.notes
  from public.workout_session_exercises se
  where se.workout_session_id = p_session_id
    and se.routine_exercise_id = re.id
    and se.routine_note_snapshot is not null
    and se.notes is distinct from se.routine_note_snapshot;

  for v_exercise in
    select * from public.workout_session_exercises
    where workout_session_id = p_session_id
      and apply_to_routine
      and routine_exercise_id is not null
  loop
    if exists (
      select 1 from public.workout_sets ws
      where ws.workout_session_exercise_id = v_exercise.id and ws.is_completed
    ) then
      delete from public.routine_exercise_sets
      where routine_exercise_id = v_exercise.routine_exercise_id;
      insert into public.routine_exercise_sets (
        user_id, routine_exercise_id, set_number,
        target_reps, target_weight_kg, target_rir, notes
      )
      select
        v_user_id, v_exercise.routine_exercise_id,
        row_number() over (order by ws.set_number)::integer,
        coalesce(ws.actual_reps, ws.target_reps),
        coalesce(ws.actual_weight_kg, ws.target_weight_kg),
        ws.target_rir,
        ws.notes
      from public.workout_sets ws
      where ws.workout_session_exercise_id = v_exercise.id and ws.is_completed;
    end if;
  end loop;

  update public.workout_sessions
  set
    session_name = coalesce(nullif(p_metadata ->> 'session_name', ''), session_name),
    energy_level = nullif(p_metadata ->> 'energy_level', '')::smallint,
    performance_level = nullif(p_metadata ->> 'performance_level', '')::smallint,
    pain_level = nullif(p_metadata ->> 'pain_level', '')::smallint,
    pain_note = nullif(p_metadata ->> 'pain_note', ''),
    abs_completed = coalesce((p_metadata ->> 'abs_completed')::boolean, false),
    treadmill_minutes = nullif(p_metadata ->> 'treadmill_minutes', '')::numeric,
    treadmill_distance_km = nullif(p_metadata ->> 'treadmill_distance_km', '')::numeric,
    treadmill_speed_kmh = nullif(p_metadata ->> 'treadmill_speed_kmh', '')::numeric,
    treadmill_incline_percent = nullif(p_metadata ->> 'treadmill_incline_percent', '')::numeric,
    notes = nullif(p_metadata ->> 'notes', ''),
    status = 'completed',
    ended_at = pg_catalog.now()
  where id = p_session_id;
  return p_session_id;
end;
$$;

create function public.mobile_start_training_session(
  p_idempotency_key text,
  p_routine_id uuid default null
)
returns table (
  response_status smallint,
  response_body jsonb,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_operation constant text := 'training.session.start.v1';
  v_payload jsonb;
  v_request_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_routine public.routines%rowtype;
  v_active record;
  v_day_log public.day_logs%rowtype;
  v_session_id uuid;
  v_session record;
  v_response jsonb;
  v_error_message text;
  v_constraint_name text;
  v_today date := (pg_catalog.timezone('America/Argentina/Cordoba', pg_catalog.now()))::date;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'UNAUTHORIZED';
  end if;
  if p_idempotency_key is null
    or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'La operación no es válida.';
  end if;

  perform public.lock_training_user_mutations();

  v_payload := jsonb_build_object('routineId', p_routine_id);
  v_request_hash := pg_catalog.encode(
    extensions.digest(pg_catalog.convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.mobile_idempotency_keys (
    user_id, operation, idempotency_key, request_hash, expires_at
  ) values (
    v_user_id, v_operation, p_idempotency_key, v_request_hash,
    pg_catalog.now() + interval '30 days'
  )
  on conflict (user_id, operation, idempotency_key) do nothing;

  select * into v_ledger
  from public.mobile_idempotency_keys
  where user_id = v_user_id
    and operation = v_operation
    and idempotency_key = p_idempotency_key
  for update;

  if v_ledger.request_hash <> v_request_hash then
    raise exception using errcode = 'P0001', message = 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if v_ledger.state = 'completed' then
    return query select v_ledger.response_status, v_ledger.response_body, true;
    return;
  end if;

  if p_routine_id is not null then
    select * into v_routine
    from public.routines r
    where r.id = p_routine_id and r.user_id = v_user_id and r.is_active
    for share;
    if not found then
      raise exception using errcode = 'P0002', message = 'TRAINING_ROUTINE_NOT_FOUND';
    end if;
  end if;

  select
    ws.id, ws.routine_id, ws.session_name, ws.started_at, dl.log_date
  into v_active
  from public.workout_sessions ws
  join public.day_logs dl on dl.id = ws.day_log_id
  where ws.user_id = v_user_id and ws.status = 'in_progress'
  order by ws.started_at desc
  limit 1;

  if found then
    v_response := jsonb_build_object(
      'status', 'active',
      'code', 'ACTIVE_SESSION_EXISTS',
      'session', jsonb_build_object(
        'id', v_active.id,
        'routineId', v_active.routine_id,
        'name', coalesce(v_active.session_name, 'Sesión libre'),
        'logDate', v_active.log_date,
        'startedAt', v_active.started_at
      )
    );
    update public.mobile_idempotency_keys
    set state = 'completed', response_status = 409, response_body = v_response,
        resource_type = 'workout_session', resource_id = v_active.id,
        completed_at = pg_catalog.now()
    where user_id = v_user_id and operation = v_operation
      and idempotency_key = p_idempotency_key;
    return query select 409::smallint, v_response, false;
    return;
  end if;

  v_day_log := public.get_or_create_day_log(v_today);
  begin
    v_session_id := public.start_workout_session(v_day_log.id, p_routine_id);
  exception when unique_violation or raise_exception then
    get stacked diagnostics
      v_error_message = message_text,
      v_constraint_name = constraint_name;
    if v_error_message <> 'ACTIVE_SESSION_EXISTS'
      and coalesce(v_constraint_name, '') <> 'uniq_workout_sessions_user_in_progress' then
      raise;
    end if;

    select
      ws.id, ws.routine_id, ws.session_name, ws.started_at, dl.log_date
    into v_active
    from public.workout_sessions ws
    join public.day_logs dl on dl.id = ws.day_log_id
    where ws.user_id = v_user_id and ws.status = 'in_progress'
    order by ws.started_at desc
    limit 1;
    if not found then
      raise;
    end if;

    v_response := jsonb_build_object(
      'status', 'active',
      'code', 'ACTIVE_SESSION_EXISTS',
      'session', jsonb_build_object(
        'id', v_active.id,
        'routineId', v_active.routine_id,
        'name', coalesce(v_active.session_name, 'Sesión libre'),
        'logDate', v_active.log_date,
        'startedAt', v_active.started_at
      )
    );
    update public.mobile_idempotency_keys
    set state = 'completed', response_status = 409, response_body = v_response,
        resource_type = 'workout_session', resource_id = v_active.id,
        completed_at = pg_catalog.now()
    where user_id = v_user_id and operation = v_operation
      and idempotency_key = p_idempotency_key;
    return query select 409::smallint, v_response, false;
    return;
  end;

  select ws.id, ws.routine_id, ws.session_name, ws.started_at, dl.log_date
  into v_session
  from public.workout_sessions ws
  join public.day_logs dl on dl.id = ws.day_log_id
  where ws.id = v_session_id and ws.user_id = v_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'TRAINING_SESSION_START_FAILED';
  end if;

  v_response := jsonb_build_object(
    'status', 'started',
    'session', jsonb_build_object(
      'id', v_session.id,
      'routineId', v_session.routine_id,
      'name', coalesce(v_session.session_name, 'Sesión libre'),
      'logDate', v_session.log_date,
      'startedAt', v_session.started_at
    )
  );

  update public.mobile_idempotency_keys
  set state = 'completed', response_status = 201, response_body = v_response,
      resource_type = 'workout_session', resource_id = v_session.id,
      completed_at = pg_catalog.now()
  where user_id = v_user_id and operation = v_operation
    and idempotency_key = p_idempotency_key;

  return query select 201::smallint, v_response, false;
end;
$$;

revoke all on function public.mobile_training_routine_detail(uuid) from public, anon;
revoke all on function public.mobile_update_training_routine_identity(uuid, text, text, timestamptz) from public, anon;
revoke all on function public.mobile_replace_training_routine_template(uuid, bigint, jsonb) from public, anon;
revoke all on function public.mobile_start_training_session(text, uuid) from public, anon;
revoke all on function public.replace_routine_exercises(uuid, uuid[]) from public, anon;
revoke all on function public.sync_exercise_active_routine_memberships(uuid, uuid[]) from public, anon;
revoke all on function public.save_routine_exercise(uuid, jsonb) from public, anon;
revoke all on function public.move_routine_exercise(uuid, integer) from public, anon;
revoke all on function public.start_workout_session(uuid, uuid) from public, anon;
revoke all on function public.finish_workout_session(uuid, jsonb) from public, anon;

grant execute on function public.mobile_training_routine_detail(uuid) to authenticated;
grant execute on function public.mobile_update_training_routine_identity(uuid, text, text, timestamptz) to authenticated;
grant execute on function public.mobile_replace_training_routine_template(uuid, bigint, jsonb) to authenticated;
grant execute on function public.mobile_start_training_session(text, uuid) to authenticated;
grant execute on function public.replace_routine_exercises(uuid, uuid[]) to authenticated;
grant execute on function public.sync_exercise_active_routine_memberships(uuid, uuid[]) to authenticated;
grant execute on function public.save_routine_exercise(uuid, jsonb) to authenticated;
grant execute on function public.move_routine_exercise(uuid, integer) to authenticated;
grant execute on function public.start_workout_session(uuid, uuid) to authenticated;
grant execute on function public.finish_workout_session(uuid, jsonb) to authenticated;

commit;
