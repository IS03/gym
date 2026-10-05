-- M8 EXPAND: Mobile read/write of profiles.display_name only.
-- Web semantics (settings/profile-actions.ts): trimmed text, blank = null, no
-- length or character rules. Web keeps its current upsert path unchanged.
-- The version covers display_name alone, so it never conflicts with physical
-- profile intents (whose version excludes display_name) and vice versa.
begin;

create function public.mobile_profile_identity_state()
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare u uuid:=(select auth.uid()); dn text;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 select display_name into dn from public.profiles where user_id=u;
 return jsonb_build_object('displayName',dn,
  'version',public.mobile_quick_source_version(jsonb_build_object('operation','profile.display_name','displayName',dn)));
end;
$$;

create function public.mobile_read_profile_identity()
returns jsonb language sql stable security invoker set search_path='' as $$
 select public.mobile_profile_identity_state()
$$;

create function public.mobile_update_profile_display_name(p_intent jsonb)
returns table(response_status smallint,response_body jsonb,replayed boolean)
language plpgsql security definer set search_path='' set timezone='UTC' set lock_timeout='3s' set statement_timeout='8s' as $$
declare u uuid:=(select auth.uid()); k text; dn text; hash text; ledger public.mobile_idempotency_keys;
 current_state jsonb; result jsonb; code smallint:=200;
begin
 if u is null then raise exception using errcode='PT401',message='UNAUTHORIZED'; end if;
 if jsonb_typeof(p_intent) is distinct from 'object' or not p_intent ?& array['displayName','expectedVersion','idempotencyKey']
 or (select count(*) from jsonb_object_keys(p_intent))<>3
 or jsonb_typeof(p_intent->'displayName') not in ('string','null')
 or jsonb_typeof(p_intent->'expectedVersion') is distinct from 'string' or coalesce(p_intent->>'expectedVersion','') !~ '^[a-f0-9]{64}$'
 or jsonb_typeof(p_intent->'idempotencyKey') is distinct from 'string' or coalesce(p_intent->>'idempotencyKey','') !~ '^[A-Za-z0-9._:-]{1,128}$' then
  raise exception using errcode='22023',message='INVALID_DISPLAY_NAME_INTENT';
 end if;
 dn:=p_intent->>'displayName'; k:=p_intent->>'idempotencyKey';
 -- Clients send the Web-normalized value (trimmed, blank = null); anything else is invalid.
 if dn is not null and (dn ~ '^[[:space:]]' or dn ~ '[[:space:]]$' or dn='') then
  raise exception using errcode='22023',message='INVALID_DISPLAY_NAME_INTENT';
 end if;
 hash:=public.mobile_quick_source_version(jsonb_build_object('displayName',dn,'expectedVersion',p_intent->>'expectedVersion'));
 perform pg_advisory_xact_lock(hashtextextended(u::text,412));
 insert into public.mobile_idempotency_keys(user_id,operation,idempotency_key,request_hash,expires_at)
 values(u,'profile.display_name.v1',k,hash,'infinity') on conflict(user_id,operation,idempotency_key) do nothing;
 select * into ledger from public.mobile_idempotency_keys where user_id=u and operation='profile.display_name.v1' and idempotency_key=k for update;
 if ledger.request_hash<>hash then
  return query select 409::smallint,jsonb_build_object('error','IDEMPOTENCY_KEY_REUSED','message','El intento ya tiene otros datos.'),false; return;
 end if;
 if ledger.state='completed' then return query select ledger.response_status,ledger.response_body,true; return; end if;
 begin
  perform pg_advisory_xact_lock(hashtextextended(u::text,413));
  current_state:=public.mobile_profile_identity_state();
  if current_state->>'version'<>p_intent->>'expectedVersion' then raise exception using errcode='P0431',message='PROFILE_CHANGED'; end if;
  if current_state->>'displayName' is distinct from dn then
   insert into public.profiles(user_id,display_name) values(u,dn)
   on conflict(user_id) do update set display_name=excluded.display_name;
  end if;
  current_state:=public.mobile_profile_identity_state();
  result:=jsonb_build_object('status','confirmed','displayName',current_state->'displayName','version',current_state->>'version');
 exception when sqlstate 'P0431' then
  code:=409; result:=jsonb_build_object('error',sqlerrm,'message','Tu nombre cambió desde que abriste el formulario. Conservamos tu borrador para revisar.');
 end;
 update public.mobile_idempotency_keys set state='completed',response_status=code,response_body=result,resource_type='profile_display_name',completed_at=clock_timestamp()
 where user_id=u and operation='profile.display_name.v1' and idempotency_key=k;
 return query select code,result,false;
end;
$$;

revoke all on function public.mobile_profile_identity_state(),public.mobile_read_profile_identity(),public.mobile_update_profile_display_name(jsonb) from public,anon;
grant execute on function public.mobile_profile_identity_state(),public.mobile_read_profile_identity(),public.mobile_update_profile_display_name(jsonb) to authenticated;

commit;
