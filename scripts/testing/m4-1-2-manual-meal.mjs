// Disposable PostgreSQL 17: actual Nutrition schema, engine, triggers, ledger
// and Mobile RPC. No production fixtures or credentials.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m4-1-2-manual-meal.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m412-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const pg = new EmbeddedPostgres({ databaseDir: join(directory,'db'), port, user:'postgres', password:'local-test',
  persistent:true, createPostgresUser:false, onLog:()=>{}, onError:()=>{}, postgresFlags:['-h','127.0.0.1'] });
const clients=[]; let started=false; let checks=0;
async function connect() { const c=pg.getPgClient(); clients.push(c); await c.connect(); return c; }
const file = name => readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
const id=n=>`41200000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1), other=id(2), date='2026-09-20', destination='2026-09-19';
async function role(c,user=owner) { await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); }
const fields=(patch={})=>({date,title:' pasta ',description:null,calories:200,proteinG:null,carbsG:20.25,fatG:0,...patch});
const create=(key,patch={},forceDuplicate=false)=>({operation:'create',sourceDate:date,mealId:null,expectedUpdatedAt:null,idempotencyKey:key,fields:fields(patch),forceDuplicate});
const mutate=async(c,intent)=>(await c.query('select * from public.mobile_mutate_manual_meal($1::jsonb)',[JSON.stringify(intent)])).rows[0];
const edit=(mealId,expectedUpdatedAt,key,patch={},sourceDate=date)=>({operation:'edit',sourceDate,mealId,expectedUpdatedAt,idempotencyKey:key,fields:fields(patch),forceDuplicate:false});
const remove=(mealId,expectedUpdatedAt,key,sourceDate=date)=>({operation:'delete',sourceDate,mealId,expectedUpdatedAt,idempotencyKey:key,fields:null,forceDuplicate:false});
async function check(name,run) { await run(); console.log(`PASS ${name}`); checks++; }
try {
  await pg.initialise(); await pg.start(); started=true;
  const admin=await connect(), a=await connect(), b=await connect(), stranger=await connect();
  await admin.query(`create role anon; create role authenticated; create schema auth; create schema extensions;
    create extension pgcrypto with schema extensions;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const name of ['0001.sql','20260426_0002_phase1_profiles_weight_and_checks.sql','20260426_0004_phase1_remove_meal_status.sql','20260813150000_nutrition_schema_foundation.sql']) await admin.query(await file(name));
  await admin.query('create table public.workout_sessions(id uuid primary key,user_id uuid,day_log_id uuid,status text)');
  for(const name of ['20260813163000_nutrition_day_engine.sql','20260813170000_nutrition_energy_sync.sql','20260908170000_nutrition_plan_energy_v2.sql','20260909180000_daily_nutrition_overrides_v2.sql']) await admin.query(await file(name));
  const normalization=await file('20260426_0012_normalize_names_uppercase.sql');
  await admin.query(normalization.slice(normalization.indexOf('create or replace function'),normalization.indexOf('$$;',normalization.indexOf('create or replace function'))+3));
  await admin.query(await file('20260426_0013_normalize_meals_uppercase.sql'));
  const ledger=await file('20260927190000_mobile_training_api_expand.sql');
  await admin.query(ledger.slice(0,ledger.indexOf('create function public.mobile_create_training_routine'))+'commit;');
  await admin.query(await file('20261003031651_mobile_manual_meal_crud.sql'));
  await admin.query('insert into auth.users values($1),($2)',[owner,other]);
  await admin.query('grant select,insert,update on public.day_logs,public.meal_entries to authenticated');
  await role(a); await role(b); await role(stranger,other);
  let mealId, version;
  await check('create, null versus explicit zero, persisted totals and snapshots',async()=>{
    const r=await mutate(a,create('first')); assert.equal(r.response_status,201); mealId=r.response_body.mealId; version=r.response_body.updatedAt;
    const row=(await admin.query('select * from public.meal_entries where id=$1',[mealId])).rows[0];
    assert.equal(row.title,'PASTA'); assert.equal(row.final_protein_g,null); assert.equal(Number(row.final_fat_g),0);
    const d=(await admin.query('select * from public.day_logs where id=$1',[row.day_log_id])).rows[0];
    assert.equal(d.total_calories_consumed,200); assert.equal(Number(d.total_carbs_g),20.25);
  });
  await check('lost response replay is exact and performs no second write',async()=>{
    const r=await mutate(a,create('first')); assert.equal(r.replayed,true); assert.equal(r.response_body.mealId,mealId);
    assert.equal((await admin.query('select count(*)::integer n from public.meal_entries')).rows[0].n,1);
    assert.equal((await mutate(a,create('first',{calories:201}))).response_body.error,'IDEMPOTENCY_KEY_REUSED');
    assert.equal((await mutate(a,create('first',{title:'PASTA'}))).replayed,true);
  });
  await check('recent duplicate, stored warning replay and explicit confirmation',async()=>{
    const warning=await mutate(a,create('duplicate')); assert.equal(warning.response_body.error,'POSSIBLE_DUPLICATE');
    assert.equal((await mutate(a,create('duplicate'))).replayed,true);
    assert.equal((await mutate(a,create('duplicate',{},true))).response_body.error,'IDEMPOTENCY_KEY_REUSED');
    assert.equal((await mutate(a,create('confirmed-duplicate',{},true))).response_status,201);
    assert.equal((await mutate(a,create('zero-not-null',{proteinG:0}))).response_status,201);
  });
  await check('validation rejects invalid calories/macros/dates/user supplied fields',async()=>{
    for(const patch of [{calories:0},{calories:1.5},{proteinG:-1},{carbsG:1.001},{date:'2026-02-30'}]) {
      await assert.rejects(mutate(a,create('bad',patch)));
    }
    await assert.rejects(mutate(a,{...create('bad-user'),user_id:other}));
  });
  await check('second user isolation, private ledger and anonymous denial',async()=>{
    assert.equal((await mutate(stranger,edit(mealId,version,'foreign'))).response_status,404);
    assert.equal((await mutate(stranger,remove(mealId,version,'foreign'))).response_status,404);
    assert.equal((await mutate(stranger,create('first'))).response_status,201);
    assert.equal((await stranger.query('select count(*)::integer n from public.meal_entries where id=$1',[mealId])).rows[0].n,0);
    await assert.rejects(a.query('select * from public.mobile_idempotency_keys'));
    await admin.query('set role anon'); await assert.rejects(mutate(admin,create('anon'))); await admin.query('reset role');
  });
  await check('edit CAS, same request replay and different payload conflict',async()=>{
    const request=edit(mealId,version,'edit',{calories:300,proteinG:0});
    const r=await mutate(a,request); assert.equal(r.response_status,200); assert.notEqual(r.response_body.updatedAt,version);
    assert.equal((await mutate(a,request)).replayed,true);
    assert.equal((await mutate(a,{...request,fields:fields({calories:301})})).response_body.error,'IDEMPOTENCY_KEY_REUSED');
    assert.equal((await mutate(a,edit(mealId,version,'stale'))).response_body.error,'MEAL_CHANGED'); version=r.response_body.updatedAt;
  });
  await check('move recalculates both dates, preserves historical snapshots and consumedAt',async()=>{
    const before=(await admin.query('select consumed_at from public.meal_entries where id=$1',[mealId])).rows[0];
    await admin.query('insert into public.day_logs(user_id,log_date,nutrition_target_kcal_snapshot,estimated_expenditure_kcal_snapshot) values($1,$2,1800,2200)',[owner,destination]);
    const r=await mutate(a,edit(mealId,version,'move',{date:destination,calories:300,proteinG:0}));
    assert.equal(r.response_status,200); assert.equal(r.response_body.sourceDate,date); assert.equal(r.response_body.destinationDate,destination); version=r.response_body.updatedAt;
    const rows=(await admin.query('select * from public.day_logs where user_id=$1 order by log_date',[owner])).rows;
    assert.equal(rows[0].total_calories_consumed,300); assert.equal(rows[1].total_calories_consumed,400);
    assert.equal(rows[0].nutrition_target_kcal_snapshot,1800); assert.equal(rows[0].energy_balance_kcal,-1900);
    assert.equal((await admin.query('select consumed_at from public.meal_entries where id=$1',[mealId])).rows[0].consumed_at.getTime(),before.consumed_at.getTime());
  });
  await check('concurrent Web update wins; blocked Mobile CAS never overwrites it',async()=>{
    await b.query('begin'); await b.query('update public.meal_entries set final_calories=450 where id=$1',[mealId]);
    const waiting=mutate(a,edit(mealId,version,'concurrent-web',{date:destination},destination));
    await b.query('commit'); const r=await waiting; assert.equal(r.response_body.error,'MEAL_CHANGED');
    assert.equal((await admin.query('select final_calories from public.meal_entries where id=$1',[mealId])).rows[0].final_calories,450);
    version=(await b.query('select updated_at::text v from public.meal_entries where id=$1',[mealId])).rows[0].v;
  });
  await check('two competing Mobile edits yield one success and one CAS conflict',async()=>{
    const results=await Promise.all([mutate(a,edit(mealId,version,'race-a',{date:destination,calories:500},destination)),mutate(b,edit(mealId,version,'race-b',{date:destination,calories:550},destination))]);
    assert.deepEqual(results.map(r=>r.response_status).sort(),[200,409]);
    version=(await a.query('select updated_at::text v from public.meal_entries where id=$1',[mealId])).rows[0].v;
  });
  await check('delete CAS, soft delete, replay and aggregates',async()=>{
    assert.equal((await mutate(a,remove(mealId,'2020-01-01T00:00:00Z','delete-stale',destination))).response_body.error,'MEAL_CHANGED');
    const request=remove(mealId,version,'delete',destination), r=await mutate(a,request); assert.equal(r.response_body.status,'deleted');
    assert.equal((await mutate(a,request)).replayed,true);
    assert.ok((await admin.query('select deleted_at from public.meal_entries where id=$1',[mealId])).rows[0].deleted_at);
    assert.equal((await admin.query('select total_calories_consumed n from public.day_logs where user_id=$1 and log_date=$2',[owner,destination])).rows[0].n,0);
    assert.equal((await mutate(a,edit(mealId,r.response_body.updatedAt,'deleted-edit',{date:destination},destination))).response_body.error,'MEAL_UNAVAILABLE');
  });
  await check('historical summary remains read-only and blocks mixed composition',async()=>{
    const d=(await admin.query("insert into public.day_logs(user_id,log_date) values($1,'2026-09-18') returning id",[owner])).rows[0].id;
    const m=(await admin.query("insert into public.meal_entries(user_id,day_log_id,entry_kind,source_type,final_calories,precision_level,legacy_import_source,legacy_import_id) values($1,$2,'legacy_daily_summary','sheet_import',600,'historical','disposable-test','row-1') returning id,updated_at::text v",[owner,d])).rows[0];
    assert.equal((await mutate(a,edit(m.id,m.v,'legacy-edit',{date:'2026-09-18'},'2026-09-18'))).response_body.error,'MEAL_UNAVAILABLE');
    assert.equal((await mutate(a,remove(m.id,m.v,'legacy-delete','2026-09-18'))).response_body.error,'MEAL_UNAVAILABLE');
    assert.equal((await mutate(a,{...create('legacy-create',{date:'2026-09-18'}),sourceDate:'2026-09-18'})).response_body.error,'DAY_HAS_HISTORICAL_SUMMARY');
  });
  console.log(`PostgreSQL: ${checks} groups PASS`);
} finally {
  for(const c of clients) await c.end().catch(()=>{});
  if(started) await pg.stop(); await rm(directory,{recursive:true,force:true});
}
