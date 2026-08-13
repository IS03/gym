-- Issue #29, fase 1: fundación aditiva del schema nutricional.
-- Esta migración no carga objetivos reales ni activa el motor diario nuevo.
begin;

-- Los triggers nuevos reutilizan el helper común. Se conserva su comportamiento,
-- pero se elimina el search_path mutable porque ahora es una dependencia directa
-- de los objetos nutricionales.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ==========================================================
-- Períodos versionados
-- ==========================================================

create table public.nutrition_goal_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  name text not null,
  calories_no_gym integer not null,
  calories_gym integer not null,
  protein_no_gym_g numeric(8,2) not null,
  protein_gym_g numeric(8,2) not null,
  water_no_gym_l numeric(5,2) not null,
  water_gym_l numeric(5,2) not null,
  goal_type text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint nutrition_goal_periods_user_effective_from_unique
    unique (user_id, effective_from),
  constraint nutrition_goal_periods_id_user_unique unique (id, user_id),
  constraint nutrition_goal_periods_name_not_blank
    check (nullif(btrim(name), '') is not null),
  constraint nutrition_goal_periods_calories_in_range check (
    calories_no_gym between 1 and 20000
    and calories_gym between 1 and 20000
  ),
  constraint nutrition_goal_periods_protein_in_range check (
    protein_no_gym_g between 0 and 2000
    and protein_gym_g between 0 and 2000
  ),
  constraint nutrition_goal_periods_water_in_range check (
    water_no_gym_l between 0 and 50
    and water_gym_l between 0 and 50
  ),
  constraint nutrition_goal_periods_goal_type_check check (
    goal_type is null or goal_type in ('lose', 'maintain', 'gain')
  )
);

create table public.expenditure_rule_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  name text not null,
  work_gym_kcal integer not null,
  work_no_gym_kcal integer not null,
  no_work_gym_kcal integer not null,
  no_work_no_gym_kcal integer not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint expenditure_rule_periods_user_effective_from_unique
    unique (user_id, effective_from),
  constraint expenditure_rule_periods_id_user_unique unique (id, user_id),
  constraint expenditure_rule_periods_name_not_blank
    check (nullif(btrim(name), '') is not null),
  constraint expenditure_rule_periods_values_in_range check (
    work_gym_kcal between 1 and 50000
    and work_no_gym_kcal between 1 and 50000
    and no_work_gym_kcal between 1 and 50000
    and no_work_no_gym_kcal between 1 and 50000
  )
);

create table public.work_schedule_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null,
  name text not null,
  monday boolean not null default false,
  tuesday boolean not null default false,
  wednesday boolean not null default false,
  thursday boolean not null default false,
  friday boolean not null default false,
  saturday boolean not null default false,
  sunday boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint work_schedule_periods_user_effective_from_unique
    unique (user_id, effective_from),
  constraint work_schedule_periods_id_user_unique unique (id, user_id),
  constraint work_schedule_periods_name_not_blank
    check (nullif(btrim(name), '') is not null)
);

-- ==========================================================
-- Importaciones reproducibles y catálogo personal
-- ==========================================================

create table public.nutrition_import_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_name text not null,
  source_sha256 text not null,
  applied_at timestamptz not null default now(),
  counts jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,

  constraint nutrition_import_runs_user_source_hash_unique
    unique (user_id, source_name, source_sha256),
  constraint nutrition_import_runs_id_user_unique unique (id, user_id),
  constraint nutrition_import_runs_source_name_not_blank
    check (nullif(btrim(source_name), '') is not null),
  constraint nutrition_import_runs_sha256_format
    check (source_sha256 ~ '^[0-9a-f]{64}$'),
  constraint nutrition_import_runs_counts_object
    check (jsonb_typeof(counts) = 'object'),
  constraint nutrition_import_runs_report_object
    check (jsonb_typeof(report) = 'object')
);

create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  serving_quantity numeric(10,3) not null,
  serving_unit text not null,
  calories integer not null,
  protein_g numeric(8,2) not null,
  carbs_g numeric(8,2) not null,
  fat_g numeric(8,2) not null,
  precision_level text,
  source_note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint foods_name_not_blank check (nullif(btrim(name), '') is not null),
  constraint foods_serving_unit_not_blank
    check (nullif(btrim(serving_unit), '') is not null),
  constraint foods_serving_quantity_in_range
    check (serving_quantity > 0 and serving_quantity <= 1000000),
  constraint foods_nutrition_non_negative check (
    calories >= 0
    and protein_g >= 0
    and carbs_g >= 0
    and fat_g >= 0
  ),
  constraint foods_precision_level_check check (
    precision_level is null
    or precision_level in ('catalog', 'label', 'estimated', 'historical')
  )
);

create or replace function public.trg_foods_normalize_name()
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
  new.serving_unit := nullif(pg_catalog.btrim(new.serving_unit), '');
  return new;
end;
$$;

create trigger tr_foods_normalize_name
before insert or update of name, serving_unit on public.foods
for each row
execute function public.trg_foods_normalize_name();

create unique index foods_user_active_name_unique
on public.foods (user_id, name)
where is_active;

create index idx_foods_user_active_name
on public.foods (user_id, is_active, name);

-- ==========================================================
-- Extensión aditiva de comidas
-- ==========================================================

alter table public.meal_entries
  add column final_carbs_g numeric(8,2),
  add column final_fat_g numeric(8,2),
  add column entry_kind text not null default 'meal',
  add column precision_level text,
  add column context_type text,
  add column source_note text,
  add column raw_input text,
  add column legacy_import_source text,
  add column legacy_import_id text,
  add column idempotency_key text,
  add column import_run_id uuid;

alter table public.meal_entries
  drop constraint if exists meal_entries_source_type_check;

alter table public.meal_entries
  add constraint meal_entries_source_type_check check (
    source_type is null
    or source_type in ('manual', 'label', 'ai', 'chatgpt', 'sheet_import')
  ),
  add constraint meal_entries_final_carbs_non_negative
    check (final_carbs_g is null or final_carbs_g >= 0),
  add constraint meal_entries_final_fat_non_negative
    check (final_fat_g is null or final_fat_g >= 0),
  add constraint meal_entries_entry_kind_check
    check (entry_kind in ('meal', 'legacy_daily_summary')),
  add constraint meal_entries_precision_level_check check (
    precision_level is null
    or precision_level in ('catalog', 'label', 'estimated', 'historical')
  ),
  add constraint meal_entries_context_type_not_blank
    check (context_type is null or nullif(btrim(context_type), '') is not null),
  add constraint meal_entries_legacy_pair_check check (
    (legacy_import_source is null and legacy_import_id is null)
    or (
      nullif(btrim(legacy_import_source), '') is not null
      and nullif(btrim(legacy_import_id), '') is not null
    )
  ),
  add constraint meal_entries_idempotency_key_not_blank check (
    idempotency_key is null or nullif(btrim(idempotency_key), '') is not null
  ),
  add constraint meal_entries_legacy_source_type_check check (
    legacy_import_source is null or source_type = 'sheet_import'
  ),
  add constraint meal_entries_legacy_summary_metadata_check check (
    entry_kind <> 'legacy_daily_summary'
    or (
      source_type = 'sheet_import'
      and legacy_import_source is not null
      and legacy_import_id is not null
      and precision_level = 'historical'
    )
  ),
  add constraint meal_entries_import_run_owner_fk
    foreign key (import_run_id, user_id)
    references public.nutrition_import_runs(id, user_id)
    on delete restrict;

create unique index meal_entries_legacy_import_unique
on public.meal_entries (user_id, legacy_import_source, legacy_import_id)
where legacy_import_source is not null and legacy_import_id is not null;

create unique index meal_entries_idempotency_key_unique
on public.meal_entries (user_id, idempotency_key)
where idempotency_key is not null;

create index idx_meal_entries_active_day_kind
on public.meal_entries (day_log_id, entry_kind)
where deleted_at is null;

create index idx_meal_entries_import_run
on public.meal_entries (import_run_id, user_id)
where import_run_id is not null;

-- Serializa mutaciones por día e impide que un resumen diario heredado activo
-- conviva con comidas detalladas activas. La regla vive en Postgres para cubrir
-- UI, scripts e integraciones futuras por igual.
create or replace function public.meal_entries_enforce_day_composition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_conflict_exists boolean;
begin
  if tg_op = 'UPDATE' and new.day_log_id is distinct from old.day_log_id then
    perform 1
    from public.day_logs
    where id in (old.day_log_id, new.day_log_id)
    order by id
    for update;
  elsif tg_op = 'DELETE' then
    perform 1 from public.day_logs where id = old.day_log_id for update;
    return old;
  else
    perform 1 from public.day_logs where id = new.day_log_id for update;
  end if;

  if new.deleted_at is not null then
    return new;
  end if;

  if new.entry_kind = 'legacy_daily_summary' then
    select exists (
      select 1
      from public.meal_entries
      where day_log_id = new.day_log_id
        and deleted_at is null
        and id is distinct from new.id
    ) into v_conflict_exists;
  else
    select exists (
      select 1
      from public.meal_entries
      where day_log_id = new.day_log_id
        and deleted_at is null
        and entry_kind = 'legacy_daily_summary'
        and id is distinct from new.id
    ) into v_conflict_exists;
  end if;

  if v_conflict_exists then
    raise exception using
      errcode = '23514',
      message = 'legacy_daily_summary no puede coexistir con comidas detalladas activas';
  end if;

  return new;
end;
$$;

create trigger tr_meal_entries_day_composition
before insert or update or delete on public.meal_entries
for each row
execute function public.meal_entries_enforce_day_composition();

-- ==========================================================
-- Extensión aditiva del agregado diario
-- ==========================================================

alter table public.day_logs
  add column work_override boolean,
  add column work_override_source text,
  add column work_override_reason text,
  add column gym_override boolean,
  add column gym_override_source text,
  add column gym_override_reason text,
  add column steps integer,
  add column water_l numeric(6,2),
  add column mate_l numeric(6,2),
  add column expenditure_override_kcal integer,
  add column work_effective_snapshot boolean,
  add column gym_effective_snapshot boolean,
  add column work_source_snapshot text,
  add column gym_source_snapshot text,
  add column nutrition_goal_period_id uuid,
  add column expenditure_rule_period_id uuid,
  add column work_schedule_period_id uuid,
  add column nutrition_target_kcal_snapshot integer,
  add column protein_target_g_snapshot numeric(8,2),
  add column water_target_l_snapshot numeric(5,2),
  add column estimated_expenditure_kcal_snapshot integer,
  add column total_carbs_g numeric(10,2) not null default 0,
  add column total_fat_g numeric(10,2) not null default 0,
  add column delta_vs_nutrition_target integer,
  add column energy_balance_kcal integer,
  add column nutrition_resolved_at timestamptz;

alter table public.day_logs
  add constraint day_logs_work_override_metadata_check check (
    (work_override is null and work_override_source is null and work_override_reason is null)
    or (
      work_override is not null
      and nullif(btrim(work_override_source), '') is not null
      and nullif(btrim(work_override_reason), '') is not null
    )
  ),
  add constraint day_logs_gym_override_value_check
    check (gym_override is null or gym_override),
  add constraint day_logs_gym_override_metadata_check check (
    (gym_override is null and gym_override_source is null and gym_override_reason is null)
    or (
      gym_override
      and nullif(btrim(gym_override_source), '') is not null
      and nullif(btrim(gym_override_reason), '') is not null
    )
  ),
  add constraint day_logs_steps_in_range
    check (steps is null or steps between 0 and 200000),
  add constraint day_logs_water_in_range
    check (water_l is null or water_l between 0 and 50),
  add constraint day_logs_mate_in_range
    check (mate_l is null or mate_l between 0 and 50),
  add constraint day_logs_expenditure_override_in_range check (
    expenditure_override_kcal is null
    or expenditure_override_kcal between 1 and 50000
  ),
  add constraint day_logs_work_snapshot_metadata_check check (
    (work_effective_snapshot is null and work_source_snapshot is null)
    or (
      work_effective_snapshot is not null
      and nullif(btrim(work_source_snapshot), '') is not null
    )
  ),
  add constraint day_logs_gym_snapshot_metadata_check check (
    (gym_effective_snapshot is null and gym_source_snapshot is null)
    or (
      gym_effective_snapshot is not null
      and nullif(btrim(gym_source_snapshot), '') is not null
    )
  ),
  add constraint day_logs_nutrition_target_in_range check (
    nutrition_target_kcal_snapshot is null
    or nutrition_target_kcal_snapshot between 1 and 20000
  ),
  add constraint day_logs_protein_target_in_range check (
    protein_target_g_snapshot is null
    or protein_target_g_snapshot between 0 and 2000
  ),
  add constraint day_logs_water_target_in_range check (
    water_target_l_snapshot is null
    or water_target_l_snapshot between 0 and 50
  ),
  add constraint day_logs_estimated_expenditure_in_range check (
    estimated_expenditure_kcal_snapshot is null
    or estimated_expenditure_kcal_snapshot between 1 and 50000
  ),
  add constraint day_logs_total_carbs_non_negative check (total_carbs_g >= 0),
  add constraint day_logs_total_fat_non_negative check (total_fat_g >= 0),
  add constraint day_logs_nutrition_goal_period_owner_fk
    foreign key (nutrition_goal_period_id, user_id)
    references public.nutrition_goal_periods(id, user_id)
    on delete restrict,
  add constraint day_logs_expenditure_rule_period_owner_fk
    foreign key (expenditure_rule_period_id, user_id)
    references public.expenditure_rule_periods(id, user_id)
    on delete restrict,
  add constraint day_logs_work_schedule_period_owner_fk
    foreign key (work_schedule_period_id, user_id)
    references public.work_schedule_periods(id, user_id)
    on delete restrict;

create index idx_day_logs_nutrition_goal_period
on public.day_logs (nutrition_goal_period_id)
where nutrition_goal_period_id is not null;

create index idx_day_logs_expenditure_rule_period
on public.day_logs (expenditure_rule_period_id)
where expenditure_rule_period_id is not null;

create index idx_day_logs_work_schedule_period
on public.day_logs (work_schedule_period_id)
where work_schedule_period_id is not null;

-- ==========================================================
-- Agregación endurecida y segura frente a concurrencia
-- ==========================================================

create or replace function public.meal_entries_enforce_owner()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner
  from public.day_logs
  where id = new.day_log_id;

  if v_owner is null then
    raise exception using errcode = '23503', message = 'day_log_id inválido';
  end if;
  if new.user_id is distinct from v_owner then
    raise exception using
      errcode = '23514',
      message = 'meal_entries.user_id debe coincidir con day_logs.user_id';
  end if;
  return new;
end;
$$;

create or replace function public.recalculate_day_log(p_day_log_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_total_kcal integer;
  v_total_protein numeric(8,2);
  v_total_carbs numeric(10,2);
  v_total_fat numeric(10,2);
  v_legacy_target integer;
  v_legacy_maintenance integer;
  v_nutrition_target integer;
  v_estimated_expenditure integer;
begin
  -- El lock del agregado serializa todas las mutaciones del mismo día. El
  -- trigger de composición toma el mismo lock antes de cada escritura.
  perform 1
  from public.day_logs
  where id = p_day_log_id
  for update;

  if not found then
    return;
  end if;

  select
    coalesce(pg_catalog.sum(final_calories), 0::bigint)::integer,
    coalesce(pg_catalog.sum(final_protein_g), 0::numeric)::numeric(8,2),
    coalesce(pg_catalog.sum(final_carbs_g), 0::numeric)::numeric(10,2),
    coalesce(pg_catalog.sum(final_fat_g), 0::numeric)::numeric(10,2)
  into v_total_kcal, v_total_protein, v_total_carbs, v_total_fat
  from public.meal_entries
  where day_log_id = p_day_log_id
    and deleted_at is null;

  select
    target_kcal_snapshot,
    maintenance_kcal_snapshot,
    nutrition_target_kcal_snapshot,
    estimated_expenditure_kcal_snapshot
  into
    v_legacy_target,
    v_legacy_maintenance,
    v_nutrition_target,
    v_estimated_expenditure
  from public.day_logs
  where id = p_day_log_id;

  update public.day_logs
  set
    total_calories_consumed = v_total_kcal,
    total_protein_g = v_total_protein,
    total_carbs_g = v_total_carbs,
    total_fat_g = v_total_fat,
    delta_vs_target = case
      when v_legacy_target is null then null
      else v_total_kcal - v_legacy_target
    end,
    delta_vs_maintenance = case
      when v_legacy_maintenance is null then null
      else v_total_kcal - v_legacy_maintenance
    end,
    delta_vs_nutrition_target = case
      when v_nutrition_target is null then null
      else v_total_kcal - v_nutrition_target
    end,
    energy_balance_kcal = case
      when v_estimated_expenditure is null then null
      else v_total_kcal - v_estimated_expenditure
    end,
    updated_at = pg_catalog.now()
  where id = p_day_log_id;
end;
$$;

create or replace function public.trg_meal_entries_recalculate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_day_log(new.day_log_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.day_log_id is distinct from old.day_log_id then
      perform public.recalculate_day_log(old.day_log_id);
      perform public.recalculate_day_log(new.day_log_id);
    else
      perform public.recalculate_day_log(new.day_log_id);
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    perform public.recalculate_day_log(old.day_log_id);
    return old;
  end if;
  return null;
end;
$$;

revoke all on function public.trg_foods_normalize_name() from public, anon, authenticated;
revoke all on function public.meal_entries_enforce_day_composition() from public, anon, authenticated;
revoke all on function public.meal_entries_enforce_owner() from public, anon, authenticated;
revoke all on function public.recalculate_day_log(uuid) from public, anon, authenticated;
revoke all on function public.trg_meal_entries_recalculate() from public, anon, authenticated;

-- SECURITY INVOKER hace que el trigger llame esta función con el rol que mutó
-- la comida. authenticated necesita EXECUTE; RLS limita el lock y el update a
-- day_logs propios. PUBLIC y anon permanecen revocados.
grant execute on function public.recalculate_day_log(uuid) to authenticated;

-- ==========================================================
-- updated_at, RLS y grants mínimos
-- ==========================================================

-- Un cambio de valores o vigencia representa un período nuevo. Sólo nombre y
-- notas son metadata corregible; así una edición nunca reescribe una regla que
-- pueda haber sido referenciada por un snapshot histórico.
create or replace function public.prevent_versioned_period_rewrite()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_payload jsonb;
  v_new_payload jsonb;
begin
  v_old_payload := pg_catalog.to_jsonb(old) - 'name' - 'notes' - 'updated_at';
  v_new_payload := pg_catalog.to_jsonb(new) - 'name' - 'notes' - 'updated_at';

  if v_new_payload is distinct from v_old_payload then
    raise exception using
      errcode = '23514',
      message = 'los valores versionados no se editan; creá un período nuevo';
  end if;
  return new;
end;
$$;

revoke all on function public.prevent_versioned_period_rewrite()
from public, anon, authenticated;

create trigger tr_nutrition_goal_periods_immutable_values
before update on public.nutrition_goal_periods
for each row execute function public.prevent_versioned_period_rewrite();

create trigger tr_expenditure_rule_periods_immutable_values
before update on public.expenditure_rule_periods
for each row execute function public.prevent_versioned_period_rewrite();

create trigger tr_work_schedule_periods_immutable_values
before update on public.work_schedule_periods
for each row execute function public.prevent_versioned_period_rewrite();

create trigger tr_nutrition_goal_periods_updated_at
before update on public.nutrition_goal_periods
for each row execute function public.set_updated_at();

create trigger tr_expenditure_rule_periods_updated_at
before update on public.expenditure_rule_periods
for each row execute function public.set_updated_at();

create trigger tr_work_schedule_periods_updated_at
before update on public.work_schedule_periods
for each row execute function public.set_updated_at();

create trigger tr_foods_updated_at
before update on public.foods
for each row execute function public.set_updated_at();

alter table public.nutrition_goal_periods enable row level security;
alter table public.expenditure_rule_periods enable row level security;
alter table public.work_schedule_periods enable row level security;
alter table public.nutrition_import_runs enable row level security;
alter table public.foods enable row level security;

create policy nutrition_goal_periods_select_own
on public.nutrition_goal_periods for select to authenticated
using ((select auth.uid()) = user_id);
create policy nutrition_goal_periods_insert_own
on public.nutrition_goal_periods for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy nutrition_goal_periods_update_own
on public.nutrition_goal_periods for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy nutrition_goal_periods_delete_own
on public.nutrition_goal_periods for delete to authenticated
using ((select auth.uid()) = user_id);

create policy expenditure_rule_periods_select_own
on public.expenditure_rule_periods for select to authenticated
using ((select auth.uid()) = user_id);
create policy expenditure_rule_periods_insert_own
on public.expenditure_rule_periods for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy expenditure_rule_periods_update_own
on public.expenditure_rule_periods for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy expenditure_rule_periods_delete_own
on public.expenditure_rule_periods for delete to authenticated
using ((select auth.uid()) = user_id);

create policy work_schedule_periods_select_own
on public.work_schedule_periods for select to authenticated
using ((select auth.uid()) = user_id);
create policy work_schedule_periods_insert_own
on public.work_schedule_periods for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy work_schedule_periods_update_own
on public.work_schedule_periods for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy work_schedule_periods_delete_own
on public.work_schedule_periods for delete to authenticated
using ((select auth.uid()) = user_id);

create policy nutrition_import_runs_select_own
on public.nutrition_import_runs for select to authenticated
using ((select auth.uid()) = user_id);
create policy nutrition_import_runs_insert_own
on public.nutrition_import_runs for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy foods_select_own
on public.foods for select to authenticated
using ((select auth.uid()) = user_id);
create policy foods_insert_own
on public.foods for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy foods_update_own
on public.foods for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy foods_delete_own
on public.foods for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table
  public.nutrition_goal_periods,
  public.expenditure_rule_periods,
  public.work_schedule_periods,
  public.nutrition_import_runs,
  public.foods
from public, anon, authenticated;

grant select, insert, update, delete on table
  public.nutrition_goal_periods,
  public.expenditure_rule_periods,
  public.work_schedule_periods,
  public.foods
to authenticated;

grant select, insert on table public.nutrition_import_runs to authenticated;

commit;
