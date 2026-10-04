// Disposable PostgreSQL 17: actual Nutrition schema, engine, triggers, ledger
// and Mobile RPC. No production fixtures or credentials.
// OWNLEVEL_TEST_MODULES=/tmp/tooling/node_modules node scripts/testing/m4-2-1-quick-registration.mjs
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'node:net';
const modules = process.env.OWNLEVEL_TEST_MODULES;
if (!modules) throw new Error('External embedded-postgres test tooling required');
const { default: EmbeddedPostgres } = await import(pathToFileURL(join(modules, 'embedded-postgres/dist/index.js')));
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m421-'));
const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const pg = new EmbeddedPostgres({ databaseDir: join(directory,'db'), port, user:'postgres', password:'local-test',
  persistent:true, createPostgresUser:false, onLog:()=>{}, onError:()=>{}, postgresFlags:['-h','127.0.0.1'] });
const clients=[]; let started=false; let checks=0;
async function connect() { const c=pg.getPgClient(); clients.push(c); await c.connect(); return c; }
const file = name => readFile(new URL(`../../supabase/migrations/${name}`,import.meta.url),'utf8');
const id=n=>`41300000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const owner=id(1), other=id(2), date='2026-09-20', destination='2026-09-19';
async function role(c,user=owner) { await c.query('set role authenticated'); await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]); }
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
  for (const name of ['20260909155017_configurable_daily_metrics.sql','20260914104157_r3_atomic_daily_metric_values.sql','20261003021157_mobile_nutrition_day_read.sql','20261003040926_mobile_activity_context_writes.sql']) await admin.query(await file(name));
  await admin.query('insert into auth.users values($1),($2)',[owner,other]);
  await admin.query('grant select,insert,update on public.day_logs,public.meal_entries to authenticated');
  await role(a); await role(b); await role(stranger,other);
  const blockers=await file('20260814010000_nutrition_import_blockers.sql');
  await admin.query(blockers.slice(0,blockers.indexOf('-- body_measurements'))+'commit;');
  for(const name of ['20260830171201_saved_meals.sql','20260908223000_food_calories_decimal.sql','20261004010134_mobile_quick_registration.sql']) await admin.query(await file(name));
  await admin.query('grant usage on schema extensions to authenticated; grant select on public.profiles, public.workout_sessions to authenticated');
  if (process.env.OWNLEVEL_TEST_EXPAND_M422 === '1') await admin.query(await file('20261004015101_mobile_personal_foods.sql'));
  const today=(await admin.query("select (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date::text d")).rows[0].d;
  const yesterday=(await admin.query('select ($1::date-1)::text d',[today])).rows[0].d;
  const sourceDay=(await a.query('select (public.get_or_create_day_log($1)).id id',[yesterday])).rows[0].id;
  const meal=(await a.query("insert into public.meal_entries(user_id,day_log_id,title,final_calories,final_protein_g,final_carbs_g,final_fat_g,source_type,entry_kind) values($1,$2,'PASTA',300,null,25,0,'manual','meal') returning id",[owner,sourceDay])).rows[0].id;
  const manual=(await a.query("insert into public.saved_meals(user_id,name,template_type,calories,protein_g,carbs_g,fat_g) values($1,'Saved manual','manual',250,null,20,0) returning id",[owner])).rows[0].id;
  const composite=(await a.query("insert into public.saved_meals(user_id,name,template_type) values($1,'Saved composite','composite') returning id",[owner])).rows[0].id;
  const items=[];
  for(let position=0;position<2;position++) items.push((await a.query("insert into public.saved_meal_items(user_id,saved_meal_id,label,quantity,unit,base_quantity,base_calories,base_protein_g,base_carbs_g,base_fat_g,position) values($1,$2,$3,0.5,'u',1,1,null,1,0,$4) returning id",[owner,composite,'Item '+position,position])).rows[0].id);
  const options=async(c=a)=>(await c.query('select public.mobile_read_quick_options() d')).rows[0].d;
  const selection=async(kind,id,quantities=null)=>{
    const o=await options(),row=(kind==='saved'?o.saved:o.suggested).rows.find(r=>r.id===id);
    return {date:today,source:{kind,id,version:row.version},quantities};
  };
  const preview=async(s,c=a)=>(await c.query('select * from public.mobile_preview_quick_meal($1::jsonb)',[JSON.stringify(s)])).rows[0];
  const intent=(s,key,operation='register')=>({...s,operation,idempotencyKey:key});
  const confirm=async(i,c=a)=>(await c.query('select * from public.mobile_confirm_quick_meal($1::jsonb)',[JSON.stringify(i)])).rows[0];
  await check('reads active sources with full fingerprints, independent owners and today window',async()=>{
    const o=await options();assert.equal(o.today,today);assert.equal(o.saved.rows.length,2);assert.equal(o.suggested.rows.length,1);
    assert.match(o.saved.rows[0].version,/^[a-f0-9]{64}$/);assert.equal(o.suggested.rows[0].final_protein_g,null);assert.equal(o.suggested.rows[0].final_fat_g,0);
    const foreign=await options(stranger);assert.deepEqual(foreign.saved.rows,[]);assert.deepEqual(foreign.suggested.rows,[]);
  });
  await check('preview is read-only; suggestion creates a normal independent entry, intentional repeat allowed',async()=>{
    const s=await selection('suggestion',meal),p=await preview(s);assert.equal(p.response_status,200);assert.equal(p.response_body.snapshot.proteinG,null);
    assert.equal((await admin.query('select count(*)::int n from public.day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0].n,0);
    const first=await confirm(intent(s,'suggestion-first'));assert.equal(first.response_status,201);assert.equal(first.response_body.status,'registered');
    const second=await confirm(intent(s,'suggestion-repeat'));assert.equal(second.response_status,201);assert.notEqual(second.response_body.resourceId,first.response_body.resourceId);
    const entry=(await admin.query('select * from public.meal_entries where id=$1',[first.response_body.resourceId])).rows[0];
    assert.equal(entry.source_type,'manual');assert.equal(entry.entry_kind,'meal');assert.equal(Number(entry.final_calories),300);assert.equal(entry.final_protein_g,null);assert.equal(Number(entry.final_fat_g),0);
    const day=(await admin.query('select total_calories_consumed v from public.day_logs where user_id=$1 and log_date=$2',[owner,today])).rows[0];assert.equal(Number(day.v),600);
  });
  await check('same key/content replays, normalized quantity order and payload conflict',async()=>{
    const s=await selection('saved',composite,items.map(itemId=>({itemId,quantity:1}))),i=intent(s,'normalized');
    const r=await confirm(i);assert.equal(r.response_status,201);assert.equal((await confirm({...i,quantities:[...i.quantities].reverse()})).replayed,true);
    assert.equal((await confirm({...i,date:yesterday})).response_body.error,'IDEMPOTENCY_KEY_REUSED');
  });
  await check('composed preview equals stored occurrence; per-item rounding and null propagation',async()=>{
    const s=await selection('saved',composite),p=await preview(s);assert.equal(p.response_status,200);assert.equal(p.response_body.snapshot.calories,2);assert.equal(p.response_body.snapshot.proteinG,null);
    assert.equal((await admin.query('select calories from public.saved_meals where id=$1',[composite])).rows[0].calories,1);
    const before=(await admin.query('select jsonb_agg(to_jsonb(i) order by id) d from public.saved_meal_items i where saved_meal_id=$1',[composite])).rows[0].d;
    const r=await confirm(intent(s,'composed'));const stored=(await admin.query('select * from public.meal_entries where id=$1',[r.response_body.resourceId])).rows[0];
    for(const [k,col] of [['calories','final_calories'],['proteinG','final_protein_g'],['carbsG','final_carbs_g'],['fatG','final_fat_g']])assert.equal(stored[col]===null?null:Number(stored[col]),p.response_body.snapshot[k]);
    assert.equal(stored.context_type,'saved_meal');assert.equal(stored.description,p.response_body.snapshot.description);
    assert.deepEqual((await admin.query('select jsonb_agg(to_jsonb(i) order by id) d from public.saved_meal_items i where saved_meal_id=$1',[composite])).rows[0].d,before);
    const adj=await selection('saved',composite,items.map(itemId=>({itemId,quantity:100})));const pp=await preview(adj);assert.equal(pp.response_body.snapshot.calories,200);assert.match(pp.response_body.snapshot.description,/100 U/);
    assert.equal((await confirm(intent(adj,'adjusted'))).response_status,201);
    const thousand=await selection('saved',composite,items.map(itemId=>({itemId,quantity:1000.25})));assert.match((await preview(thousand)).response_body.snapshot.description,/1\.000,25 U/);
  });
  await check('manual preview/confirm preserves zero and unknown; replay survives source archive/delete',async()=>{
    const s=await selection('saved',manual),p=await preview(s);assert.equal(p.response_body.snapshot.proteinG,null);assert.equal(p.response_body.snapshot.fatG,0);
    const i=intent(s,'manual');const r=await confirm(i);assert.equal(r.response_status,201);
    await b.query('update public.saved_meals set is_active=false where id=$1',[manual]);assert.equal((await preview(s)).response_body.error,'QUICK_SOURCE_UNAVAILABLE');assert.equal((await confirm(i)).replayed,true);
    await b.query('delete from public.saved_meals where id=$1',[manual]);assert.equal((await confirm(i)).replayed,true);
    assert.equal((await confirm(intent(s,'missing-manual'))).response_body.error,'QUICK_SOURCE_UNAVAILABLE');
    assert.equal((await admin.query('select final_calories from public.meal_entries where id=$1',[r.response_body.resourceId])).rows[0].final_calories,250);
  });
  await check('source/version conflict and ownership cannot create entries',async()=>{
    const s=await selection('saved',composite);await b.query('update public.saved_meals set description=$2 where id=$1',[composite,'changed']);
    assert.equal((await preview(s)).response_body.error,'QUICK_SOURCE_CHANGED');assert.equal((await confirm(intent(s,'changed'))).response_body.error,'QUICK_SOURCE_CHANGED');
    const current=await selection('saved',composite);assert.equal((await preview(current,stranger)).response_body.error,'QUICK_SOURCE_UNAVAILABLE');assert.equal((await confirm(intent(current,'foreign'),stranger)).response_body.error,'QUICK_SOURCE_UNAVAILABLE');
    assert.equal((await stranger.query('select count(*)::int n from public.meal_entries where user_id=$1',[owner])).rows[0].n,0);
  });
  await check('ingredient mutation changes parent/source version and stale preview conflicts',async()=>{
    const s=await selection('saved',composite);await b.query('update public.saved_meal_items set quantity=2 where id=$1',[items[0]]);
    assert.equal((await preview(s)).response_body.error,'QUICK_SOURCE_CHANGED');assert.equal((await confirm(intent(s,'item-changed'))).response_body.error,'QUICK_SOURCE_CHANGED');
    const fresh=await selection('saved',composite,[{itemId:items[0],quantity:3}]);assert.equal((await preview(fresh)).response_body.error,'QUICK_SOURCE_CHANGED');
    const invalid={...fresh,quantities:[{itemId:items[0],quantity:0}]};await assert.rejects(preview(invalid));
    await assert.rejects(confirm(intent({...fresh,quantities:[{itemId:items[0],quantity:1.234}]},'invalid-quantity')));
  });
  await check('save suggestion creates only a normalized manual template; idempotency and active name uniqueness',async()=>{
    const s=await selection('suggestion',meal),i=intent(s,'save-suggestion','saveSuggestion');
    const count=(await admin.query('select count(*)::int n from public.meal_entries')).rows[0].n;
    const r=await confirm(i);assert.equal(r.response_status,201);assert.equal(r.response_body.status,'habitual_saved');
    const row=(await admin.query('select * from public.saved_meals where id=$1',[r.response_body.resourceId])).rows[0];assert.equal(row.name,'PASTA');assert.equal(row.template_type,'manual');assert.equal(row.protein_g,null);assert.equal(Number(row.fat_g),0);
    assert.equal((await admin.query('select count(*)::int n from public.meal_entries')).rows[0].n,count);assert.equal((await confirm(i)).replayed,true);
    assert.equal((await confirm(intent(s,'save-name-conflict','saveSuggestion'))).response_body.error,'SAVED_NAME_EXISTS');
    assert.equal((await confirm(intent(s,'save-foreign','saveSuggestion'),stranger)).response_body.error,'QUICK_SOURCE_UNAVAILABLE');
  });
  await check('suggestion CAS/replay survives edit, soft delete and disappearing source',async()=>{
    const s=await selection('suggestion',meal),i=intent(s,'source-edit');const r=await confirm(i);
    await b.query('update public.meal_entries set final_calories=320 where id=$1',[meal]);assert.equal((await preview(s)).response_body.error,'QUICK_SOURCE_CHANGED');assert.equal((await confirm(i)).replayed,true);
    const ss=await selection('suggestion',meal);await b.query('update public.meal_entries set deleted_at=now() where id=$1',[meal]);assert.equal((await confirm(intent(ss,'source-delete'))).response_body.error,'QUICK_SOURCE_UNAVAILABLE');
    assert.equal((await confirm(i)).replayed,true);assert.equal((await admin.query('select final_calories from public.meal_entries where id=$1',[r.response_body.resourceId])).rows[0].final_calories,300);
  });
  await check('concurrent Web source edit cannot silently replace reviewed snapshot',async()=>{
    const s=await selection('saved',composite);await b.query('begin');await b.query('update public.saved_meals set description=$2 where id=$1',[composite,'concurrent']);
    const pending=confirm(intent(s,'web-race'));await new Promise(r=>setTimeout(r,120));await b.query('commit');assert.equal((await pending).response_body.error,'QUICK_SOURCE_CHANGED');
  });
  await check('concurrent same intent inserts once and returns replay receipt',async()=>{
    const s=await selection('saved',composite),i=intent(s,'simultaneous');const r=await Promise.all([confirm(i,a),confirm(i,b)]);
    assert.deepEqual(r.map(x=>x.replayed).sort(),[false,true]);assert.equal(r[0].response_body.resourceId,r[1].response_body.resourceId);
  });
  await check('historical destination materializes only on confirm and protects imported summary',async()=>{
    const historic='2026-08-01',s={...await selection('saved',composite),date:historic};assert.equal((await preview(s)).response_status,200);
    assert.equal((await admin.query('select count(*)::int n from public.day_logs where user_id=$1 and log_date=$2',[owner,historic])).rows[0].n,0);
    const r=await confirm(intent(s,'historic'));assert.equal(r.response_status,201);
    const imported=(await a.query("select (public.get_or_create_day_log('2026-08-02')).id id")).rows[0].id;
    await a.query("insert into public.meal_entries(user_id,day_log_id,final_calories,source_type,entry_kind,precision_level,legacy_import_source,legacy_import_id) values($1,$2,400,'sheet_import','legacy_daily_summary','historical','disposable-test','row-1')",[owner,imported]);
    assert.equal((await confirm(intent({...s,date:'2026-08-02'},'imported'))).response_body.error,'DAY_HAS_HISTORICAL_SUMMARY');
  });
  await check('invalid nutrition/quantities cannot create facts and grants keep ledger private',async()=>{
    const bad=(await a.query("insert into public.saved_meals(user_id,name,template_type,calories,protein_g) values($1,'No calories','manual',null,1) returning id",[owner])).rows[0].id;
    assert.equal((await preview(await selection('saved',bad))).response_body.error,'QUICK_SOURCE_UNUSABLE');
    await assert.rejects(a.query('select * from public.mobile_idempotency_keys'));
    await admin.query('set role anon');await assert.rejects(admin.query('select public.mobile_read_quick_options()'));await admin.query('reset role');
  });
  console.log(`PostgreSQL: ${checks} groups PASS`);
} finally {
  for(const c of clients) await c.end().catch(()=>{});
  if(started) await pg.stop(); await rm(directory,{recursive:true,force:true});
}
