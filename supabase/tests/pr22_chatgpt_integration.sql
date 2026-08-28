-- PR22: mínimo privilegio para tokens y preservación de la RPC privada.
-- Fixtures exclusivamente sintéticos y rollback obligatorio.
begin;

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '22900000-0000-4000-8000-000000000001', 'authenticated',
  'authenticated', 'pr22@example.invalid', '', now(),
  '{}'::jsonb, '{}'::jsonb, now(), now()
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '22900000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into public.integration_api_tokens (
  user_id, token_hash, token_prefix, label, scope
) values (
  '22900000-0000-4000-8000-000000000001',
  encode(digest('pr22-synthetic-token', 'sha256'), 'hex'),
  'ownlevel_pr22synt…', 'ChatGPT', 'meals:write'
);

do $$
begin
  if has_column_privilege(
    'authenticated', 'public.integration_api_tokens', 'token_hash', 'UPDATE'
  ) or has_column_privilege(
    'authenticated', 'public.integration_api_tokens', 'last_used_at', 'UPDATE'
  ) or not has_column_privilege(
    'authenticated', 'public.integration_api_tokens', 'revoked_at', 'UPDATE'
  ) then
    raise exception 'privilegios UPDATE de integración incorrectos';
  end if;

  if to_regprocedure('public.integration_api_tokens_protect_update()') is not null then
    raise exception 'la función deprecated sigue instalada';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.create_chatgpt_meal_for_integration(uuid,date,text,text,integer,numeric,numeric,numeric,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'authenticated obtuvo acceso a la RPC privada';
  end if;
end;
$$;

do $$
begin
  begin
    update public.integration_api_tokens
    set token_hash = encode(digest('modified', 'sha256'), 'hex')
    where user_id = '22900000-0000-4000-8000-000000000001';
    raise exception 'authenticated pudo modificar token_hash';
  exception when insufficient_privilege then
    null;
  end;

  begin
    update public.integration_api_tokens
    set last_used_at = now()
    where user_id = '22900000-0000-4000-8000-000000000001';
    raise exception 'authenticated pudo modificar last_used_at';
  exception when insufficient_privilege then
    null;
  end;
end;
$$;

update public.integration_api_tokens
set revoked_at = now()
where user_id = '22900000-0000-4000-8000-000000000001'
  and revoked_at is null;

do $$
begin
  if not exists (
    select 1 from public.integration_api_tokens
    where user_id = '22900000-0000-4000-8000-000000000001'
      and revoked_at is not null
  ) then
    raise exception 'la revocación del owner falló';
  end if;
end;
$$;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

update public.integration_api_tokens
set last_used_at = now()
where user_id = '22900000-0000-4000-8000-000000000001';

do $$
begin
  if not has_function_privilege(
    'service_role',
    'public.create_chatgpt_meal_for_integration(uuid,date,text,text,integer,numeric,numeric,numeric,text,boolean)',
    'EXECUTE'
  ) then
    raise exception 'service_role perdió acceso a la RPC privada';
  end if;
end;
$$;

rollback;
