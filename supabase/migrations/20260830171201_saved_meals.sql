-- PR30: comidas habituales administrables y componentes snapshot-first.
-- No se migran sugerencias históricas ni se agregan referencias desde
-- meal_entries: una comida registrada continúa siendo un hecho independiente.
begin;

create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  template_type text not null default 'manual',
  calories integer,
  protein_g numeric(10,2),
  carbs_g numeric(10,2),
  fat_g numeric(10,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saved_meals_id_user_unique unique (id, user_id),
  constraint saved_meals_name_not_blank
    check (nullif(btrim(name), '') is not null),
  constraint saved_meals_template_type_check
    check (template_type in ('manual', 'composite')),
  constraint saved_meals_nutrition_non_negative check (
    (calories is null or calories >= 0)
    and (protein_g is null or protein_g >= 0)
    and (carbs_g is null or carbs_g >= 0)
    and (fat_g is null or fat_g >= 0)
  ),
  constraint saved_meals_manual_nutrition_known check (
    template_type <> 'manual'
    or calories is not null
    or protein_g is not null
    or carbs_g is not null
    or fat_g is not null
  )
);

create table public.saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  saved_meal_id uuid not null,
  user_id uuid not null,
  label text not null,
  quantity numeric(12,3) not null,
  unit text not null,
  base_quantity numeric(12,3) not null,
  base_calories integer,
  base_protein_g numeric(12,4),
  base_carbs_g numeric(12,4),
  base_fat_g numeric(12,4),
  -- Provenance only: deliberately no FK, so deleting a Food cannot break a
  -- saved composite. Nutrition always comes from the snapshot above.
  source_food_id uuid,
  position smallint not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint saved_meal_items_parent_owner_fk
    foreign key (saved_meal_id, user_id)
    references public.saved_meals(id, user_id)
    on delete cascade,
  constraint saved_meal_items_parent_position_unique
    unique (saved_meal_id, position),
  constraint saved_meal_items_label_not_blank
    check (nullif(btrim(label), '') is not null),
  constraint saved_meal_items_unit_not_blank
    check (nullif(btrim(unit), '') is not null),
  constraint saved_meal_items_quantity_in_range check (
    quantity > 0 and quantity <= 1000000
    and base_quantity > 0 and base_quantity <= 1000000
  ),
  constraint saved_meal_items_position_in_range
    check (position between 0 and 99),
  constraint saved_meal_items_nutrition_non_negative check (
    (base_calories is null or base_calories >= 0)
    and (base_protein_g is null or base_protein_g >= 0)
    and (base_carbs_g is null or base_carbs_g >= 0)
    and (base_fat_g is null or base_fat_g >= 0)
  ),
  constraint saved_meal_items_nutrition_known check (
    base_calories is not null
    or base_protein_g is not null
    or base_carbs_g is not null
    or base_fat_g is not null
  )
);

create unique index saved_meals_user_active_name_unique
on public.saved_meals (user_id, name)
where is_active;

create index idx_saved_meals_user_active_name
on public.saved_meals (user_id, is_active, name);

create index idx_saved_meal_items_parent_owner
on public.saved_meal_items (saved_meal_id, user_id);

create or replace function public.trg_saved_meals_normalize()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name := nullif(
    pg_catalog.upper(
      pg_catalog.regexp_replace(pg_catalog.btrim(new.name), '\s+', ' ', 'g')
    ),
    ''
  );
  new.description := nullif(pg_catalog.btrim(new.description), '');
  return new;
end;
$$;

create or replace function public.trg_saved_meal_items_normalize()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.label := nullif(
    pg_catalog.upper(
      pg_catalog.regexp_replace(pg_catalog.btrim(new.label), '\s+', ' ', 'g')
    ),
    ''
  );
  new.unit := nullif(pg_catalog.btrim(new.unit), '');
  return new;
end;
$$;

create trigger tr_saved_meals_normalize
before insert or update of name, description on public.saved_meals
for each row execute function public.trg_saved_meals_normalize();

create trigger tr_saved_meal_items_normalize
before insert or update of label, unit on public.saved_meal_items
for each row execute function public.trg_saved_meal_items_normalize();

create trigger tr_saved_meals_updated_at
before update on public.saved_meals
for each row execute function public.set_updated_at();

create trigger tr_saved_meal_items_updated_at
before update on public.saved_meal_items
for each row execute function public.set_updated_at();

create or replace function public.recalculate_saved_meal_totals(
  p_saved_meal_id uuid
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_template_type text;
  v_count bigint;
  v_calorie_count bigint;
  v_protein_count bigint;
  v_carbs_count bigint;
  v_fat_count bigint;
  v_calories numeric;
  v_protein numeric;
  v_carbs numeric;
  v_fat numeric;
begin
  select user_id, template_type
  into v_user_id, v_template_type
  from public.saved_meals
  where id = p_saved_meal_id
  for update;

  if not found or v_template_type <> 'composite' then
    return;
  end if;

  select
    pg_catalog.count(*),
    pg_catalog.count(base_calories),
    pg_catalog.count(base_protein_g),
    pg_catalog.count(base_carbs_g),
    pg_catalog.count(base_fat_g),
    pg_catalog.sum(base_calories::numeric * quantity / base_quantity),
    pg_catalog.sum(base_protein_g * quantity / base_quantity),
    pg_catalog.sum(base_carbs_g * quantity / base_quantity),
    pg_catalog.sum(base_fat_g * quantity / base_quantity)
  into
    v_count, v_calorie_count, v_protein_count, v_carbs_count, v_fat_count,
    v_calories, v_protein, v_carbs, v_fat
  from public.saved_meal_items
  where saved_meal_id = p_saved_meal_id
    and user_id = v_user_id;

  update public.saved_meals
  set
    calories = case
      when v_count = 0 or v_calorie_count <> v_count then null
      else pg_catalog.round(v_calories)::integer
    end,
    protein_g = case
      when v_count = 0 or v_protein_count <> v_count then null
      else pg_catalog.round(v_protein, 2)
    end,
    carbs_g = case
      when v_count = 0 or v_carbs_count <> v_count then null
      else pg_catalog.round(v_carbs, 2)
    end,
    fat_g = case
      when v_count = 0 or v_fat_count <> v_count then null
      else pg_catalog.round(v_fat, 2)
    end
  where id = p_saved_meal_id
    and user_id = v_user_id;
end;
$$;

create or replace function public.trg_saved_meal_items_recalculate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.saved_meal_id is distinct from old.saved_meal_id then
    perform public.recalculate_saved_meal_totals(old.saved_meal_id);
  end if;

  perform public.recalculate_saved_meal_totals(
    case when tg_op = 'DELETE' then old.saved_meal_id else new.saved_meal_id end
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger tr_saved_meal_items_recalculate
after insert or update or delete on public.saved_meal_items
for each row execute function public.trg_saved_meal_items_recalculate();

-- Reemplaza una plantilla y todos sus componentes en una única transacción.
-- Los snapshots recibidos ya fueron materializados por la acción server-side;
-- Postgres deriva siempre los totales compuestos desde las filas persistidas.
create or replace function public.save_saved_meal_template(
  p_saved_meal_id uuid,
  p_name text,
  p_description text,
  p_template_type text,
  p_manual_calories integer,
  p_manual_protein_g numeric,
  p_manual_carbs_g numeric,
  p_manual_fat_g numeric,
  p_items jsonb
)
returns public.saved_meals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_meal public.saved_meals;
  v_item_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  if p_template_type not in ('manual', 'composite') then
    raise exception using errcode = '22023', message = 'invalid template type';
  end if;
  if p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'items must be an array';
  end if;

  v_item_count := pg_catalog.jsonb_array_length(p_items);
  if p_template_type = 'manual' and v_item_count <> 0 then
    raise exception using errcode = '22023', message = 'manual meals cannot have items';
  end if;
  if p_template_type = 'composite' and (v_item_count < 1 or v_item_count > 50) then
    raise exception using errcode = '22023', message = 'composite meals require 1 to 50 items';
  end if;

  if p_saved_meal_id is null then
    insert into public.saved_meals (
      user_id, name, description, template_type,
      calories, protein_g, carbs_g, fat_g
    ) values (
      v_user_id, p_name, p_description, p_template_type,
      case when p_template_type = 'manual' then p_manual_calories else null end,
      case when p_template_type = 'manual' then p_manual_protein_g else null end,
      case when p_template_type = 'manual' then p_manual_carbs_g else null end,
      case when p_template_type = 'manual' then p_manual_fat_g else null end
    )
    returning * into v_meal;
  else
    update public.saved_meals
    set
      name = p_name,
      description = p_description,
      template_type = p_template_type,
      calories = case when p_template_type = 'manual' then p_manual_calories else null end,
      protein_g = case when p_template_type = 'manual' then p_manual_protein_g else null end,
      carbs_g = case when p_template_type = 'manual' then p_manual_carbs_g else null end,
      fat_g = case when p_template_type = 'manual' then p_manual_fat_g else null end
    where id = p_saved_meal_id
      and user_id = v_user_id
    returning * into v_meal;

    if not found then
      raise exception using errcode = 'P0002', message = 'saved meal not found';
    end if;
  end if;

  delete from public.saved_meal_items
  where saved_meal_id = v_meal.id
    and user_id = v_user_id;

  if p_template_type = 'composite' then
    insert into public.saved_meal_items (
      saved_meal_id, user_id, label, quantity, unit, base_quantity,
      base_calories, base_protein_g, base_carbs_g, base_fat_g,
      source_food_id, position
    )
    select
      v_meal.id,
      v_user_id,
      item.value ->> 'label',
      (item.value ->> 'quantity')::numeric,
      item.value ->> 'unit',
      (item.value ->> 'base_quantity')::numeric,
      (item.value ->> 'base_calories')::integer,
      (item.value ->> 'base_protein_g')::numeric,
      (item.value ->> 'base_carbs_g')::numeric,
      (item.value ->> 'base_fat_g')::numeric,
      (item.value ->> 'source_food_id')::uuid,
      (item.ordinality - 1)::smallint
    from pg_catalog.jsonb_array_elements(p_items) with ordinality as item(value, ordinality);
  end if;

  select * into v_meal
  from public.saved_meals
  where id = v_meal.id and user_id = v_user_id;
  return v_meal;
end;
$$;

alter table public.saved_meals enable row level security;
alter table public.saved_meal_items enable row level security;

create policy saved_meals_select_own
on public.saved_meals for select to authenticated
using ((select auth.uid()) = user_id);
create policy saved_meals_insert_own
on public.saved_meals for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy saved_meals_update_own
on public.saved_meals for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy saved_meals_delete_own
on public.saved_meals for delete to authenticated
using ((select auth.uid()) = user_id);

create policy saved_meal_items_select_own
on public.saved_meal_items for select to authenticated
using ((select auth.uid()) = user_id);
create policy saved_meal_items_insert_own
on public.saved_meal_items for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy saved_meal_items_update_own
on public.saved_meal_items for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy saved_meal_items_delete_own
on public.saved_meal_items for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.saved_meals, public.saved_meal_items
from public, anon, authenticated;
grant select, insert, update, delete on table
  public.saved_meals, public.saved_meal_items
to authenticated;

revoke all on function public.trg_saved_meals_normalize()
from public, anon, authenticated;
revoke all on function public.trg_saved_meal_items_normalize()
from public, anon, authenticated;
revoke all on function public.recalculate_saved_meal_totals(uuid)
from public, anon, authenticated;
revoke all on function public.trg_saved_meal_items_recalculate()
from public, anon, authenticated;
revoke all on function public.save_saved_meal_template(
  uuid, text, text, text, integer, numeric, numeric, numeric, jsonb
) from public, anon, authenticated;
grant execute on function public.recalculate_saved_meal_totals(uuid)
to authenticated;
grant execute on function public.save_saved_meal_template(
  uuid, text, text, text, integer, numeric, numeric, numeric, jsonb
) to authenticated;

comment on table public.saved_meals is
  'Plantillas nutricionales mutables administradas por cada usuario.';
comment on table public.saved_meal_items is
  'Componentes nutricionales snapshot de una comida habitual compuesta.';
comment on column public.saved_meal_items.source_food_id is
  'Provenance hint without FK; Food deletion must not affect this snapshot.';

commit;
