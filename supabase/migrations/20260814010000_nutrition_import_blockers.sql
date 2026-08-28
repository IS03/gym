-- Issue #29, PR 5B: cerrar gaps estructurales detectados por el dry-run.
-- Sólo modifica schema; no carga configuración ni hechos históricos.
begin;

-- Un alimento puede tener nutrición parcial. NULL conserva "desconocido" y
-- cero conserva "conocido y realmente cero".
alter table public.foods
  alter column calories drop not null,
  alter column protein_g drop not null,
  alter column carbs_g drop not null,
  alter column fat_g drop not null;

alter table public.foods
  drop constraint if exists foods_nutrition_non_negative,
  add constraint foods_nutrition_non_negative check (
    (calories is null or calories >= 0)
    and (protein_g is null or protein_g >= 0)
    and (carbs_g is null or carbs_g >= 0)
    and (fat_g is null or fat_g >= 0)
  ),
  add constraint foods_nutrition_at_least_one_known check (
    calories is not null
    or protein_g is not null
    or carbs_g is not null
    or fat_g is not null
  );

-- body_measurements sigue siendo la única tabla corporal. Las columnas
-- laterales no alimentan arm_cm/thigh_cm: se preservan sin derivaciones.
alter table public.body_measurements
  add column abdomen_cm numeric(5,2),
  add column arm_right_cm numeric(5,2),
  add column arm_left_cm numeric(5,2),
  add column thigh_right_cm numeric(5,2),
  add column thigh_left_cm numeric(5,2),
  add column calf_right_cm numeric(5,2),
  add column calf_left_cm numeric(5,2),
  add column condition text,
  add column notes text,
  add column legacy_import_source text,
  add column legacy_import_id text,
  add column import_run_id uuid,
  add column quality_status text not null default 'verified',
  add column quality_note text,
  add column source_payload jsonb;

alter table public.body_measurements
  drop constraint if exists body_measurements_one_or_more_values,
  drop constraint if exists body_measurements_values_in_range,
  add constraint body_measurements_one_or_more_values check (
    waist_cm is not null
    or abdomen_cm is not null
    or chest_cm is not null
    or arm_cm is not null
    or arm_right_cm is not null
    or arm_left_cm is not null
    or thigh_cm is not null
    or thigh_right_cm is not null
    or thigh_left_cm is not null
    or calf_right_cm is not null
    or calf_left_cm is not null
    or hip_cm is not null
  ),
  add constraint body_measurements_values_in_range check (
    (waist_cm is null or (waist_cm > 0 and waist_cm <= 500))
    and (abdomen_cm is null or (abdomen_cm > 0 and abdomen_cm <= 500))
    and (chest_cm is null or (chest_cm > 0 and chest_cm <= 500))
    and (arm_cm is null or (arm_cm > 0 and arm_cm <= 500))
    and (arm_right_cm is null or (arm_right_cm > 0 and arm_right_cm <= 500))
    and (arm_left_cm is null or (arm_left_cm > 0 and arm_left_cm <= 500))
    and (thigh_cm is null or (thigh_cm > 0 and thigh_cm <= 500))
    and (thigh_right_cm is null or (thigh_right_cm > 0 and thigh_right_cm <= 500))
    and (thigh_left_cm is null or (thigh_left_cm > 0 and thigh_left_cm <= 500))
    and (calf_right_cm is null or (calf_right_cm > 0 and calf_right_cm <= 500))
    and (calf_left_cm is null or (calf_left_cm > 0 and calf_left_cm <= 500))
    and (hip_cm is null or (hip_cm > 0 and hip_cm <= 500))
  ),
  add constraint body_measurements_legacy_pair_check check (
    (legacy_import_source is null and legacy_import_id is null)
    or (
      nullif(btrim(legacy_import_source), '') is not null
      and nullif(btrim(legacy_import_id), '') is not null
    )
  ),
  add constraint body_measurements_quality_status_check check (
    quality_status in ('verified', 'suspect')
  ),
  add constraint body_measurements_suspect_note_check check (
    quality_status <> 'suspect'
    or nullif(btrim(quality_note), '') is not null
  ),
  add constraint body_measurements_source_payload_object check (
    source_payload is null or jsonb_typeof(source_payload) = 'object'
  ),
  add constraint body_measurements_import_run_owner_fk
    foreign key (import_run_id, user_id)
    references public.nutrition_import_runs(id, user_id)
    on delete restrict;

create unique index body_measurements_legacy_import_unique
on public.body_measurements (user_id, legacy_import_source, legacy_import_id)
where legacy_import_source is not null and legacy_import_id is not null;

create index idx_body_measurements_import_run
on public.body_measurements (import_run_id, user_id)
where import_run_id is not null;

-- Permitidos es contexto estructurado. No participa de los agregados de
-- meal_entries/day_logs y no duplica las calorías consumidas.
create table public.nutrition_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_date date not null,
  event_type text not null,
  intensity text,
  planned boolean,
  alcohol boolean,
  drinks_equivalent numeric(8,2),
  event_calories integer,
  context text,
  notes text,
  origin text,
  source_type text not null,
  legacy_import_source text,
  legacy_import_id text,
  import_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint nutrition_events_id_user_unique unique (id, user_id),
  constraint nutrition_events_type_not_blank
    check (nullif(btrim(event_type), '') is not null),
  constraint nutrition_events_optional_text_not_blank check (
    (intensity is null or nullif(btrim(intensity), '') is not null)
    and (context is null or nullif(btrim(context), '') is not null)
    and (notes is null or nullif(btrim(notes), '') is not null)
    and (origin is null or nullif(btrim(origin), '') is not null)
  ),
  constraint nutrition_events_numbers_non_negative check (
    (drinks_equivalent is null or drinks_equivalent >= 0)
    and (event_calories is null or event_calories >= 0)
  ),
  constraint nutrition_events_source_type_check check (
    source_type in ('manual', 'sheet_import', 'chatgpt')
  ),
  constraint nutrition_events_legacy_pair_check check (
    (legacy_import_source is null and legacy_import_id is null)
    or (
      nullif(btrim(legacy_import_source), '') is not null
      and nullif(btrim(legacy_import_id), '') is not null
    )
  ),
  constraint nutrition_events_legacy_source_type_check check (
    legacy_import_source is null or source_type = 'sheet_import'
  ),
  constraint nutrition_events_import_run_owner_fk
    foreign key (import_run_id, user_id)
    references public.nutrition_import_runs(id, user_id)
    on delete restrict
);

create unique index nutrition_events_legacy_import_unique
on public.nutrition_events (user_id, legacy_import_source, legacy_import_id)
where legacy_import_source is not null and legacy_import_id is not null;

create index idx_nutrition_events_user_date
on public.nutrition_events (user_id, event_date desc);

create index idx_nutrition_events_import_run
on public.nutrition_events (import_run_id, user_id)
where import_run_id is not null;

create trigger tr_nutrition_events_updated_at
before update on public.nutrition_events
for each row execute function public.set_updated_at();

alter table public.nutrition_events enable row level security;

create policy nutrition_events_select_own
on public.nutrition_events for select to authenticated
using ((select auth.uid()) = user_id);

create policy nutrition_events_insert_own
on public.nutrition_events for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy nutrition_events_update_own
on public.nutrition_events for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy nutrition_events_delete_own
on public.nutrition_events for delete to authenticated
using ((select auth.uid()) = user_id);

revoke all on table public.nutrition_events from public, anon, authenticated;
grant select, insert, update, delete on table public.nutrition_events to authenticated;

commit;
