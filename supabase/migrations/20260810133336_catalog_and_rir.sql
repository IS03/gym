-- Catálogo limpio y objetivos centrales de RIR/descanso.
-- Las columnas se agregan sin borrar sesiones ni plantillas existentes.

begin;

alter table public.routine_exercises
  add column if not exists rest_min_seconds integer,
  add column if not exists rest_max_seconds integer;

alter table public.routine_exercises
  drop constraint if exists routine_exercises_rest_range_check;
alter table public.routine_exercises
  add constraint routine_exercises_rest_range_check
  check (
    (rest_min_seconds is null and rest_max_seconds is null)
    or (
      rest_min_seconds between 0 and 3600
      and rest_max_seconds between 0 and 3600
      and rest_min_seconds <= rest_max_seconds
    )
  );

alter table public.routine_exercise_sets
  add column if not exists target_rir smallint;
alter table public.routine_exercise_sets
  drop constraint if exists routine_exercise_sets_target_rir_check;
alter table public.routine_exercise_sets
  add constraint routine_exercise_sets_target_rir_check
  check (target_rir is null or target_rir between 0 and 10);

alter table public.workout_session_exercises
  add column if not exists rest_min_seconds_snapshot integer,
  add column if not exists rest_max_seconds_snapshot integer;
alter table public.workout_session_exercises
  drop constraint if exists workout_session_exercises_rest_range_check;
alter table public.workout_session_exercises
  add constraint workout_session_exercises_rest_range_check
  check (
    (rest_min_seconds_snapshot is null and rest_max_seconds_snapshot is null)
    or (
      rest_min_seconds_snapshot between 0 and 3600
      and rest_max_seconds_snapshot between 0 and 3600
      and rest_min_seconds_snapshot <= rest_max_seconds_snapshot
    )
  );

alter table public.workout_sets
  add column if not exists target_rir smallint;
alter table public.workout_sets
  drop constraint if exists workout_sets_target_rir_check;
alter table public.workout_sets
  add constraint workout_sets_target_rir_check
  check (target_rir is null or target_rir between 0 and 10);

-- Conserva el rango de descanso que estaba guardado en las notas.
with parsed as (
  select re.id, parts.value
  from public.routine_exercises re
  cross join lateral regexp_match(
    coalesce(re.notes, ''),
    E'Descanso:?[[:space:]]*([0-9]+):([0-9]+)(?:[–-]([0-9]+):([0-9]+))?'
  ) as parts(value)
)
update public.routine_exercises re
set
  rest_min_seconds = parsed.value[1]::integer * 60 + parsed.value[2]::integer,
  rest_max_seconds = case
    when parsed.value[3] is null then parsed.value[1]::integer * 60 + parsed.value[2]::integer
    else parsed.value[3]::integer * 60 + parsed.value[4]::integer
  end
from parsed
where re.id = parsed.id
  and re.rest_min_seconds is null
  and re.rest_max_seconds is null;

-- Un RIR expresado como rango se normaliza al extremo más conservador (el mayor).
with parsed as (
  select rs.id, parts.value
  from public.routine_exercise_sets rs
  join public.routine_exercises re on re.id = rs.routine_exercise_id
  cross join lateral regexp_match(
    coalesce(rs.notes, re.notes, ''),
    E'RIR:?[[:space:]]*([0-9]+)(?:[–-]([0-9]+))?'
  ) as parts(value)
)
update public.routine_exercise_sets rs
set target_rir = coalesce(parsed.value[2], parsed.value[1])::smallint
from parsed
where rs.id = parsed.id
  and rs.target_rir is null;

-- RIR y descanso dejan de ser texto de nota; se conservan las observaciones restantes.
update public.routine_exercises
set notes = nullif(
  btrim(
    regexp_replace(
      regexp_replace(notes, E'[[:space:]]*·[[:space:]]*RIR:?[^·]*', '', 'gi'),
      E'[[:space:]]*·[[:space:]]*Descanso:?[[:space:]]*[0-9]+:[0-9]+(?:[–-][0-9]+:[0-9]+)?',
      '',
      'gi'
    )
  ),
  ''
)
where notes is not null;

update public.routine_exercise_sets
set notes = nullif(
  btrim(
    regexp_replace(
      regexp_replace(notes, E'[[:space:]]*·[[:space:]]*RIR:?[^·]*', '', 'gi'),
      E'[[:space:]]*·[[:space:]]*Descanso:?[[:space:]]*[0-9]+:[0-9]+(?:[–-][0-9]+:[0-9]+)?',
      '',
      'gi'
    )
  ),
  ''
)
where notes is not null;

-- Las sesiones existentes conservan el objetivo que tenían al iniciarse.
update public.workout_session_exercises se
set
  rest_min_seconds_snapshot = re.rest_min_seconds,
  rest_max_seconds_snapshot = re.rest_max_seconds
from public.routine_exercises re
where se.routine_exercise_id = re.id
  and se.rest_min_seconds_snapshot is null
  and se.rest_max_seconds_snapshot is null;

update public.workout_sets ws
set target_rir = rs.target_rir
from public.workout_session_exercises se,
  public.routine_exercise_sets rs
where ws.workout_session_exercise_id = se.id
  and rs.routine_exercise_id = se.routine_exercise_id
  and rs.set_number = ws.set_number
  and ws.target_rir is null;

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
  v_user_id uuid := (select auth.uid());
  v_session_id uuid;
  v_routine_name text;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  if not exists (
    select 1 from public.day_logs where id = p_day_log_id and user_id = v_user_id
  ) then
    raise exception 'Fecha inválida o ajena';
  end if;
  if exists (
    select 1 from public.workout_sessions
    where user_id = v_user_id and status = 'in_progress'
  ) then
    raise exception 'Ya existe una sesión en curso';
  end if;
  if p_routine_id is not null then
    select nombre into v_routine_name
    from public.routines
    where id = p_routine_id and user_id = v_user_id and is_active;
    if v_routine_name is null then
      raise exception 'Rutina inválida o archivada';
    end if;
  end if;

  insert into public.workout_sessions (
    user_id, day_log_id, routine_id, routine_name_snapshot, session_name, status, started_at
  ) values (
    v_user_id, p_day_log_id, p_routine_id, v_routine_name,
    coalesce(v_routine_name, 'Sesión libre'), 'in_progress', now()
  ) returning id into v_session_id;

  if p_routine_id is not null then
    insert into public.workout_session_exercises (
      user_id, workout_session_id, routine_exercise_id, exercise_id,
      nombre_snapshot, grupo_muscular_snapshot, muscle_group_label_snapshot,
      implement_snapshot, weight_mode_snapshot,
      rest_min_seconds_snapshot, rest_max_seconds_snapshot,
      source_type, exercise_order, planned_sets_count,
      next_adjustment_snapshot, decision, notes
    )
    select
      v_user_id, v_session_id, re.id, e.id,
      e.nombre, e.grupo_muscular, e.muscle_group_label,
      e.implement, e.weight_mode,
      re.rest_min_seconds, re.rest_max_seconds,
      'routine', re.exercise_order,
      greatest(coalesce(nullif(count(res.id), 0), e.series_sugeridas, 1), 1)::integer,
      re.next_adjustment, re.next_adjustment, re.notes
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
    cross join lateral generate_series(1, se.planned_sets_count) as generated(set_number)
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
  end if;

  return v_session_id;
end;
$$;

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
  v_user_id uuid := (select auth.uid());
  v_sets_count integer;
  v_updated_at timestamptz;
begin
  if not exists (
    select 1
    from public.routine_exercises re
    join public.routines r on r.id = re.routine_id
    where re.id = p_routine_exercise_id and r.user_id = v_user_id
  ) then
    raise exception 'Ejercicio de rutina inválido';
  end if;
  if jsonb_typeof(p_payload -> 'sets') <> 'array' then
    raise exception 'sets debe ser un array';
  end if;
  v_sets_count := jsonb_array_length(p_payload -> 'sets');
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
  from jsonb_to_recordset(p_payload -> 'sets') as item(
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

create or replace function public.save_workout_exercise(
  p_session_exercise_id uuid,
  p_expected_updated_at timestamptz,
  p_payload jsonb
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_row public.workout_session_exercises;
  v_sets_count integer;
  v_updated_at timestamptz;
begin
  select se.* into v_row
  from public.workout_session_exercises se
  join public.workout_sessions ws on ws.id = se.workout_session_id
  where se.id = p_session_exercise_id
    and se.user_id = v_user_id
    and ws.status = 'in_progress'
  for update of se;
  if v_row.id is null then
    raise exception 'El ejercicio no existe o la sesión ya finalizó';
  end if;
  if v_row.updated_at is distinct from p_expected_updated_at then
    raise exception using errcode = '40001',
      message = 'El ejercicio cambió en otro dispositivo. Recargá antes de guardar.';
  end if;
  if jsonb_typeof(p_payload -> 'sets') <> 'array' then
    raise exception 'sets debe ser un array';
  end if;
  v_sets_count := jsonb_array_length(p_payload -> 'sets');
  if v_sets_count < 1 or v_sets_count > 50 then
    raise exception 'La cantidad de series debe estar entre 1 y 50';
  end if;

  update public.workout_session_exercises
  set
    planned_sets_count = v_sets_count,
    series_reales = v_sets_count,
    reps_reales = nullif(p_payload #>> '{sets,0,actual_reps}', '')::integer,
    peso_real = nullif(p_payload #>> '{sets,0,actual_weight_kg}', '')::numeric,
    is_completed = coalesce((p_payload ->> 'is_completed')::boolean, false),
    decision = coalesce(nullif(p_payload ->> 'decision', ''), 'maintain'),
    decision_note = nullif(p_payload ->> 'decision_note', ''),
    apply_to_routine = case
      when routine_exercise_id is null then false
      else coalesce((p_payload ->> 'apply_to_routine')::boolean, false)
    end,
    notes = nullif(p_payload ->> 'notes', '')
  where id = p_session_exercise_id
  returning updated_at into v_updated_at;

  delete from public.workout_sets where workout_session_exercise_id = p_session_exercise_id;
  insert into public.workout_sets (
    user_id, workout_session_exercise_id, set_number,
    target_reps, target_weight_kg, target_rir,
    actual_reps, actual_weight_kg, is_completed, notes
  )
  select
    v_user_id, p_session_exercise_id, item.set_number,
    item.target_reps, item.target_weight_kg, item.target_rir,
    item.actual_reps, item.actual_weight_kg, coalesce(item.is_completed, false),
    nullif(item.notes, '')
  from jsonb_to_recordset(p_payload -> 'sets') as item(
    set_number integer,
    target_reps integer,
    target_weight_kg numeric,
    target_rir smallint,
    actual_reps integer,
    actual_weight_kg numeric,
    is_completed boolean,
    notes text
  );
  if (select count(*) from public.workout_sets
      where workout_session_exercise_id = p_session_exercise_id) <> v_sets_count then
    raise exception 'Las series deben tener números únicos';
  end if;
  if exists (
    select 1 from (
      select min(set_number) as first_number, max(set_number) as last_number,
        count(*)::integer as total
      from public.workout_sets where workout_session_exercise_id = p_session_exercise_id
    ) numbered
    where numbered.first_number <> 1 or numbered.last_number <> numbered.total
  ) then
    raise exception 'Las series deben estar numeradas en orden desde 1';
  end if;
  return v_updated_at;
end;
$$;

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
  v_user_id uuid := (select auth.uid());
  v_session public.workout_sessions;
  v_exercise record;
begin
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
      update public.routine_exercises
      set
        next_adjustment = v_exercise.decision,
        rest_min_seconds = v_exercise.rest_min_seconds_snapshot,
        rest_max_seconds = v_exercise.rest_max_seconds_snapshot,
        notes = coalesce(v_exercise.decision_note, notes)
      where id = v_exercise.routine_exercise_id;
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
    ended_at = now()
  where id = p_session_id;
  return p_session_id;
end;
$$;

revoke all on function public.start_workout_session(uuid, uuid) from public, anon;
revoke all on function public.save_routine_exercise(uuid, jsonb) from public, anon;
revoke all on function public.save_workout_exercise(uuid, timestamptz, jsonb) from public, anon;
revoke all on function public.finish_workout_session(uuid, jsonb) from public, anon;
grant execute on function public.start_workout_session(uuid, uuid) to authenticated;
grant execute on function public.save_routine_exercise(uuid, jsonb) to authenticated;
grant execute on function public.save_workout_exercise(uuid, timestamptz, jsonb) to authenticated;
grant execute on function public.finish_workout_session(uuid, jsonb) to authenticated;

commit;
