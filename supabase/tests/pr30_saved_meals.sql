-- PR30: schema, ownership, snapshots and history invariants.
-- Synthetic fixtures only; the transaction is always rolled back.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('30000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'pr30-a@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
  ('30000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'pr30-b@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

insert into public.profiles (user_id) values
  ('30000000-0000-4000-8000-000000000001'),
  ('30000000-0000-4000-8000-000000000002');

insert into public.day_logs (id, user_id, log_date) values
  ('30000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000001', '2026-08-30');

insert into public.foods (
  id, user_id, name, serving_quantity, serving_unit,
  calories, protein_g, carbs_g, fat_g
) values
  ('30000000-0000-4000-8000-000000000021', '30000000-0000-4000-8000-000000000001',
   'PR30 TEST FOOD', 100, 'g', 120, 20, 10, 4);

set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.save_saved_meal_template(
  null, '  pr30   simple  ', 'Sintética', 'manual',
  300, 25, 30, 8, '[]'::jsonb
);

select public.save_saved_meal_template(
  null, 'pr30 composite', null, 'composite',
  null, null, null, null,
  jsonb_build_array(jsonb_build_object(
    'label', 'PR30 TEST FOOD',
    'quantity', 150,
    'unit', 'g',
    'base_quantity', 100,
    'base_calories', 120,
    'base_protein_g', 20,
    'base_carbs_g', 10,
    'base_fat_g', 4,
    'source_food_id', '30000000-0000-4000-8000-000000000021'
  ))
);

select public.save_saved_meal_template(
  null, 'pr30 partial', null, 'composite',
  null, null, null, null,
  jsonb_build_array(
    jsonb_build_object(
      'label', 'KNOWN', 'quantity', 1, 'unit', 'u', 'base_quantity', 1,
      'base_calories', 100, 'base_protein_g', 10,
      'base_carbs_g', 10, 'base_fat_g', 4, 'source_food_id', null
    ),
    jsonb_build_object(
      'label', 'PARTIAL', 'quantity', 1, 'unit', 'u', 'base_quantity', 1,
      'base_calories', 50, 'base_protein_g', 5,
      'base_carbs_g', null, 'base_fat_g', 0, 'source_food_id', null
    )
  )
);

-- RLS must isolate a second authenticated owner in both directions.
select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', true);
select public.save_saved_meal_template(
  null, 'pr30 foreign owner', null, 'manual',
  200, 10, null, 5, '[]'::jsonb
);

do $$
begin
  if (select count(*) from public.saved_meals) <> 1 then
    raise exception 'owner B can read another owner saved meals';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000001', true);

do $$
begin
  if (select count(*) from public.saved_meals) <> 3
    or exists (select 1 from public.saved_meals where name = 'PR30 FOREIGN OWNER') then
    raise exception 'owner A can read another owner saved meal';
  end if;
end;
$$;

do $$
declare
  v_composite_id uuid;
begin
  if not exists (
    select 1 from public.saved_meals
    where user_id = '30000000-0000-4000-8000-000000000001'
      and name = 'PR30 SIMPLE'
      and calories = 300 and protein_g = 25 and carbs_g = 30 and fat_g = 8
  ) then
    raise exception 'simple saved meal was not normalized/persisted';
  end if;

  select id into v_composite_id
  from public.saved_meals
  where user_id = '30000000-0000-4000-8000-000000000001'
    and name = 'PR30 COMPOSITE';

  if not exists (
    select 1 from public.saved_meals
    where id = v_composite_id
      and calories = 180 and protein_g = 30 and carbs_g = 15 and fat_g = 6
  ) then
    raise exception 'composite totals were not derived canonically';
  end if;

  if not exists (
    select 1 from public.saved_meals
    where name = 'PR30 PARTIAL'
      and calories = 150 and protein_g = 15
      and carbs_g is null and fat_g = 4
  ) then
    raise exception 'composite null/zero propagation is incorrect';
  end if;

  begin
    insert into public.saved_meal_items (
      saved_meal_id, user_id, label, quantity, unit, base_quantity,
      base_calories, position
    ) values (
      v_composite_id, '30000000-0000-4000-8000-000000000002',
      'FOREIGN OWNER', 1, 'u', 1, 1, 1
    );
    raise exception 'cross-owner item was accepted';
  exception when foreign_key_violation or insufficient_privilege then
    null;
  end;
end;
$$;

-- Food deletion cannot cascade or invalidate the component snapshot.
delete from public.foods
where id = '30000000-0000-4000-8000-000000000021';

do $$
begin
  if not exists (
    select 1 from public.saved_meal_items
    where source_food_id = '30000000-0000-4000-8000-000000000021'
      and base_calories = 120
  ) then
    raise exception 'Food delete changed the saved item snapshot';
  end if;
end;
$$;

-- Persist a historical snapshot, then remove its mutable template.
insert into public.meal_entries (
  id, user_id, day_log_id, title, description,
  final_calories, final_protein_g, final_carbs_g, final_fat_g,
  source_type, entry_kind, context_type
) values (
  '30000000-0000-4000-8000-000000000031',
  '30000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000011',
  'PR30 COMPOSITE', '150 g pr30 test food',
  180, 30, 15, 6, 'manual', 'meal', 'saved_meal'
);

delete from public.saved_meals
where user_id = '30000000-0000-4000-8000-000000000001'
  and name = 'PR30 COMPOSITE';

do $$
begin
  if not exists (
    select 1 from public.meal_entries
    where id = '30000000-0000-4000-8000-000000000031'
      and final_calories = 180 and final_protein_g = 30
      and final_carbs_g = 15 and final_fat_g = 6
  ) then
    raise exception 'SavedMeal delete changed historical MealEntry';
  end if;
  if exists (
    select 1 from public.saved_meal_items
    where saved_meal_id not in (select id from public.saved_meals)
  ) then
    raise exception 'SavedMealItem cascade left orphans';
  end if;
end;
$$;

reset role;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where confrelid = 'public.foods'::regclass
      and conrelid = 'public.saved_meal_items'::regclass
  ) then
    raise exception 'saved_meal_items introduced a live FK to foods';
  end if;
  if not (
    select relrowsecurity from pg_class
    where oid = 'public.saved_meals'::regclass
  ) or not (
    select relrowsecurity from pg_class
    where oid = 'public.saved_meal_items'::regclass
  ) then
    raise exception 'RLS is not enabled on saved meal tables';
  end if;
  if has_table_privilege('anon', 'public.saved_meals', 'select')
    or has_table_privilege('anon', 'public.saved_meal_items', 'select') then
    raise exception 'anon received saved meal privileges';
  end if;
  if not has_table_privilege('authenticated', 'public.saved_meals', 'select,insert,update,delete')
    or not has_table_privilege('authenticated', 'public.saved_meal_items', 'select,insert,update,delete') then
    raise exception 'authenticated grants are incomplete';
  end if;
  if exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename in ('saved_meals', 'saved_meal_items')
      and (roles && array['public'::name, 'anon'::name]
        or lower(coalesce(qual, '')) in ('true', '(true)')
        or lower(coalesce(with_check, '')) in ('true', '(true)'))
  ) then
    raise exception 'saved meal RLS contains a public/permissive policy';
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'saved_meal_items_parent_owner_fk'
      and conrelid = 'public.saved_meal_items'::regclass
  ) then
    raise exception 'structural ownership FK is missing';
  end if;
end;
$$;

rollback;
