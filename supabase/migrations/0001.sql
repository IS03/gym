-- Fase 1: profiles, day_logs, meal_entries + recálculo automático.
-- Stack: Supabase Postgres (RLS + RPC).

begin;

-- Requerido para gen_random_uuid()
create extension if not exists pgcrypto;

-- ==========================================================
-- Types
-- ==========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'meal_entry_status') then
    create type public.meal_entry_status as enum ('draft', 'needs_review', 'confirmed');
  end if;
end $$;

-- ==========================================================
-- Tables
-- ==========================================================

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  birth_date date,
  sex text check (sex in ('male', 'female', 'other')),
  height_cm integer check (height_cm is null or (height_cm >= 50 and height_cm <= 250)),
  activity_level text,
  goal_type text,
  bmr_kcal_current integer check (bmr_kcal_current is null or bmr_kcal_current >= 0),
  maintenance_kcal_current integer check (maintenance_kcal_current is null or maintenance_kcal_current >= 0),
  target_kcal_current integer check (target_kcal_current is null or target_kcal_current >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.day_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,

  -- Campos del día (histórico)
  weight_kg numeric(6,2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 999.99)),
  notes text,

  -- Snapshots del día (copiados desde profile al crear el día)
  bmr_kcal_snapshot integer check (bmr_kcal_snapshot is null or bmr_kcal_snapshot >= 0),
  maintenance_kcal_snapshot integer check (maintenance_kcal_snapshot is null or maintenance_kcal_snapshot >= 0),
  target_kcal_snapshot integer check (target_kcal_snapshot is null or target_kcal_snapshot >= 0),
  goal_type_snapshot text,

  -- Agregados persistidos del día (recalculados desde comidas confirmadas)
  total_calories_consumed integer not null default 0 check (total_calories_consumed >= 0),
  total_protein_g numeric(8,2) not null default 0 check (total_protein_g >= 0),

  -- Deltas persistidos (derivados del snapshot)
  delta_vs_target integer,
  delta_vs_maintenance integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint day_logs_one_per_user_per_date unique (user_id, log_date)
);

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  day_log_id uuid not null references public.day_logs(id) on delete cascade,
  consumed_at timestamptz not null default now(),

  meal_label text check (meal_label is null or meal_label in ('breakfast', 'lunch', 'snack', 'dinner', 'extra')),
  title text,
  description text,

  final_calories integer check (final_calories is null or final_calories >= 0),
  final_protein_g numeric(8,2) check (final_protein_g is null or final_protein_g >= 0),
  source_type text check (source_type is null or source_type in ('manual', 'label', 'ai')),

  status public.meal_entry_status not null default 'draft',
  deleted_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ==========================================================
-- Updated_at trigger helper
-- ==========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tr_profiles_updated_at on public.profiles;
create trigger tr_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists tr_day_logs_updated_at on public.day_logs;
create trigger tr_day_logs_updated_at
before update on public.day_logs
for each row
execute function public.set_updated_at();

drop trigger if exists tr_meal_entries_updated_at on public.meal_entries;
create trigger tr_meal_entries_updated_at
before update on public.meal_entries
for each row
execute function public.set_updated_at();

-- ==========================================================
-- Constraints / indexes
-- ==========================================================

create index if not exists idx_day_logs_user_date on public.day_logs(user_id, log_date desc);
create index if not exists idx_meal_entries_day_log_consumed_at on public.meal_entries(day_log_id, consumed_at desc);
create index if not exists idx_meal_entries_user_day_log on public.meal_entries(user_id, day_log_id);
create index if not exists idx_meal_entries_active_confirmed on public.meal_entries(day_log_id)
where deleted_at is null and status = 'confirmed';

-- Asegura que meal_entries.user_id coincida con day_logs.user_id.
create or replace function public.meal_entries_enforce_owner()
returns trigger
language plpgsql
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.day_logs where id = new.day_log_id;
  if v_owner is null then
    raise exception 'day_log_id inválido';
  end if;
  if new.user_id <> v_owner then
    raise exception 'meal_entries.user_id debe coincidir con day_logs.user_id';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_meal_entries_owner on public.meal_entries;
create trigger tr_meal_entries_owner
before insert or update of user_id, day_log_id on public.meal_entries
for each row
execute function public.meal_entries_enforce_owner();

-- ==========================================================
-- Recalculo automático del day_log
-- Regla: solo comidas activas (deleted_at is null) y status = confirmed
-- ==========================================================

create or replace function public.recalculate_day_log(p_day_log_id uuid)
returns void
language plpgsql
as $$
declare
  v_total_kcal integer;
  v_total_protein numeric(8,2);
  v_target integer;
  v_maint integer;
begin
  select
    coalesce(sum(final_calories), 0)::integer,
    coalesce(sum(final_protein_g), 0)::numeric(8,2)
  into v_total_kcal, v_total_protein
  from public.meal_entries
  where day_log_id = p_day_log_id
    and deleted_at is null
    and status = 'confirmed';

  select target_kcal_snapshot, maintenance_kcal_snapshot
  into v_target, v_maint
  from public.day_logs
  where id = p_day_log_id;

  update public.day_logs
  set
    total_calories_consumed = v_total_kcal,
    total_protein_g = v_total_protein,
    delta_vs_target = case when v_target is null then null else v_total_kcal - v_target end,
    delta_vs_maintenance = case when v_maint is null then null else v_total_kcal - v_maint end,
    updated_at = now()
  where id = p_day_log_id;
end;
$$;

create or replace function public.trg_meal_entries_recalculate()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    perform public.recalculate_day_log(new.day_log_id);
    return new;
  elsif tg_op = 'UPDATE' then
    if new.day_log_id <> old.day_log_id then
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

drop trigger if exists tr_meal_entries_recalculate on public.meal_entries;
create trigger tr_meal_entries_recalculate
after insert or update or delete on public.meal_entries
for each row
execute function public.trg_meal_entries_recalculate();

-- ==========================================================
-- RPC: get_or_create_day_log
-- Regla: un solo day_log por usuario por fecha.
-- Snapshot: copia desde profiles al crear.
-- ==========================================================

create or replace function public.get_or_create_day_log(p_user_id uuid, p_log_date date)
returns public.day_logs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.day_logs;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if auth.uid() <> p_user_id then
    raise exception 'forbidden';
  end if;

  select * into v_row
  from public.day_logs
  where user_id = p_user_id and log_date = p_log_date;

  if found then
    return v_row;
  end if;

  select * into v_profile
  from public.profiles
  where user_id = p_user_id;

  insert into public.day_logs (
    user_id,
    log_date,
    bmr_kcal_snapshot,
    maintenance_kcal_snapshot,
    target_kcal_snapshot,
    goal_type_snapshot
  )
  values (
    p_user_id,
    p_log_date,
    v_profile.bmr_kcal_current,
    v_profile.maintenance_kcal_current,
    v_profile.target_kcal_current,
    v_profile.goal_type
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.get_or_create_day_log(uuid, date) from public;
grant execute on function public.get_or_create_day_log(uuid, date) to authenticated;

-- ==========================================================
-- RLS
-- ==========================================================

alter table public.profiles enable row level security;
alter table public.day_logs enable row level security;
alter table public.meal_entries enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists day_logs_select_own on public.day_logs;
create policy day_logs_select_own
on public.day_logs
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists day_logs_insert_own on public.day_logs;
create policy day_logs_insert_own
on public.day_logs
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists day_logs_update_own on public.day_logs;
create policy day_logs_update_own
on public.day_logs
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists meal_entries_select_own on public.meal_entries;
create policy meal_entries_select_own
on public.meal_entries
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists meal_entries_insert_own on public.meal_entries;
create policy meal_entries_insert_own
on public.meal_entries
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists meal_entries_update_own on public.meal_entries;
create policy meal_entries_update_own
on public.meal_entries
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- No queremos hard delete desde app en Fase 1.
revoke delete on public.meal_entries from authenticated;

commit;