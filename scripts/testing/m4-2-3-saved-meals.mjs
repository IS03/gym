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
const directory = await mkdtemp(join(tmpdir(), 'ownlevel-m423-'));
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
  const today=(await admin.query("select (statement_timestamp() at time zone 'America/Argentina/Cordoba')::date::text d")).rows[0].d;
  const yesterday=(await admin.query('select ($1::date-1)::text d',[today])).rows[0].d;
  const oldSaved=(await a.query("insert into public.saved_meals(user_id,name,template_type,calories,protein_g,carbs_g,fat_g) values($1,'Existing quick','manual',50,null,0,1) returning id",[owner])).rows[0].id;
  const oldSource=(await a.query('select public.mobile_read_quick_options() d')).rows[0].d.saved.rows.find(r=>r.id===oldSaved);
  const oldIntent={date:today,source:{kind:'saved',id:oldSaved,version:oldSource.version},quantities:null,operation:'register',idempotencyKey:'pre-expand'};
  const beforeExpand=(await a.query('select * from public.mobile_confirm_quick_meal($1)',[JSON.stringify(oldIntent)])).rows[0];
  await admin.query(await file('20261004015101_mobile_personal_foods.sql'));
  await check('EXPAND keeps confirmed M4.2-1 intents replayable without normalization drift',async()=>{
    const after=(await a.query('select * from public.mobile_confirm_quick_meal($1)',[JSON.stringify(oldIntent)])).rows[0];assert.equal(after.replayed,true);assert.deepEqual(after.response_body,beforeExpand.response_body);
  });
  await admin.query(await file('20261004041348_mobile_saved_meals_management.sql'));
  const mutate=async(i,c=a)=>(await c.query('select * from public.mobile_mutate_saved_meal($1::jsonb)',[JSON.stringify(i)])).rows[0];
  const read=async(id=null,c=a)=>(await c.query('select public.mobile_read_saved_meals($1) d',[id])).rows[0].d;
  const create=(fields,key)=>({operation:'create',id:null,expectedVersion:null,fields,idempotencyKey:key});
  const change=async(id,operation,key,fields=null)=>({operation,id,expectedVersion:(await read(id))[0].version,fields,idempotencyKey:key});
  const manual={name:'Habitual',description:null,templateType:'manual',calories:null,proteinG:0,carbsG:null,fatG:1.25,items:[]};
  const composite=(items,name='Compuesta')=>({name,description:'Snapshot',templateType:'composite',calories:null,proteinG:null,carbsG:null,fatG:null,items});
  const food=(await a.query("insert into public.foods(user_id,name,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g) values($1,'Decimal',0.125,'unidad',22.5,null,1.11,0) returning id",[owner])).rows[0].id;
  const food2=(await a.query("insert into public.foods(user_id,name,serving_quantity,serving_unit,calories,protein_g,carbs_g,fat_g) values($1,'Second',3,'g',1,0,0.01,0) returning id",[owner])).rows[0].id;
  const ingredient=async(id,quantity)=>( {kind:'food',id,quantity,version:(await a.query('select public.mobile_read_foods($1) d',[id])).rows[0].d[0].version} );
  let savedManual,savedComposite,occurrence,original,firstSnapshot;
  const quick=async(id,quantities=null)=>( {date:today,source:{kind:'saved',id,version:(await read(id))[0].version},quantities} );
  const preview=async(s,c=a)=>(await c.query('select * from public.mobile_preview_quick_meal($1)',[JSON.stringify(s)])).rows[0];
  const confirm=async(s,key)=>(await a.query('select * from public.mobile_confirm_quick_meal($1)',[JSON.stringify({...s,operation:'register',idempotencyKey:key})])).rows[0];
  await check('manual nullable calories/zero, normalized replay, key mismatch and ownership',async()=>{
   const i=create(manual,'manual'),r=await mutate(i);assert.equal(r.response_status,201);savedManual=r.response_body.id;
   const m=(await read(savedManual))[0];assert.equal(m.calories,null);assert.equal(m.protein_g,0);assert.equal(m.fat_g,1.25);assert.equal(m.version,r.response_body.version);
   assert.equal((await mutate({...i,fields:{...manual,name:' habitual '}})).replayed,true);
   assert.equal((await mutate({...i,fields:{...manual,name:'different'}})).response_body.error,'IDEMPOTENCY_KEY_REUSED');
   assert.deepEqual(await read(null,stranger),[]);assert.equal((await mutate(await change(savedManual,'delete','foreign'),stranger)).response_body.error,'SAVED_UNAVAILABLE');
   assert.equal((await preview(await quick(savedManual))).response_body.error,'QUICK_SOURCE_UNUSABLE');
   assert.equal((await mutate(create(manual,'collision'))).response_body.error,'SAVED_NAME_EXISTS');
  });
  await check('composed decimal snapshots, 2-decimal quantities, unknown propagation and Quick parity',async()=>{
   const i=create(composite([await ingredient(food,0.25),await ingredient(food2,1)]),'composite');const r=await mutate(i);assert.equal(r.response_status,201);savedComposite=r.response_body.id;
   const m=(await read(savedComposite))[0];firstSnapshot=m.items[0];assert.equal(firstSnapshot.base_calories,22.5);assert.equal(firstSnapshot.base_quantity,0.125);
   assert.equal(m.calories,45);assert.equal(m.protein_g,null);assert.equal(m.carbs_g,2.22);assert.equal(m.fat_g,0);assert.equal(m.version,r.response_body.version);
   const s=await quick(savedComposite),p=await preview(s);assert.equal(p.response_status,200);assert.equal(p.response_body.snapshot.calories,m.calories);assert.equal(p.response_body.snapshot.carbsG,m.carbs_g);
   const receipt=await confirm(s,'occurrence');assert.equal(receipt.response_status,201);occurrence=receipt.response_body.resourceId;
   original=(await admin.query('select to_jsonb(m) m from public.meal_entries m where id=$1',[occurrence])).rows[0].m;
  });
  await check('component limit/duplicates/bad quantities rollback the entire transaction',async()=>{
   for(const items of [[],[await ingredient(food,0.125)],Array.from({length:51},()=>({kind:'snapshot',id:firstSnapshot.id,quantity:1})),[await ingredient(food,1),await ingredient(food,2)]]){
    await assert.rejects(mutate(create(composite(items),'bad:'+JSON.stringify(items).length)),e=>e.code==='22023');
   }
   const before=(await read(savedComposite))[0];
   const fields=composite([{kind:'snapshot',id:firstSnapshot.id,quantity:1},await ingredient(food,2)],'Should not persist');
   await assert.rejects(mutate(await change(savedComposite,'update','atomic',fields)),e=>e.code==='22023');assert.deepEqual((await read(savedComposite))[0],before);
   const missing={kind:'food',id:id(990),version:'a'.repeat(64),quantity:1};
   const r=await mutate(await change(savedComposite,'update','partial',composite([{kind:'snapshot',id:firstSnapshot.id,quantity:1},missing])));
   assert.equal(r.response_body.error,'SAVED_FOOD_UNAVAILABLE');assert.deepEqual((await read(savedComposite))[0],before);
  });
  await check('editing source Food never refreshes captured snapshots; new selections conflict explicitly',async()=>{
   const picked=await ingredient(food,1);
   await a.query('update public.foods set calories=99,name=\'Changed\' where id=$1',[food]);
   assert.equal((await read(savedComposite))[0].items[0].base_calories,22.5);
   assert.equal((await mutate(create(composite([picked],'Stale Food'),'stale-food'))).response_body.error,'SAVED_FOOD_CHANGED');
   const fields=composite([{kind:'snapshot',id:firstSnapshot.id,quantity:0.5},await ingredient(food2,3)],'Edited');
   const i=await change(savedComposite,'update','replace',fields),r=await mutate(i);assert.equal(r.response_status,201);
   const m=(await read(savedComposite))[0];assert.equal(m.items[0].base_calories,22.5);assert.equal(m.items[0].quantity,0.5);assert.equal(m.calories,91);
   assert.deepEqual((await admin.query('select to_jsonb(m) m from public.meal_entries m where id=$1',[occurrence])).rows[0].m,original);
   assert.equal((await mutate(i)).replayed,true);
  });
  await check('Web/Mobile CAS includes parent and components, source version blocks stale preview',async()=>{
   const stale=await change(savedComposite,'update','cas',composite((await read(savedComposite))[0].items.map(i=>({kind:'snapshot',id:i.id,quantity:i.quantity}))));
   const s=await quick(savedComposite);
   await a.query('update public.saved_meal_items set quantity=quantity+1 where saved_meal_id=$1',[savedComposite]);
   assert.equal((await mutate(stale)).response_body.error,'SAVED_CHANGED');assert.equal((await preview(s)).response_body.error,'QUICK_SOURCE_CHANGED');
   const i=await change(savedManual,'update','manual-edit',{...manual,calories:200});assert.equal((await mutate(i)).response_status,201);
  });
  await check('archive/reactivate, name collision, quick membership and deleted-source receipt recovery',async()=>{
   const archival=await change(savedManual,'archive','archive');assert.equal((await mutate(archival)).response_status,201);
   assert.ok(!(await a.query('select public.mobile_read_quick_options() d')).rows[0].d.saved.rows.some(m=>m.id===savedManual));
   const replacement=(await mutate(create(manual,'replacement'))).response_body.id;
   assert.equal((await mutate(await change(savedManual,'reactivate','reactivate-collision'))).response_body.error,'SAVED_NAME_EXISTS');
   await mutate(await change(replacement,'delete','remove-replacement'));assert.equal((await mutate(await change(savedManual,'reactivate','reactivate'))).response_status,201);
   assert.ok((await a.query('select public.mobile_read_quick_options() d')).rows[0].d.saved.rows.some(m=>m.id===savedManual));
   const del=await change(savedComposite,'delete','delete'),r=await mutate(del);assert.equal(r.response_status,201);assert.equal((await mutate(del)).replayed,true);
   assert.deepEqual(await read(savedComposite),[]);assert.equal((await admin.query('select count(*)::int n from public.saved_meal_items where saved_meal_id=$1',[savedComposite])).rows[0].n,0);
   assert.deepEqual((await admin.query('select to_jsonb(m) m from public.meal_entries m where id=$1',[occurrence])).rows[0].m,original);
  });
  await check('actual concurrent writers cannot silently overwrite; same intent replays once',async()=>{
   const i=await change(savedManual,'update','concurrent-a',{...manual,calories:300}),j={...i,idempotencyKey:'concurrent-b',fields:{...i.fields,calories:400}};
   const results=await Promise.all([mutate(i,a),mutate(j,b)]);assert.deepEqual(results.map(r=>r.response_status).sort(),[201,409]);
   const m=(await read(savedManual))[0];const k=await change(savedManual,'update','same-concurrent',{...manual,calories:m.calories+1});
   const duplicate=await Promise.all([mutate(k,a),mutate(k,b)]);assert.equal(duplicate.filter(r=>r.replayed).length,1);assert.equal((await read(savedManual))[0].calories,m.calories+1);
  });
  await check('legacy Web RPC accepts decimal snapshots and preserves old confirmed Quick receipts',async()=>{
   const item={label:'Decimal Web',quantity:1,unit:'unidad',base_quantity:2,base_calories:22.5,base_protein_g:null,base_carbs_g:0,base_fat_g:1,source_food_id:food};
   const r=(await a.query("select * from public.save_saved_meal_template(null,'Web compat',null,'composite',null,null,null,null,$1)",[JSON.stringify([item])])).rows[0];
   assert.equal(r.calories,11);assert.equal((await read(r.id))[0].items[0].base_calories,22.5);
   const replay=(await a.query('select * from public.mobile_confirm_quick_meal($1)',[JSON.stringify(oldIntent)])).rows[0];assert.equal(replay.replayed,true);assert.deepEqual(replay.response_body,beforeExpand.response_body);
  });
  await check('SQL arithmetic matches shared Web/Expo rounding vectors including null and zero',async()=>{
   const ts=await import('typescript');const js=ts.transpileModule(await readFile(new URL('../../src/lib/mobile-api/saved-meal-math.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
   const math=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
   for(const baseQuantity of [0.125,3,100])for(const quantity of [0.01,0.25,1,3.33,99.99]){
    const base={baseQuantity,baseCalories:22.5,baseProteinG:null,baseCarbsG:1.005,baseFatG:0};const raw={base_quantity:baseQuantity,base_calories:22.5,base_protein_g:null,base_carbs_g:1.005,base_fat_g:0,quantity};
    const expected=math.scaleSavedNutrients(base,quantity),actual=(await a.query('select public.saved_meal_scaled_nutrients($1,$2) d',[JSON.stringify(raw),quantity])).rows[0].d;assert.deepEqual(actual,expected);
    const totals=(await a.query('select public.saved_meal_snapshot_totals($1) d',[JSON.stringify([raw,raw,raw])])).rows[0].d;assert.deepEqual(totals,math.sumSavedNutrients([expected,expected,expected]));
   }
  });
  await check('50 ingredients succeeds; archive/delete during edit and blocked Web race keep explicit CAS',async()=>{
   const ids=(await a.query("insert into public.foods(user_id,name,serving_quantity,serving_unit,calories) select $1,'Batch '||i,1,'u',1 from generate_series(1,50) i returning id",[owner])).rows.map(r=>r.id);
   const items=await Promise.all(ids.map(id=>ingredient(id,1)));const r=await mutate(create(composite(items,'Fifty'),'fifty'));assert.equal(r.response_status,201);const id=r.response_body.id;assert.equal((await read(id))[0].items.length,50);
   const stale=await change(id,'update','stale-archive',composite(items,'Stale archive'));await mutate(await change(id,'archive','archive-fifty'));assert.equal((await mutate(stale)).response_body.error,'SAVED_CHANGED');
   const staleDelete=await change(id,'update','stale-delete',composite(items,'Stale delete'));await mutate(await change(id,'delete','delete-fifty'));assert.equal((await mutate(staleDelete)).response_body.error,'SAVED_UNAVAILABLE');
   const webStale=await change(savedManual,'update','web-race',{...manual,calories:123});await b.query('begin');await b.query("update public.saved_meals set calories=456 where id=$1",[savedManual]);
   const pending=mutate(webStale,a);await new Promise(r=>setTimeout(r,30));await b.query('commit');assert.equal((await pending).response_body.error,'SAVED_CHANGED');assert.equal((await read(savedManual))[0].calories,456);
  });
  console.log(`${checks} Postgres integration groups passed`);
} finally {await Promise.allSettled(clients.map(c=>c.end()));if(started)await pg.stop();await rm(directory,{recursive:true,force:true});}
