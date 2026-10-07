-- EXPAND only: existing private-token RPC and meal semantics are untouched.
begin;

create schema if not exists ownlevel_integrations;
revoke all on schema ownlevel_integrations from public, anon, authenticated;
grant usage on schema ownlevel_integrations to service_role, supabase_auth_admin;

create table ownlevel_integrations.oauth_clients (
  client_id uuid primary key,
  resource text not null check (resource ~ '^https://[^?#]+/mcp$'),
  enabled boolean not null default false,
  created_at timestamptz not null default now()
);
create table ownlevel_integrations.oauth_grants (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references ownlevel_integrations.oauth_clients(client_id),
  grant_id uuid not null default gen_random_uuid(),
  permissions text[] not null default array['meals:write']::text[]
    check (permissions <@ array['meals:write']::text[]),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key (user_id, client_id),
  unique (grant_id)
);
alter table ownlevel_integrations.oauth_clients enable row level security;
alter table ownlevel_integrations.oauth_grants enable row level security;
grant select on ownlevel_integrations.oauth_clients,
  ownlevel_integrations.oauth_grants to supabase_auth_admin;
create policy auth_hook_clients on ownlevel_integrations.oauth_clients
  for select to supabase_auth_admin using (true);
create policy auth_hook_grants on ownlevel_integrations.oauth_grants
  for select to supabase_auth_admin using (true);
grant all on ownlevel_integrations.oauth_clients,
  ownlevel_integrations.oauth_grants to service_role;

-- Called by Supabase Auth, not by the public MCP or browser.
-- claims.client_id, rather than an undocumented top-level client_id, is canonical.
create function ownlevel_integrations.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  claims jsonb := event->'claims';
  v_client_id text := claims->>'client_id';
  v_resource text;
  v_grant_id uuid;
begin
  if nullif(v_client_id, '') is null then
    return event; -- ordinary Google/web/mobile sessions remain unchanged
  end if;
  -- Clear any stale application permission before recomputing it from live policy.
  claims := claims - 'ownlevel_permissions' - 'ownlevel_grant_id';
  select c.resource, g.grant_id into v_resource, v_grant_id
    from ownlevel_integrations.oauth_clients c
    join ownlevel_integrations.oauth_grants g on g.client_id = c.client_id
    where c.client_id::text = v_client_id and c.enabled
      and g.user_id::text = claims->>'sub'
      and g.revoked_at is null and 'meals:write' = any(g.permissions)
      and coalesce((claims->>'is_anonymous')::boolean, true) = false;
  if found then
    claims := jsonb_set(claims, '{aud}', to_jsonb(v_resource));
    claims := jsonb_set(claims, '{ownlevel_permissions}', '["meals:write"]'::jsonb);
    claims := jsonb_set(claims, '{ownlevel_grant_id}', to_jsonb(v_grant_id::text));
  end if;
  return jsonb_set(event, '{claims}', claims);
end;
$$;
revoke all on function ownlevel_integrations.custom_access_token_hook(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function ownlevel_integrations.custom_access_token_hook(jsonb)
  to supabase_auth_admin;

-- All exposed policy-management functions are service_role only. Callers in
-- Next.js must derive p_user_id from a verified browser session or JWT sub.
create function public.ownlevel_oauth_client_allowed(p_client_id uuid, p_resource text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from ownlevel_integrations.oauth_clients
    where client_id = p_client_id and resource = p_resource and enabled);
$$;

create function public.ownlevel_oauth_authorization_client(p_authorization_id text, p_user_id uuid, p_resource text)
returns uuid language sql stable security definer set search_path = '' as $$
  select a.client_id from auth.oauth_authorizations a
    join ownlevel_integrations.oauth_clients c on c.client_id = a.client_id
    where a.authorization_id = p_authorization_id and a.user_id = p_user_id
      and a.resource = p_resource and a.scope = 'openid'
      and c.resource = p_resource and c.enabled
      and a.expires_at > now();
$$;

create function public.ownlevel_oauth_grant_meals(p_user_id uuid, p_client_id uuid, p_resource text, p_authorization_id text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_grant_id uuid;
begin
  if public.ownlevel_oauth_authorization_client(p_authorization_id, p_user_id, p_resource)
    is distinct from p_client_id then
    raise exception 'oauth_permission_denied' using errcode = '42501';
  end if;
  perform 1 from ownlevel_integrations.oauth_clients
    where client_id = p_client_id and resource = p_resource and enabled for share;
  if not found then raise exception 'oauth_permission_denied' using errcode = '42501'; end if;
  insert into ownlevel_integrations.oauth_grants as g (user_id, client_id)
    values (p_user_id, p_client_id)
    on conflict (user_id, client_id) do update set
      grant_id = case when g.revoked_at is null then g.grant_id else gen_random_uuid() end,
      permissions = array['meals:write']::text[], revoked_at = null, granted_at = now()
    returning grant_id into v_grant_id;
  return v_grant_id;
end;
$$;

create function public.ownlevel_oauth_revoke_meals(p_user_id uuid, p_client_id uuid)
returns void language sql security definer set search_path = '' as $$
  update ownlevel_integrations.oauth_grants set revoked_at = now(), permissions = '{}'
    where user_id = p_user_id and client_id = p_client_id;
$$;

create function public.ownlevel_oauth_access_allowed(
  p_user_id uuid, p_client_id uuid, p_session_id uuid, p_grant_id uuid, p_resource text
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from ownlevel_integrations.oauth_clients c
    join ownlevel_integrations.oauth_grants g on g.client_id = c.client_id
    join auth.sessions s on s.user_id = g.user_id and s.oauth_client_id = c.client_id
    where c.client_id = p_client_id and c.enabled and c.resource = p_resource
      and g.user_id = p_user_id and g.grant_id = p_grant_id and g.revoked_at is null
      and 'meals:write' = any(g.permissions) and s.id = p_session_id
      and (s.not_after is null or s.not_after > now())
  );
$$;

create function public.create_chatgpt_meal_for_oauth(
  p_user_id uuid, p_client_id uuid, p_session_id uuid, p_grant_id uuid, p_resource text,
  p_log_date date, p_title text, p_description text, p_calories integer,
  p_protein_g numeric, p_carbs_g numeric, p_fat_g numeric,
  p_idempotency_key text, p_force_duplicate boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  -- Same lock order as grant creation. Revocation/client disable serialize with
  -- the entire canonical write: no gap between the live check and persistence.
  perform 1 from ownlevel_integrations.oauth_clients
    where client_id = p_client_id for share;
  perform 1 from ownlevel_integrations.oauth_grants
    where user_id = p_user_id and client_id = p_client_id for share;
  if not public.ownlevel_oauth_access_allowed(
    p_user_id, p_client_id, p_session_id, p_grant_id, p_resource
  ) then raise exception 'oauth_permission_denied' using errcode = '42501'; end if;
  return public.create_chatgpt_meal_for_integration(
    p_user_id, p_log_date, p_title, p_description, p_calories,
    p_protein_g, p_carbs_g, p_fat_g, p_idempotency_key, p_force_duplicate
  );
end;
$$;

revoke all on function public.ownlevel_oauth_client_allowed(uuid,text),
  public.ownlevel_oauth_authorization_client(text,uuid,text),
  public.ownlevel_oauth_grant_meals(uuid,uuid,text,text),
  public.ownlevel_oauth_revoke_meals(uuid,uuid),
  public.ownlevel_oauth_access_allowed(uuid,uuid,uuid,uuid,text),
  public.create_chatgpt_meal_for_oauth(uuid,uuid,uuid,uuid,text,date,text,text,integer,numeric,numeric,numeric,text,boolean)
  from public, anon, authenticated;
grant execute on function public.ownlevel_oauth_client_allowed(uuid,text),
  public.ownlevel_oauth_authorization_client(text,uuid,text),
  public.ownlevel_oauth_grant_meals(uuid,uuid,text,text),
  public.ownlevel_oauth_revoke_meals(uuid,uuid),
  public.ownlevel_oauth_access_allowed(uuid,uuid,uuid,uuid,text),
  public.create_chatgpt_meal_for_oauth(uuid,uuid,uuid,uuid,text,date,text,text,integer,numeric,numeric,numeric,text,boolean)
  to service_role;

-- OAuth scopes do not limit the Data API. Deny direct OAuth access; this
-- integration is mediated by the canonical service-only meal API.
-- RESTRICTIVE policies AND existing ownership policies, never replace them.
do $$
declare t record;
begin
  for t in select n.nspname, c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
  loop
    execute format('create policy ownlevel_no_direct_oauth on %I.%I as restrictive for all to authenticated using (nullif((select auth.jwt())->>''client_id'', '''') is null) with check (nullif((select auth.jwt())->>''client_id'', '''') is null)', t.nspname, t.relname);
  end loop;
end;
$$;

-- Also stops exposed SECURITY DEFINER RPCs before they can bypass table RLS.
create function public.ownlevel_restrict_oauth_data_api()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if nullif(auth.jwt()->>'client_id', '') is not null then
    raise exception 'OAuth access is restricted to the OWNLEVEL integration API' using errcode = '42501';
  end if;
end;
$$;
revoke all on function public.ownlevel_restrict_oauth_data_api() from public, anon;
grant execute on function public.ownlevel_restrict_oauth_data_api() to anon, authenticated, service_role;
do $$
begin
  if exists (select 1 from pg_roles r, unnest(r.rolconfig) setting
    where r.rolname = 'authenticator' and setting like 'pgrst.db_pre_request=%'
      and setting <> 'pgrst.db_pre_request=public.ownlevel_restrict_oauth_data_api') then
    raise exception 'Existing PostgREST pre-request hook must be composed before applying OAuth migration';
  end if;
end;
$$;
alter role authenticator set pgrst.db_pre_request = 'public.ownlevel_restrict_oauth_data_api';
notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
