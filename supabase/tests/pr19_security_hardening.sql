-- PR19: search_path, grants and representative cross-user/RLS regressions.
-- Synthetic fixtures only; the transaction is always rolled back.
begin;

do $$
declare
  expected text[] := array[
    'normalize_name',
    'routine_exercises_enforce_owner_min',
    'trg_day_logs_normalize_notes',
    'trg_exercises_normalize_nombre',
    'trg_meal_entries_normalize_text',
    'trg_routines_normalize_nombre',
    'trg_workout_session_exercises_completion',
    'trg_workout_session_exercises_init',
    'workout_sessions_sync_user_id'
  ];
  function_name text;
begin
  foreach function_name in array expected loop
    if not exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = function_name
        and p.proconfig = array['search_path=""']
        and not p.prosecdef
    ) then
      raise exception '% must be SECURITY INVOKER with search_path empty', function_name;
    end if;
  end loop;

  if public.normalize_name('  press   banca  ') <> 'PRESS BANCA' then
    raise exception 'normalize_name changed under empty search_path';
  end if;

  if (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind in ('r','p') and not c.relrowsecurity) <> 0 then
    raise exception 'a public table is missing RLS';
  end if;

  if exists (
    select 1 from pg_policies
    where schemaname='public'
      and (roles && array['public'::name,'anon'::name]
        or lower(coalesce(qual,'')) in ('true','(true)')
        or lower(coalesce(with_check,'')) in ('true','(true)'))
  ) then
    raise exception 'permissive public/anon/true RLS policy detected';
  end if;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.prosecdef) <> 1 then
    raise exception 'unexpected SECURITY DEFINER inventory';
  end if;
  if exists (
      select 1
      from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl, acldefault('f',p.proowner))) a
      where p.oid = 'public.create_chatgpt_meal_for_integration(uuid,date,text,text,integer,numeric,numeric,numeric,text,boolean)'::regprocedure
        and a.grantee = 0
        and a.privilege_type = 'EXECUTE'
    )
    or has_function_privilege('anon',
      'public.create_chatgpt_meal_for_integration(uuid,date,text,text,integer,numeric,numeric,numeric,text,boolean)',
      'execute')
    or has_function_privilege('authenticated',
      'public.create_chatgpt_meal_for_integration(uuid,date,text,text,integer,numeric,numeric,numeric,text,boolean)',
      'execute')
    or not has_function_privilege('service_role',
      'public.create_chatgpt_meal_for_integration(uuid,date,text,text,integer,numeric,numeric,numeric,text,boolean)',
      'execute') then
    raise exception 'SECURITY DEFINER grants are unsafe';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('21900000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'pr19-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('21900000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'pr19-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (user_id) values
  ('21900000-0000-4000-8000-000000000001'),
  ('21900000-0000-4000-8000-000000000002');
insert into public.day_logs (id,user_id,log_date,notes) values
  ('21900000-0000-4000-8000-000000000011','21900000-0000-4000-8000-000000000001','2026-08-26',' nota   privada a '),
  ('21900000-0000-4000-8000-000000000012','21900000-0000-4000-8000-000000000002','2026-08-26',' nota   privada b ');
insert into public.body_measurements (id,user_id,measured_on,waist_cm) values
  ('21900000-0000-4000-8000-000000000021','21900000-0000-4000-8000-000000000002','2026-08-26',80);
insert into public.routines (id,user_id,nombre) values
  ('21900000-0000-4000-8000-000000000031','21900000-0000-4000-8000-000000000001',' rutina   a '),
  ('21900000-0000-4000-8000-000000000032','21900000-0000-4000-8000-000000000002',' rutina   b ');
insert into public.exercises (id,user_id,nombre) values
  ('21900000-0000-4000-8000-000000000041','21900000-0000-4000-8000-000000000001',' press   a '),
  ('21900000-0000-4000-8000-000000000042','21900000-0000-4000-8000-000000000002',' press   b ');
insert into public.routine_exercises (id,routine_id,exercise_id) values
  ('21900000-0000-4000-8000-000000000051','21900000-0000-4000-8000-000000000032','21900000-0000-4000-8000-000000000042');
insert into public.routine_exercise_sets (id,user_id,routine_exercise_id,set_number) values
  ('21900000-0000-4000-8000-000000000052','21900000-0000-4000-8000-000000000002','21900000-0000-4000-8000-000000000051',2);
insert into public.meal_entries (
  id,user_id,day_log_id,title,description,final_calories,source_type,entry_kind
) values (
  '21900000-0000-4000-8000-000000000061','21900000-0000-4000-8000-000000000002',
  '21900000-0000-4000-8000-000000000012',' comida   b ',' detalle   b ',400,'manual','meal'
);
insert into public.foods (
  id,user_id,name,serving_quantity,serving_unit,calories
) values (
  '21900000-0000-4000-8000-000000000071','21900000-0000-4000-8000-000000000002',
  'Alimento B',100,'g',100
);
insert into public.integration_api_tokens (
  id,user_id,token_hash,token_prefix,label,scope
) values (
  '21900000-0000-4000-8000-000000000081','21900000-0000-4000-8000-000000000002',
  repeat('b',64),'ownlevel_fixture…','PR19','meals:write'
);
insert into public.workout_sessions (
  id,day_log_id,user_id,status
) values (
  '21900000-0000-4000-8000-000000000091','21900000-0000-4000-8000-000000000012',
  '21900000-0000-4000-8000-000000000001','in_progress'
);
insert into public.workout_session_exercises (
  id,workout_session_id,exercise_id,nombre_snapshot,user_id,is_completed
) values (
  '21900000-0000-4000-8000-000000000092','21900000-0000-4000-8000-000000000091',
  '21900000-0000-4000-8000-000000000042','PRESS B','21900000-0000-4000-8000-000000000002',false
);
insert into public.workout_sets (
  id,user_id,workout_session_exercise_id,set_number
) values (
  '21900000-0000-4000-8000-000000000093','21900000-0000-4000-8000-000000000002',
  '21900000-0000-4000-8000-000000000092',2
);

do $$
begin
  if (select notes from public.day_logs where id='21900000-0000-4000-8000-000000000011') <> 'NOTA PRIVADA A'
    or (select nombre from public.routines where id='21900000-0000-4000-8000-000000000031') <> 'RUTINA A'
    or (select nombre from public.exercises where id='21900000-0000-4000-8000-000000000041') <> 'PRESS A'
    or (select title from public.meal_entries where id='21900000-0000-4000-8000-000000000061') <> 'COMIDA B'
    or (select description from public.meal_entries where id='21900000-0000-4000-8000-000000000061') <> 'DETALLE B'
    or (select user_id from public.workout_sessions where id='21900000-0000-4000-8000-000000000091') <> '21900000-0000-4000-8000-000000000002' then
    raise exception 'trigger behavior changed under empty search_path';
  end if;
end;
$$;

update public.workout_session_exercises
set is_completed=true
where id='21900000-0000-4000-8000-000000000092';
do $$ begin
  if (select completed_at is null from public.workout_session_exercises
      where id='21900000-0000-4000-8000-000000000092') then
    raise exception 'completion bookkeeping trigger failed';
  end if;
end $$;

do $$
begin
  begin
    insert into public.routine_exercises (routine_id,exercise_id)
    values ('21900000-0000-4000-8000-000000000031','21900000-0000-4000-8000-000000000042');
    raise exception 'cross-owner routine exercise was accepted';
  exception when others then
    if sqlerrm not like '%mismo usuario%' then raise; end if;
  end;
end;
$$;

create temporary table pr19_wse_init_fixture (
  exercise_id uuid,
  nombre_snapshot text,
  grupo_muscular_snapshot text,
  series_reales integer,
  reps_reales integer,
  peso_real numeric,
  is_completed boolean,
  completed_at timestamptz
);
create trigger pr19_wse_init before insert on pr19_wse_init_fixture
for each row execute function public.trg_workout_session_exercises_init();
insert into pr19_wse_init_fixture (exercise_id,is_completed)
values ('21900000-0000-4000-8000-000000000041',true);
do $$ begin
  if (select nombre_snapshot <> 'PRESS A' or completed_at is null
      from pr19_wse_init_fixture limit 1) then
    raise exception 'legacy init trigger changed under empty search_path';
  end if;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','21900000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.role','authenticated',true);

do $$
begin
  if exists (select 1 from public.profiles where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.day_logs where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.meal_entries where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.body_measurements where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.routines where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.routine_exercises where id='21900000-0000-4000-8000-000000000051')
    or exists (select 1 from public.routine_exercise_sets where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.workout_sessions where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.workout_session_exercises where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.workout_sets where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.foods where user_id='21900000-0000-4000-8000-000000000002')
    or exists (select 1 from public.integration_api_tokens where user_id='21900000-0000-4000-8000-000000000002') then
    raise exception 'cross-user SELECT exposed private data';
  end if;

  update public.routines set nombre='ATAQUE' where id='21900000-0000-4000-8000-000000000032';
  if found then raise exception 'cross-user UPDATE was accepted'; end if;
  delete from public.body_measurements where id='21900000-0000-4000-8000-000000000021';
  if found then raise exception 'cross-user DELETE was accepted'; end if;

  begin
    insert into public.body_measurements(id,user_id,measured_on)
    values ('21900000-0000-4000-8000-000000000022','21900000-0000-4000-8000-000000000002','2026-08-27');
    raise exception 'foreign user_id INSERT was accepted';
  exception when insufficient_privilege then null;
  end;
end;
$$;

rollback;
