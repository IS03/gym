begin;

create table public.user_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  system_key text,
  name text not null,
  unit text,
  value_type text not null,
  target_value numeric(14,4),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_metrics_id_owner_unique unique (id, user_id),
  constraint user_metrics_system_key_check check (system_key is null or system_key in ('steps', 'water', 'mate', 'sleep')),
  constraint user_metrics_system_identity_check check (
    system_key is null
    or (system_key = 'steps' and name = 'Pasos' and unit = 'pasos' and value_type = 'integer')
    or (system_key = 'water' and name = 'Agua' and unit = 'L' and value_type = 'decimal')
    or (system_key = 'mate' and name = 'Mate' and unit = 'L' and value_type = 'decimal')
    or (system_key = 'sleep' and name = 'Sueño' and unit = 'min' and value_type = 'duration')
  ),
  constraint user_metrics_name_check check (char_length(btrim(name)) between 1 and 80),
  constraint user_metrics_unit_check check (unit is null or char_length(btrim(unit)) between 1 and 16),
  constraint user_metrics_value_type_check check (value_type in ('integer', 'decimal', 'duration')),
  constraint user_metrics_target_check check (target_value is null or target_value >= 0),
  constraint user_metrics_target_type_check check (
    target_value is null or value_type = 'decimal' or target_value = trunc(target_value)
  ),
  constraint user_metrics_sort_order_check check (sort_order >= 0),
  constraint user_metrics_archive_state_check check (
    (is_active and archived_at is null) or (not is_active and archived_at is not null)
  )
);

create unique index user_metrics_one_system_key_per_user
on public.user_metrics(user_id, system_key)
where system_key is not null;

create index user_metrics_active_order_idx
on public.user_metrics(user_id, is_active, sort_order, created_at);

create table public.daily_metric_values (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_id uuid not null,
  metric_date date not null,
  value numeric(14,4) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_metric_values_metric_owner_fk
    foreign key (metric_id, user_id)
    references public.user_metrics(id, user_id)
    on delete restrict,
  constraint daily_metric_values_nonnegative_check check (value >= 0),
  constraint daily_metric_values_one_per_day unique (user_id, metric_date, metric_id)
);

create index daily_metric_values_metric_date_idx
on public.daily_metric_values(user_id, metric_id, metric_date desc);

create trigger tr_user_metrics_updated_at
before update on public.user_metrics
for each row execute function public.set_updated_at();

create trigger tr_daily_metric_values_updated_at
before update on public.daily_metric_values
for each row execute function public.set_updated_at();

create function public.guard_user_metric_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.system_key is not null then raise exception 'system_metric_cannot_be_deleted'; end if;
    return old;
  end if;

  if new.user_id <> old.user_id or new.system_key is distinct from old.system_key then
    raise exception 'metric_identity_is_immutable';
  end if;

  if old.system_key is not null and (
    new.name is distinct from old.name
    or new.unit is distinct from old.unit
    or new.value_type is distinct from old.value_type
  ) then
    raise exception 'system_metric_identity_is_immutable';
  end if;

  if (new.unit is distinct from old.unit or new.value_type is distinct from old.value_type)
    and exists (
      select 1 from public.daily_metric_values v where v.metric_id = old.id limit 1
    ) then
    raise exception 'metric_with_history_cannot_change_meaning';
  end if;

  return new;
end;
$$;

create trigger tr_user_metrics_guard_identity
before update or delete on public.user_metrics
for each row execute function public.guard_user_metric_identity();

create function public.validate_daily_metric_value()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_type text;
begin
  if tg_op = 'UPDATE' and (
    new.user_id <> old.user_id
    or new.metric_id <> old.metric_id
    or new.metric_date <> old.metric_date
  ) then
    raise exception 'daily_metric_identity_is_immutable';
  end if;

  select m.value_type into v_type
  from public.user_metrics m
  where m.id = new.metric_id and m.user_id = new.user_id;

  if v_type is null then raise exception 'metric_not_found'; end if;
  if v_type in ('integer', 'duration') and new.value <> trunc(new.value) then
    raise exception 'metric_value_must_be_integer';
  end if;
  return new;
end;
$$;

create trigger tr_daily_metric_values_validate
before insert or update on public.daily_metric_values
for each row execute function public.validate_daily_metric_value();

create function public.project_system_metric_to_day_log()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_key text;
  v_user_id uuid;
  v_date date;
  v_value numeric;
begin
  v_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  v_date := case when tg_op = 'DELETE' then old.metric_date else new.metric_date end;
  v_value := case when tg_op = 'DELETE' then null else new.value end;

  select m.system_key into v_key
  from public.user_metrics m
  where m.id = case when tg_op = 'DELETE' then old.metric_id else new.metric_id end
    and m.user_id = v_user_id;

  if v_key = 'steps' then
    update public.day_logs set steps = v_value::integer
    where user_id = v_user_id and log_date = v_date;
  elsif v_key = 'water' then
    update public.day_logs set water_l = v_value
    where user_id = v_user_id and log_date = v_date;
  elsif v_key = 'mate' then
    update public.day_logs set mate_l = v_value
    where user_id = v_user_id and log_date = v_date;
  end if;
  return null;
end;
$$;

create trigger tr_daily_metric_values_project_legacy
after insert or update or delete on public.daily_metric_values
for each row execute function public.project_system_metric_to_day_log();

alter table public.user_metrics enable row level security;
alter table public.daily_metric_values enable row level security;

create policy user_metrics_select_own on public.user_metrics
for select to authenticated using ((select auth.uid()) = user_id);
create policy user_metrics_insert_own on public.user_metrics
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy user_metrics_update_own on public.user_metrics
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy user_metrics_delete_own on public.user_metrics
for delete to authenticated using ((select auth.uid()) = user_id);

create policy daily_metric_values_select_own on public.daily_metric_values
for select to authenticated using ((select auth.uid()) = user_id);
create policy daily_metric_values_insert_own on public.daily_metric_values
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy daily_metric_values_update_own on public.daily_metric_values
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
create policy daily_metric_values_delete_own on public.daily_metric_values
for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on table public.user_metrics, public.daily_metric_values from public, anon, authenticated;
grant select, insert, update, delete on table public.user_metrics, public.daily_metric_values to authenticated;

create function public.ensure_user_metrics()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  insert into public.user_metrics (
    user_id, system_key, name, unit, value_type, target_value, sort_order, is_active
  ) values
    (v_user_id, 'steps', 'Pasos', 'pasos', 'integer', 10000, 0, true),
    (v_user_id, 'water', 'Agua', 'L', 'decimal', 2.5, 1, true),
    (v_user_id, 'mate', 'Mate', 'L', 'decimal', null, 2, true),
    (v_user_id, 'sleep', 'Sueño', 'min', 'duration', 480, 3, true)
  on conflict (user_id, system_key) where system_key is not null do nothing;
end;
$$;

create function public.save_daily_activity_metrics(
  p_day_log_id uuid,
  p_steps numeric,
  p_water_l numeric,
  p_mate_l numeric
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date;
  v_metric record;
  v_value numeric;
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  select d.log_date into v_date
  from public.day_logs d
  where d.id = p_day_log_id and d.user_id = v_user_id
  for update;
  if v_date is null then raise exception 'day_log_not_found'; end if;

  perform public.ensure_user_metrics();

  for v_metric in
    select m.id, m.system_key from public.user_metrics m
    where m.user_id = v_user_id and m.system_key in ('steps', 'water', 'mate')
  loop
    v_value := case v_metric.system_key
      when 'steps' then p_steps
      when 'water' then p_water_l
      when 'mate' then p_mate_l
    end;
    if v_value is null then
      delete from public.daily_metric_values
      where user_id = v_user_id and metric_id = v_metric.id and metric_date = v_date;
    else
      insert into public.daily_metric_values (user_id, metric_id, metric_date, value)
      values (v_user_id, v_metric.id, v_date, v_value)
      on conflict (user_id, metric_date, metric_id) do update set value = excluded.value;
    end if;
  end loop;
end;
$$;

create function public.reorder_user_metrics(p_metric_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'not_authenticated'; end if;
  if coalesce(array_length(p_metric_ids, 1), 0) <> (
    select count(*) from public.user_metrics where user_id = v_user_id and is_active
  ) or exists (
    select 1 from unnest(p_metric_ids) as supplied(metric_id)
    left join public.user_metrics m on m.id = supplied.metric_id and m.user_id = v_user_id and m.is_active
    where m.id is null
  ) or (
    select count(distinct supplied.metric_id)
    from unnest(p_metric_ids) as supplied(metric_id)
  ) <> coalesce(array_length(p_metric_ids, 1), 0) then
    raise exception 'invalid_metric_order';
  end if;

  update public.user_metrics m
  set sort_order = ordered.position - 1
  from unnest(p_metric_ids) with ordinality as ordered(id, position)
  where m.id = ordered.id and m.user_id = v_user_id;
end;
$$;

revoke all on function public.ensure_user_metrics() from public, anon;
revoke all on function public.save_daily_activity_metrics(uuid, numeric, numeric, numeric) from public, anon;
revoke all on function public.reorder_user_metrics(uuid[]) from public, anon;
grant execute on function public.ensure_user_metrics() to authenticated;
grant execute on function public.save_daily_activity_metrics(uuid, numeric, numeric, numeric) to authenticated;
grant execute on function public.reorder_user_metrics(uuid[]) to authenticated;

insert into public.user_metrics (
  user_id, system_key, name, unit, value_type, target_value, sort_order, is_active
)
select u.id, defaults.system_key, defaults.name, defaults.unit, defaults.value_type,
  defaults.target_value, defaults.sort_order, true
from auth.users u
cross join (values
  ('steps'::text, 'Pasos'::text, 'pasos'::text, 'integer'::text, 10000::numeric, 0),
  ('water', 'Agua', 'L', 'decimal', 2.5::numeric, 1),
  ('mate', 'Mate', 'L', 'decimal', null::numeric, 2),
  ('sleep', 'Sueño', 'min', 'duration', 480::numeric, 3)
) as defaults(system_key, name, unit, value_type, target_value, sort_order)
on conflict (user_id, system_key) where system_key is not null do nothing;

insert into public.daily_metric_values (user_id, metric_id, metric_date, value)
select d.user_id, m.id, d.log_date, source.value
from public.day_logs d
cross join lateral (values
  ('steps'::text, d.steps::numeric),
  ('water'::text, d.water_l::numeric),
  ('mate'::text, d.mate_l::numeric)
) source(system_key, value)
join public.user_metrics m on m.user_id = d.user_id and m.system_key = source.system_key
where source.value is not null
on conflict (user_id, metric_date, metric_id) do nothing;

comment on table public.user_metrics is
  'Definiciones configurables. Las system_key preservan identidad; las columnas de day_logs quedan como proyección legacy temporal.';
comment on table public.daily_metric_values is
  'Fuente canónica de valores diarios configurables; null se representa por ausencia de fila y 0 es un valor real.';

commit;
