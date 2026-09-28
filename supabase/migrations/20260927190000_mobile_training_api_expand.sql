-- M3.1A: Mobile Training API expand.
-- Additive idempotency ledger plus transactional creates for routines/exercises.
-- The public RPC names are valid PostgreSQL identifiers for the logical
-- operations training.routine.create.v1 and training.exercise.create.v1.
begin;

create table public.mobile_idempotency_keys (
  user_id uuid not null references auth.users(id) on delete cascade,
  operation text not null,
  idempotency_key text not null,
  request_hash text not null,
  state text not null default 'processing',
  response_status smallint,
  response_body jsonb,
  resource_type text,
  resource_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '30 days'),
  primary key (user_id, operation, idempotency_key),
  constraint mobile_idempotency_operation_not_blank
    check (nullif(btrim(operation), '') is not null),
  constraint mobile_idempotency_key_format
    check (
      char_length(idempotency_key) between 1 and 128
      and idempotency_key ~ '^[A-Za-z0-9._:-]+$'
    ),
  constraint mobile_idempotency_request_hash_format
    check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint mobile_idempotency_state_check
    check (state in ('processing', 'completed')),
  constraint mobile_idempotency_response_status_check
    check (response_status is null or response_status between 200 and 599),
  constraint mobile_idempotency_completion_check
    check (
      (
        state = 'processing'
        and response_status is null
        and response_body is null
        and completed_at is null
      )
      or
      (
        state = 'completed'
        and response_status is not null
        and response_body is not null
        and completed_at is not null
      )
    )
);

create index mobile_idempotency_keys_expires_at_idx
on public.mobile_idempotency_keys (expires_at);

alter table public.mobile_idempotency_keys enable row level security;

-- The ledger is intentionally not a client data surface. There are no RLS
-- policies and no table grants for anon/authenticated; the RPCs below are the
-- only access path and always derive ownership from auth.uid().
revoke all on table public.mobile_idempotency_keys from public, anon, authenticated;

comment on table public.mobile_idempotency_keys is
  'User-scoped Mobile API idempotency ledger. Completed rows may be deleted in bounded batches after expires_at; cleanup never touches domain resources.';

create function public.mobile_create_training_routine(
  p_idempotency_key text,
  p_name text,
  p_color text
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
  v_operation constant text := 'training.routine.create.v1';
  v_name text;
  v_payload jsonb;
  v_request_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_routine public.routines%rowtype;
  v_response jsonb;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'No autenticado';
  end if;
  if p_idempotency_key is null
    or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'La operación no es válida.';
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

  v_payload := jsonb_build_object('name', v_name, 'color', p_color);
  v_request_hash := encode(
    public.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.mobile_idempotency_keys (
    user_id, operation, idempotency_key, request_hash, expires_at
  ) values (
    v_user_id, v_operation, p_idempotency_key, v_request_hash,
    now() + interval '30 days'
  )
  on conflict (user_id, operation, idempotency_key) do nothing;

  select * into v_ledger
  from public.mobile_idempotency_keys
  where user_id = v_user_id
    and operation = v_operation
    and idempotency_key = p_idempotency_key
  for update;

  if v_ledger.request_hash <> v_request_hash then
    raise exception using
      errcode = 'P0001',
      message = 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if v_ledger.state = 'completed' then
    return query
      select v_ledger.response_status, v_ledger.response_body, true;
    return;
  end if;

  begin
    insert into public.routines (user_id, nombre, color, is_active)
    values (v_user_id, v_name, p_color, true)
    returning * into v_routine;
  exception when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'Ya existe una rutina con ese nombre.';
  end;

  v_response := jsonb_build_object(
    'routine', jsonb_build_object(
      'id', v_routine.id,
      'name', v_routine.nombre,
      'color', v_routine.color,
      'order', v_routine.routine_order,
      'isActive', v_routine.is_active,
      'exerciseCount', 0,
      'setCount', 0
    )
  );

  update public.mobile_idempotency_keys
  set
    state = 'completed',
    response_status = 201,
    response_body = v_response,
    resource_type = 'routine',
    resource_id = v_routine.id,
    completed_at = now()
  where user_id = v_user_id
    and operation = v_operation
    and idempotency_key = p_idempotency_key;

  return query select 201::smallint, v_response, false;
end;
$$;

create function public.mobile_create_training_exercise(
  p_idempotency_key text,
  p_exercise jsonb,
  p_routine_ids uuid[] default '{}'::uuid[]
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
  v_operation constant text := 'training.exercise.create.v1';
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
  v_payload jsonb;
  v_request_hash text;
  v_ledger public.mobile_idempotency_keys%rowtype;
  v_exercise public.exercises%rowtype;
  v_response jsonb;
  v_warning text;
begin
  if v_user_id is null then
    raise exception using errcode = 'P0001', message = 'No autenticado';
  end if;
  if p_idempotency_key is null
    or char_length(p_idempotency_key) not between 1 and 128
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception using errcode = '22023', message = 'La operación no es válida.';
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
  if cardinality(v_routine_ids) > 1 then
    raise exception using
      errcode = '22023',
      message = 'Al crear un ejercicio podés elegir una sola rutina.';
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

  if cardinality(v_routine_ids) = 1 and not exists (
    select 1
    from public.routines r
    where r.id = v_routine_ids[1]
      and r.user_id = v_user_id
      and r.is_active
  ) then
    raise exception using
      errcode = '22023',
      message = 'La rutina seleccionada no existe, es ajena o está archivada.';
  end if;

  v_payload := jsonb_build_object(
    'exercise', jsonb_build_object(
      'name', v_name,
      'muscleGroup', v_muscle_group,
      'muscleGroupLabel', v_muscle_group_label,
      'implement', v_implement,
      'weightMode', v_weight_mode,
      'suggestedSets', v_suggested_sets,
      'suggestedReps', v_suggested_reps,
      'suggestedWeight', v_suggested_weight,
      'suggestedRir', v_suggested_rir,
      'suggestedRestMinSeconds', v_rest_min,
      'suggestedRestMaxSeconds', v_rest_max,
      'notes', v_notes
    ),
    'routineIds', to_jsonb(v_routine_ids)
  );
  v_request_hash := encode(
    public.digest(convert_to(v_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  insert into public.mobile_idempotency_keys (
    user_id, operation, idempotency_key, request_hash, expires_at
  ) values (
    v_user_id, v_operation, p_idempotency_key, v_request_hash,
    now() + interval '30 days'
  )
  on conflict (user_id, operation, idempotency_key) do nothing;

  select * into v_ledger
  from public.mobile_idempotency_keys
  where user_id = v_user_id
    and operation = v_operation
    and idempotency_key = p_idempotency_key
  for update;

  if v_ledger.request_hash <> v_request_hash then
    raise exception using
      errcode = 'P0001',
      message = 'IDEMPOTENCY_KEY_REUSED';
  end if;
  if v_ledger.state = 'completed' then
    return query
      select v_ledger.response_status, v_ledger.response_body, true;
    return;
  end if;

  begin
    insert into public.exercises (
      user_id, nombre, grupo_muscular, muscle_group_label, implement,
      weight_mode, series_sugeridas, reps_sugeridas, peso_sugerido,
      rir_sugerido, descanso_min_sugerido_segundos,
      descanso_max_sugerido_segundos, notes, is_active
    ) values (
      v_user_id, v_name, v_muscle_group, v_muscle_group_label, v_implement,
      v_weight_mode, v_suggested_sets, v_suggested_reps, v_suggested_weight,
      v_suggested_rir, v_rest_min, v_rest_max, v_notes, true
    )
    returning * into v_exercise;
  exception when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'Ya existe un ejercicio con ese nombre.';
  end;

  if cardinality(v_routine_ids) = 1 then
    begin
      insert into public.routine_exercises (routine_id, exercise_id)
      values (v_routine_ids[1], v_exercise.id);
    exception when others then
      v_warning := 'Ejercicio creado. No pudo agregarse a la rutina; podés reintentarlo al editarlo.';
      v_routine_ids := '{}'::uuid[];
    end;
  end if;

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
  if v_warning is not null then
    v_response := v_response || jsonb_build_object('warning', v_warning);
  end if;

  update public.mobile_idempotency_keys
  set
    state = 'completed',
    response_status = 201,
    response_body = v_response,
    resource_type = 'exercise',
    resource_id = v_exercise.id,
    completed_at = now()
  where user_id = v_user_id
    and operation = v_operation
    and idempotency_key = p_idempotency_key;

  return query select 201::smallint, v_response, false;
end;
$$;

-- This RPC does not access the closed idempotency ledger, so it remains
-- SECURITY INVOKER and keeps the caller's table grants and RLS in force.
create function public.mobile_update_training_exercise(
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

revoke all on function public.mobile_create_training_routine(text, text, text)
from public, anon;
grant execute on function public.mobile_create_training_routine(text, text, text)
to authenticated;

revoke all on function public.mobile_create_training_exercise(text, jsonb, uuid[])
from public, anon;
grant execute on function public.mobile_create_training_exercise(text, jsonb, uuid[])
to authenticated;

revoke all on function public.mobile_update_training_exercise(uuid, jsonb, uuid[])
from public, anon;
grant execute on function public.mobile_update_training_exercise(uuid, jsonb, uuid[])
to authenticated;

comment on function public.mobile_create_training_routine(text, text, text) is
  'Transactional Mobile operation training.routine.create.v1.';
comment on function public.mobile_create_training_exercise(text, jsonb, uuid[]) is
  'Transactional Mobile operation training.exercise.create.v1.';
comment on function public.mobile_update_training_exercise(uuid, jsonb, uuid[]) is
  'Atomic desired-state Mobile update for an owned training exercise and its active routine memberships.';

-- Minimal safe cleanup strategy (not scheduled here): periodically delete only
-- completed rows whose expires_at is in the past, in bounded batches ordered by
-- expires_at. Domain resources are never part of that delete.
--
-- with expired as (
--   select user_id, operation, idempotency_key
--   from public.mobile_idempotency_keys
--   where state = 'completed' and expires_at < now()
--   order by expires_at
--   limit 1000
-- )
-- delete from public.mobile_idempotency_keys ledger
-- using expired
-- where ledger.user_id = expired.user_id
--   and ledger.operation = expired.operation
--   and ledger.idempotency_key = expired.idempotency_key;

commit;
