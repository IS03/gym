-- PR 8: credenciales privadas e ingreso canónico de comidas desde ChatGPT.
-- No contiene tokens ni datos reales.
begin;

create table public.integration_api_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null,
  token_prefix text not null,
  label text not null default 'ChatGPT',
  scope text not null default 'meals:write',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint integration_api_tokens_hash_check
    check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint integration_api_tokens_prefix_check
    check (token_prefix like 'ownlevel\_%' escape '\' and char_length(token_prefix) <= 32),
  constraint integration_api_tokens_label_check
    check (nullif(btrim(label), '') is not null and char_length(label) <= 100),
  constraint integration_api_tokens_scope_check
    check (scope = 'meals:write'),
  constraint integration_api_tokens_dates_check
    check (last_used_at is null or last_used_at >= created_at)
);

create unique index integration_api_tokens_hash_unique
on public.integration_api_tokens (token_hash);

create unique index integration_api_tokens_one_active_scope
on public.integration_api_tokens (user_id, scope)
where revoked_at is null;

create index idx_integration_api_tokens_user_created
on public.integration_api_tokens (user_id, created_at desc);

alter table public.integration_api_tokens enable row level security;

create policy integration_api_tokens_select_own
on public.integration_api_tokens for select to authenticated
using ((select auth.uid()) = user_id);

create policy integration_api_tokens_insert_own
on public.integration_api_tokens for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy integration_api_tokens_revoke_own
on public.integration_api_tokens for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create or replace function public.integration_api_tokens_protect_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.role()) = 'authenticated' then
    if new.id is distinct from old.id
       or new.user_id is distinct from old.user_id
       or new.token_hash is distinct from old.token_hash
       or new.token_prefix is distinct from old.token_prefix
       or new.label is distinct from old.label
       or new.scope is distinct from old.scope
       or new.created_at is distinct from old.created_at
       or new.last_used_at is distinct from old.last_used_at
       or new.revoked_at is null then
      raise exception 'integration_token_update_not_allowed';
    end if;
  end if;
  return new;
end;
$$;

create trigger tr_integration_api_tokens_protect_update
before update on public.integration_api_tokens
for each row execute function public.integration_api_tokens_protect_update();

revoke all on table public.integration_api_tokens from public, anon, authenticated;
grant select (
  id, user_id, token_prefix, label, scope, created_at, last_used_at, revoked_at
) on public.integration_api_tokens to authenticated;
grant insert, update on public.integration_api_tokens to authenticated;
grant select, update on public.integration_api_tokens to service_role;
revoke all on function public.integration_api_tokens_protect_update()
from public, anon, authenticated;

comment on table public.integration_api_tokens is
  'Credenciales hash-only para integraciones externas; el token raw nunca se persiste.';
comment on column public.integration_api_tokens.token_hash is
  'SHA-256 hexadecimal del token raw generado con 256 bits aleatorios.';

create or replace function public.create_chatgpt_meal_for_integration(
  p_user_id uuid,
  p_log_date date,
  p_title text,
  p_description text,
  p_calories integer,
  p_protein_g numeric,
  p_carbs_g numeric,
  p_fat_g numeric,
  p_idempotency_key text,
  p_force_duplicate boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous_sub text := current_setting('request.jwt.claim.sub', true);
  v_day public.day_logs;
  v_meal public.meal_entries;
  v_created boolean := false;
  v_title_normalized text;
  v_description_normalized text;
begin
  if p_user_id is null or p_log_date is null then
    raise exception 'invalid_request';
  end if;

  -- El rol service_role es el único caller autorizado. El claim sólo vive en
  -- esta transacción y permite reutilizar las funciones canónicas auth.uid().
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);

  select m.* into v_meal
  from public.meal_entries m
  where m.user_id = p_user_id
    and m.idempotency_key = p_idempotency_key;

  if found then
    select d.* into v_day
    from public.day_logs d
    where d.id = v_meal.day_log_id
      and d.user_id = p_user_id;
  else
    v_day := public.get_or_create_day_log(p_log_date);
    v_title_normalized := upper(regexp_replace(btrim(p_title), '\s+', ' ', 'g'));
    v_description_normalized := case
      when nullif(btrim(p_description), '') is null then null
      else upper(regexp_replace(btrim(p_description), '\s+', ' ', 'g'))
    end;

    if not p_force_duplicate and exists (
      select 1
      from public.meal_entries m
      where m.user_id = p_user_id
        and m.day_log_id = v_day.id
        and m.deleted_at is null
        and m.created_at >= now() - interval '60 seconds'
        and m.final_calories = p_calories
        and (
          (m.final_protein_g is null and p_protein_g is null)
          or (m.final_protein_g is not null and p_protein_g is not null
              and abs(m.final_protein_g - p_protein_g) <= 0.01)
        )
        and (
          (m.final_carbs_g is null and p_carbs_g is null)
          or (m.final_carbs_g is not null and p_carbs_g is not null
              and abs(m.final_carbs_g - p_carbs_g) <= 0.01)
        )
        and (
          (m.final_fat_g is null and p_fat_g is null)
          or (m.final_fat_g is not null and p_fat_g is not null
              and abs(m.final_fat_g - p_fat_g) <= 0.01)
        )
        and (
          (
            v_title_normalized is not null
            and upper(regexp_replace(btrim(m.title), '\s+', ' ', 'g')) = v_title_normalized
          )
          or (
            v_description_normalized is not null
            and upper(regexp_replace(btrim(m.description), '\s+', ' ', 'g')) = v_description_normalized
          )
        )
    ) then
      raise exception 'possible_duplicate';
    end if;

    begin
      insert into public.meal_entries (
        user_id,
        day_log_id,
        consumed_at,
        title,
        description,
        final_calories,
        final_protein_g,
        final_carbs_g,
        final_fat_g,
        source_type,
        entry_kind,
        idempotency_key
      ) values (
        p_user_id,
        v_day.id,
        now(),
        p_title,
        p_description,
        p_calories,
        p_protein_g,
        p_carbs_g,
        p_fat_g,
        'chatgpt',
        'meal',
        p_idempotency_key
      )
      returning * into v_meal;
      v_created := true;
    exception when unique_violation then
      select m.* into v_meal
      from public.meal_entries m
      where m.user_id = p_user_id
        and m.idempotency_key = p_idempotency_key;
      if not found then raise; end if;
    end;

    select d.* into v_day
    from public.day_logs d
    where d.id = v_meal.day_log_id;
  end if;

  perform set_config('request.jwt.claim.sub', coalesce(v_previous_sub, ''), true);

  return jsonb_build_object(
    'ok', true,
    'created', v_created,
    'idempotent_replay', not v_created,
    'meal', jsonb_build_object(
      'id', v_meal.id,
      'date', v_day.log_date,
      'title', v_meal.title,
      'calories', v_meal.final_calories,
      'protein_g', v_meal.final_protein_g,
      'carbs_g', v_meal.final_carbs_g,
      'fat_g', v_meal.final_fat_g
    ),
    'day', jsonb_build_object(
      'total_calories', v_day.total_calories_consumed,
      'total_protein_g', v_day.total_protein_g,
      'total_carbs_g', v_day.total_carbs_g,
      'total_fat_g', v_day.total_fat_g,
      'target_calories', v_day.nutrition_target_kcal_snapshot,
      'target_protein_g', v_day.protein_target_g_snapshot
    )
  );
end;
$$;

revoke all on function public.create_chatgpt_meal_for_integration(
  uuid, date, text, text, integer, numeric, numeric, numeric, text, boolean
) from public, anon, authenticated;
grant execute on function public.create_chatgpt_meal_for_integration(
  uuid, date, text, text, integer, numeric, numeric, numeric, text, boolean
) to service_role;

comment on function public.create_chatgpt_meal_for_integration(
  uuid, date, text, text, integer, numeric, numeric, numeric, text, boolean
) is 'RPC privada service_role: reutiliza day_log y triggers canónicos para una identidad ya resuelta por token.';

commit;
