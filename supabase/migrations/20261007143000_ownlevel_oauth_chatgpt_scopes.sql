-- ADOPT compatibility: ChatGPT requests standard identity/refresh scopes in
-- addition to openid. meals:write remains an OWNLEVEL-internal permission.
begin;

create or replace function public.ownlevel_oauth_authorization_client(
  p_authorization_id text,
  p_user_id uuid,
  p_resource text
)
returns uuid language sql stable security definer set search_path = '' as $$
  select a.client_id
  from auth.oauth_authorizations a
  join ownlevel_integrations.oauth_clients c on c.client_id = a.client_id
  where a.authorization_id = p_authorization_id
    and a.user_id = p_user_id
    and a.resource = p_resource
    and regexp_split_to_array(btrim(a.scope), '\\s+') @> array['openid']::text[]
    and regexp_split_to_array(btrim(a.scope), '\\s+')
      <@ array['openid','email','offline_access']::text[]
    and c.resource = p_resource
    and c.enabled
    and a.expires_at > now();
$$;

revoke all on function public.ownlevel_oauth_authorization_client(text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.ownlevel_oauth_authorization_client(text,uuid,text)
  to service_role;

commit;
