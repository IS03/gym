-- Run after the M8 display-name EXPAND. Entire fixture and privilege probes roll back.
begin;
insert into auth.users(id,email) values
 ('81000000-0000-4000-8000-000000000001','m8-rollback-owner@example.invalid'),
 ('81000000-0000-4000-8000-000000000002','m8-rollback-other@example.invalid'),
 ('81000000-0000-4000-8000-000000000003','m8-rollback-noprofile@example.invalid');
insert into public.profiles(user_id,display_name,height_cm) values
 ('81000000-0000-4000-8000-000000000001',null,180),
 ('81000000-0000-4000-8000-000000000002','Otra',170);
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare s jsonb; s2 jsonb; phys text; r record; r2 record; k text := 'display-name:m8:1';
begin
 s := public.mobile_read_profile_identity();
 if s->'displayName' <> 'null'::jsonb or s->>'version' !~ '^[a-f0-9]{64}$' then raise exception 'read: %', s; end if;
 phys := public.mobile_configuration_state('physical')->>'version';

 -- Write with CAS: confirmed, stored, new version.
 select * into r from public.mobile_update_profile_display_name(jsonb_build_object('displayName','Nacho','expectedVersion',s->>'version','idempotencyKey',k));
 if r.response_status <> 200 or r.response_body->>'displayName' <> 'Nacho' or r.replayed then raise exception 'write: %', row_to_json(r); end if;
 s2 := public.mobile_read_profile_identity();
 if s2->>'displayName' <> 'Nacho' or s2->>'version' = s->>'version' or s2->>'version' <> r.response_body->>'version' then raise exception 'reread: %', s2; end if;
 -- The physical profile version ignores display_name (no cross-form conflicts).
 if public.mobile_configuration_state('physical')->>'version' <> phys then raise exception 'physical version changed'; end if;

 -- Idempotent replay returns the stored receipt unchanged.
 select * into r2 from public.mobile_update_profile_display_name(jsonb_build_object('displayName','Nacho','expectedVersion',s->>'version','idempotencyKey',k));
 if r2.response_status <> 200 or not r2.replayed or r2.response_body <> r.response_body then raise exception 'replay: %', row_to_json(r2); end if;
 -- Same key, different payload.
 select * into r2 from public.mobile_update_profile_display_name(jsonb_build_object('displayName','Otro','expectedVersion',s->>'version','idempotencyKey',k));
 if r2.response_status <> 409 or r2.response_body->>'error' <> 'IDEMPOTENCY_KEY_REUSED' then raise exception 'key reuse: %', row_to_json(r2); end if;

 -- Web edits the name meanwhile: the stale Mobile draft conflicts without overwriting.
 update public.profiles set display_name='Desde Web' where user_id=auth.uid();
 select * into r2 from public.mobile_update_profile_display_name(jsonb_build_object('displayName','Mobile','expectedVersion',s2->>'version','idempotencyKey','display-name:m8:2'));
 if r2.response_status <> 409 or r2.response_body->>'error' <> 'PROFILE_CHANGED' then raise exception 'stale: %', row_to_json(r2); end if;
 if (select display_name from public.profiles where user_id=auth.uid()) <> 'Desde Web' then raise exception 'stale write overwrote'; end if;

 -- Blank = null (Web semantics); clearing works with the current version.
 s := public.mobile_read_profile_identity();
 select * into r2 from public.mobile_update_profile_display_name(jsonb_build_object('displayName',null,'expectedVersion',s->>'version','idempotencyKey','display-name:m8:3'));
 if r2.response_status <> 200 or (select display_name from public.profiles where user_id=auth.uid()) is not null then raise exception 'clear: %', row_to_json(r2); end if;

 -- Non-normalized names and foreign keys in the intent are invalid input.
 begin
  perform public.mobile_update_profile_display_name(jsonb_build_object('displayName',' Nacho','expectedVersion',s->>'version','idempotencyKey','display-name:m8:4'));
  raise exception 'untrimmed accepted';
 exception when sqlstate '22023' then null; end;
 begin
  perform public.mobile_update_profile_display_name(jsonb_build_object('displayName','','expectedVersion',s->>'version','idempotencyKey','display-name:m8:5'));
  raise exception 'empty accepted';
 exception when sqlstate '22023' then null; end;
 begin
  perform public.mobile_update_profile_display_name(jsonb_build_object('displayName','X','expectedVersion',s->>'version','idempotencyKey','display-name:m8:6','userId','81000000-0000-4000-8000-000000000002'));
  raise exception 'userId accepted';
 exception when sqlstate '22023' then null; end;

 -- Ownership: nothing of the other user changed.
 reset role;
 if (select display_name from public.profiles where user_id='81000000-0000-4000-8000-000000000002') <> 'Otra' then raise exception 'foreign profile changed'; end if;
end;
$$;

-- A user without a profile row gets one with only display_name.
reset role;
select set_config('request.jwt.claims','{"sub":"81000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
do $$
declare s jsonb; r record;
begin
 s := public.mobile_read_profile_identity();
 if s->'displayName' <> 'null'::jsonb then raise exception 'no-profile read: %', s; end if;
 select * into r from public.mobile_update_profile_display_name(jsonb_build_object('displayName','Nuevo','expectedVersion',s->>'version','idempotencyKey','display-name:m8:7'));
 if r.response_status <> 200 or (select display_name from public.profiles where user_id=auth.uid()) <> 'Nuevo' then raise exception 'insert: %', row_to_json(r); end if;
end;
$$;

-- Anonymous callers cannot execute.
reset role;
set local role anon;
do $$
begin
 perform public.mobile_read_profile_identity();
 raise exception 'anon read allowed';
exception when insufficient_privilege then null;
end;
$$;
rollback;
