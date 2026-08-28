-- PR 8: auth hash-only, ownership, idempotencia, duplicados y agregados.
-- Fixtures exclusivamente sintéticos y rollback obligatorio.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '29800000-0000-4000-8000-000000000001', 'authenticated',
  'authenticated', 'pr8@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '29800000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.integration_api_tokens (
  user_id, token_hash, token_prefix, label, scope
) values (
  '29800000-0000-4000-8000-000000000001',
  encode(digest('synthetic-token', 'sha256'), 'hex'),
  'ownlevel_syntheti…', 'ChatGPT', 'meals:write'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

do $$
begin
  if exists (
    select 1 from public.integration_api_tokens
    where token_hash = 'synthetic-token'
  ) then
    raise exception 'se persistió un token raw';
  end if;
end;
$$;

select public.create_chatgpt_meal_for_integration(
  '29800000-0000-4000-8000-000000000001', '2026-08-20',
  'Comida sintética', 'Sólo fixture', 650, 55, 70, 14,
  'synthetic-idempotency-1', false
);

do $$
begin
  if not exists (
    select 1 from public.meal_entries m
    join public.day_logs d on d.id = m.day_log_id
    where m.user_id = '29800000-0000-4000-8000-000000000001'
      and d.log_date = '2026-08-20'
      and m.source_type = 'chatgpt'
      and m.entry_kind = 'meal'
      and m.final_protein_g = 55
      and m.final_carbs_g = 70
      and m.final_fat_g = 14
  ) then
    raise exception 'RPC no creó la comida canónica para el owner';
  end if;
  if not exists (
    select 1 from public.day_logs
    where user_id = '29800000-0000-4000-8000-000000000001'
      and log_date = '2026-08-20'
      and total_calories_consumed = 650
      and total_protein_g = 55
      and total_carbs_g = 70
      and total_fat_g = 14
  ) then
    raise exception 'trigger no recalculó el day_log';
  end if;
end;
$$;

do $$
declare v_result jsonb;
begin
  v_result := public.create_chatgpt_meal_for_integration(
    '29800000-0000-4000-8000-000000000001', '2026-08-20',
    'Comida sintética', 'Sólo fixture', 650, 55, 70, 14,
    'synthetic-idempotency-1', false
  );
  if (v_result ->> 'created')::boolean
     or not (v_result ->> 'idempotent_replay')::boolean
     or (select count(*) from public.meal_entries
         where user_id = '29800000-0000-4000-8000-000000000001') <> 1 then
    raise exception 'retry idempotente creó un duplicado';
  end if;
end;
$$;

do $$
begin
  begin
    perform public.create_chatgpt_meal_for_integration(
      '29800000-0000-4000-8000-000000000001', '2026-08-20',
      ' comida   SINTÉTICA ', 'Descripción diferente', 650, 55, 70, 14,
      'synthetic-idempotency-2', false
    );
    raise exception 'no se detectó el duplicado humano';
  exception when others then
    if sqlerrm not like '%possible_duplicate%' then raise; end if;
  end;
end;
$$;

select public.create_chatgpt_meal_for_integration(
  '29800000-0000-4000-8000-000000000001', '2026-08-20',
  'Comida sintética', 'Sólo fixture', 650, null, 0, null,
  'synthetic-idempotency-3', true
);

do $$
begin
  if (select count(*) from public.meal_entries
      where user_id = '29800000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'force_duplicate no creó la segunda comida';
  end if;
  if not exists (
    select 1 from public.meal_entries
    where idempotency_key = 'synthetic-idempotency-3'
      and final_protein_g is null
      and final_carbs_g = 0
      and final_fat_g is null
  ) then
    raise exception 'null y cero no se conservaron';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '29800000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
update public.integration_api_tokens
set revoked_at = now()
where user_id = '29800000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.integration_api_tokens
    where user_id = '29800000-0000-4000-8000-000000000001'
      and revoked_at is not null
  ) then
    raise exception 'revocación no fue inmediata';
  end if;
end;
$$;

rollback;
