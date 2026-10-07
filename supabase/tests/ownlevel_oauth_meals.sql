-- Synthetic fixtures, no hosted writes, always rollback.
begin;
insert into auth.users(id,aud,role,email,encrypted_password,email_confirmed_at,
  raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('71000000-0000-4000-8000-000000000001','authenticated','authenticated',
  'oauth-sql@example.invalid','',now(),'{}','{}',now(),now());
insert into auth.oauth_clients(id,registration_type,redirect_uris,grant_types,client_type,token_endpoint_auth_method)
values ('71000000-0000-4000-8000-000000000002','manual',
  'http://127.0.0.1:3007/callback','authorization_code,refresh_token','public','none');
insert into ownlevel_integrations.oauth_clients(client_id,resource,enabled)
values ('71000000-0000-4000-8000-000000000002','https://www.ownlevel.fit/mcp',true);
insert into ownlevel_integrations.oauth_grants(user_id,client_id,grant_id)
values ('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000004');
insert into auth.sessions(id,user_id,oauth_client_id,not_after)
values ('71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000002',now()+interval '1 hour'),
  ('71000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000002',now()-interval '1 hour');

set local role supabase_auth_admin;
do $$
declare result jsonb; ordinary jsonb := '{"claims":{"sub":"71000000-0000-4000-8000-000000000001","aud":"authenticated"}}';
begin
  if ownlevel_integrations.custom_access_token_hook(ordinary) <> ordinary then
    raise exception 'ordinary web/mobile claims changed';
  end if;
  result := ownlevel_integrations.custom_access_token_hook('{"claims":{
    "sub":"71000000-0000-4000-8000-000000000001","aud":"authenticated",
    "client_id":"71000000-0000-4000-8000-000000000002","is_anonymous":false}}');
  if result->'claims'->>'aud' <> 'https://www.ownlevel.fit/mcp'
    or result->'claims'->'ownlevel_permissions' <> '["meals:write"]'::jsonb then
    raise exception 'hook audience/internal permission missing';
  end if;
  result := ownlevel_integrations.custom_access_token_hook('{"claims":{
    "sub":"71000000-0000-4000-8000-000000000001","aud":"authenticated",
    "client_id":"71000000-0000-4000-8000-000000000099","is_anonymous":false,
    "ownlevel_permissions":["meals:write"],"ownlevel_grant_id":"stale"}}');
  if result->'claims' ? 'ownlevel_permissions' or result->'claims' ? 'ownlevel_grant_id' then
    raise exception 'unapproved client retained stale permission';
  end if;
end;
$$;
set local role service_role;
select public.create_chatgpt_meal_for_oauth(
  '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000004',
  'https://www.ownlevel.fit/mcp','2026-10-07','Comida OAuth SQL','Sintética',500,null,75,null,'oauth-sql-first',false);
do $$
declare r jsonb;
begin
  r := public.create_chatgpt_meal_for_oauth(
    '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000004',
    'https://www.ownlevel.fit/mcp','2026-10-07','Comida OAuth SQL','Sintética',500,null,75,null,'oauth-sql-first',false);
  if r->>'idempotent_replay' <> 'true' or r->>'created' <> 'false' then
    raise exception 'OAuth wrapper changed canonical idempotency';
  end if;
  if not exists(select 1 from public.day_logs where user_id='71000000-0000-4000-8000-000000000001'
    and total_calories_consumed=500 and total_carbs_g=75) then
    raise exception 'OAuth wrapper did not recalculate day_logs';
  end if;
  if public.ownlevel_oauth_access_allowed('71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-000000000004','https://foreign.invalid/mcp') then
    raise exception 'foreign resource accepted';
  end if;
  if public.ownlevel_oauth_access_allowed('71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000005',
    '71000000-0000-4000-8000-000000000004','https://www.ownlevel.fit/mcp') then
    raise exception 'expired OAuth session accepted';
  end if;
  if public.ownlevel_oauth_access_allowed('71000000-0000-4000-8000-000000000099',
    '71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003',
    '71000000-0000-4000-8000-000000000004','https://www.ownlevel.fit/mcp') then
    raise exception 'a foreign identity borrowed another user session/grant';
  end if;
end;
$$;
select public.ownlevel_oauth_revoke_meals('71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002');
do $$
begin
  begin
    perform public.create_chatgpt_meal_for_oauth(
      '71000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002',
      '71000000-0000-4000-8000-000000000003','71000000-0000-4000-8000-000000000004',
      'https://www.ownlevel.fit/mcp','2026-10-07','Revoked','Sintética',500,null,75,null,'oauth-sql-revoked',true);
    raise exception 'revoked grant wrote a meal';
  exception when insufficient_privilege then null; end;
  if exists(select 1 from public.meal_entries where idempotency_key='oauth-sql-revoked') then
    raise exception 'revoked grant reached persistence';
  end if;
end;
$$;
reset role;
insert into auth.oauth_authorizations(id,authorization_id,client_id,user_id,redirect_uri,
  scope,resource,response_type,status)
values
  (gen_random_uuid(),'oauth-sql-reauthorize','71000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000001','http://127.0.0.1:3007/callback',
    'openid email offline_access','https://www.ownlevel.fit/mcp','code','pending'),
  (gen_random_uuid(),'oauth-sql-disallowed','71000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000001','http://127.0.0.1:3007/callback',
    'openid profile','https://www.ownlevel.fit/mcp','code','pending');
set local role service_role;
do $$
declare new_grant uuid;
begin
  if public.ownlevel_oauth_authorization_client(
    'oauth-sql-disallowed',
    '71000000-0000-4000-8000-000000000001',
    'https://www.ownlevel.fit/mcp'
  ) is not null then
    raise exception 'unexpected OAuth scope accepted';
  end if;
  new_grant := public.ownlevel_oauth_grant_meals('71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002','https://www.ownlevel.fit/mcp','oauth-sql-reauthorize');
  if new_grant='71000000-0000-4000-8000-000000000004' or
    public.ownlevel_oauth_access_allowed('71000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003',
      '71000000-0000-4000-8000-000000000004','https://www.ownlevel.fit/mcp') then
    raise exception 'reauthorization revived an old JWT fingerprint';
  end if;
  if not public.ownlevel_oauth_access_allowed('71000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003',
    new_grant,'https://www.ownlevel.fit/mcp') then raise exception 'new grant not usable'; end if;
end;
$$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"71000000-0000-4000-8000-000000000002"}',true);
do $$
begin
  if exists(select 1 from public.meal_entries) then raise exception 'OAuth bypassed restrictive RLS'; end if;
  if has_function_privilege('authenticated','public.ownlevel_oauth_grant_meals(uuid,uuid,text,text)','EXECUTE') then
    raise exception 'OAuth client can grant itself permissions';
  end if;
  begin
    perform public.ownlevel_restrict_oauth_data_api();
    raise exception 'OAuth bypassed Data API pre-request guard';
  exception when insufficient_privilege then null; end;
end;
$$;
rollback;
