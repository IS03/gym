-- PR 4: flujo manual de comidas con cuatro macros. Todos los fixtures se
-- ejecutan dentro de esta transacción y se revierten al finalizar.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '29400000-0000-0000-0000-000000000001', 'authenticated',
  'authenticated', 'issue29-pr4@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '29400000-0000-0000-0000-000000000001',
  true
);

insert into public.day_logs (id, user_id, log_date)
values (
  '29400000-0000-0000-0000-000000000101',
  '29400000-0000-0000-0000-000000000001',
  '2026-08-13'
);

insert into public.meal_entries (
  id, user_id, day_log_id, title, final_calories, final_protein_g,
  final_carbs_g, final_fat_g, source_type, entry_kind
) values
  (
    '29400000-0000-0000-0000-000000000201',
    '29400000-0000-0000-0000-000000000001',
    '29400000-0000-0000-0000-000000000101',
    'COMPLETA', 620, 45, 72, 14, 'manual', 'meal'
  ),
  (
    '29400000-0000-0000-0000-000000000202',
    '29400000-0000-0000-0000-000000000001',
    '29400000-0000-0000-0000-000000000101',
    'OPCIONALES', 100, null, 0, null, 'manual', 'meal'
  );

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where id = '29400000-0000-0000-0000-000000000101'
      and total_calories_consumed = 720
      and total_protein_g = 45
      and total_carbs_g = 72
      and total_fat_g = 14
  ) then
    raise exception 'crear comidas no agregó correctamente los cuatro macros';
  end if;

  if not exists (
    select 1 from public.meal_entries
    where id = '29400000-0000-0000-0000-000000000202'
      and final_protein_g is null
      and final_carbs_g = 0
      and final_fat_g is null
  ) then
    raise exception 'null y cero no conservaron semánticas distintas';
  end if;
end;
$$;

update public.meal_entries
set final_protein_g = 10,
    final_carbs_g = null,
    final_fat_g = 0
where id = '29400000-0000-0000-0000-000000000202';

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where id = '29400000-0000-0000-0000-000000000101'
      and total_calories_consumed = 720
      and total_protein_g = 55
      and total_carbs_g = 72
      and total_fat_g = 14
  ) then
    raise exception 'editar número/null no recalculó los agregados';
  end if;
end;
$$;

do $$
begin
  begin
    update public.meal_entries
    set final_fat_g = -1
    where id = '29400000-0000-0000-0000-000000000202';
    raise exception 'se aceptaron grasas negativas';
  exception when check_violation then
    null;
  end;
end;
$$;

update public.meal_entries
set deleted_at = now()
where id = '29400000-0000-0000-0000-000000000201';

do $$
begin
  if not exists (
    select 1 from public.day_logs
    where id = '29400000-0000-0000-0000-000000000101'
      and total_calories_consumed = 100
      and total_protein_g = 10
      and total_carbs_g = 0
      and total_fat_g = 0
  ) then
    raise exception 'soft delete no quitó los cuatro macros del agregado';
  end if;
end;
$$;

rollback;
