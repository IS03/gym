import {describe,it,expect,jest} from '@jest/globals';
import {ConfigurationController,type ConfigApi} from './config-controller';
import {ConfigurationIntentRepository} from './config-storage';
import {configurationDraft,validateConfigurationDraft} from './config-model';
import {parseNutritionConfig,parseConfigIntent,type NutritionConfig,type ConfigIntent} from '@/api/nutrition-config';
import {configFixture} from './config-fixture.test-helper';
const version='a'.repeat(64),today='2026-10-04';
const meta={durationMs:0,httpStatus:200,outcome:'ok' as const};
const ok=<T,>(data:T)=>({status:'ok' as const,data,meta});
const unavailable={status:'unavailable' as const,reason:'network' as const,meta:{...meta,outcome:'unavailable' as const,httpStatus:null}};
function setup(){const memory=new Map<string,string>(),storage={getItem:jest.fn(async(k:string)=>memory.get(k)??null),setItem:jest.fn(async(k:string,v:string)=>{memory.set(k,v);}),removeItem:jest.fn(async(k:string)=>{memory.delete(k);})};
 const api:ConfigApi={read:jest.fn(async()=>ok(configFixture)),write:jest.fn(async(i:ConfigIntent)=>ok({status:'confirmed' as const,operation:i.operation,date:i.date,version:'b'.repeat(64),weightRecorded:false})),refreshToday:jest.fn(async()=>true)};
 const repository=new ConfigurationIntentRepository(storage,'owner'),invalidate=jest.fn(),controller=new ConfigurationController(api,repository,invalidate,()=> 'config:one');return {api,storage,repository,controller,invalidate};}
const tick=()=>new Promise(r=>setTimeout(r,0));
describe('configuration forms and controller',()=>{
 it('nullable profile, zero, comma, seven weekdays and strict runtime',()=>{
  expect(parseNutritionConfig(configFixture)).toBeDefined();expect(parseNutritionConfig({...configFixture,physical:{status:'ok',data:{}}})).toBeUndefined();
  const d=configurationDraft('plan',configFixture)!;expect(validateConfigurationDraft('plan',d).fields).toBeUndefined();d.baseWaterL='0';d.protein1='0';d.calories2='2000,00';expect(validateConfigurationDraft('plan',d).fields).toMatchObject({baseWaterL:0});d.protein1='12,25';expect(validateConfigurationDraft('plan',d).fields).toMatchObject({weekdays:expect.arrayContaining([{weekday:1,calorieTargetKcal:2000,proteinTargetG:12.25}])});
  const p=configurationDraft('physical',configFixture)!;p.weightKg='';expect(validateConfigurationDraft('physical',p).fields).toMatchObject({weightKg:null});p.weightKg='0';expect(validateConfigurationDraft('physical',p).fields).toMatchObject({weightKg:0});p.heightCm='180,5';expect(validateConfigurationDraft('physical',p).fields).toBeUndefined();
  expect(parseConfigIntent({operation:'physical',date:today,expectedVersion:version,idempotencyKey:'key',fields:{birthDate:'2026-02-30',sex:null,heightCm:null,weightKg:null}})).toBeUndefined();
 });
 it.each(['plan','energy','physical'] as const)('%s persists before sending and refreshes server truth',async op=>{
  const x=setup();await x.controller.initialize();x.controller.open();await tick();x.controller.begin(op);if(op==='plan')x.controller.change('baseWaterL','2,5');
  jest.mocked(x.api.write).mockImplementation(async i=>{expect(await x.repository.read()).toMatchObject({intent:i});expect(x.controller.getSnapshot().phase).toBe('pending');return ok({status:'confirmed',operation:i.operation,date:i.date,version,weightRecorded:false});});
  await x.controller.save();expect(x.api.write).toHaveBeenCalledTimes(1);expect(x.api.refreshToday).toHaveBeenCalledWith(today);expect(x.invalidate).toHaveBeenCalledTimes(1);expect(await x.repository.read()).toBeNull();expect(x.controller.getSnapshot()).toMatchObject({phase:'idle',draft:null});
 });
 it('open(op) goes straight to that operation once truth is read; a failed read keeps the request for the retry',async()=>{
  const x=setup();await x.controller.initialize();x.controller.open('physical');await tick();
  expect(x.controller.getSnapshot()).toMatchObject({open:true,operation:'physical',draft:{weightKg:'80'}});
  x.controller.close();jest.mocked(x.api.read).mockResolvedValueOnce(unavailable);x.controller.open('physical');await tick();
  expect(x.controller.getSnapshot()).toMatchObject({open:true,operation:null,readError:true});
  await x.controller.load();expect(x.controller.getSnapshot()).toMatchObject({operation:'physical',readError:false});
  x.controller.back();await x.controller.load();expect(x.controller.getSnapshot().operation).toBeNull();
  x.controller.close();x.controller.open();await tick();expect(x.controller.getSnapshot()).toMatchObject({open:true,operation:null});
 });
 it('conflict preserves draft; foreground refresh cannot replace it; review uses current version',async()=>{
  const x=setup();await x.controller.initialize();x.controller.open();await tick();x.controller.begin('physical');x.controller.change('weightKg','81,25');
  jest.mocked(x.api.read).mockResolvedValue(ok({...configFixture,physical:{status:'ok',data:{...(configFixture.physical.status==='ok'?configFixture.physical.data: {} as never),version:'b'.repeat(64),weightKg:90}}}));
  jest.mocked(x.api.write).mockResolvedValue({status:'conflict',code:'PHYSICAL_CHANGED',message:'Cambió',meta:{...meta,outcome:'conflict'}});
  await x.controller.save();expect(x.controller.getSnapshot()).toMatchObject({phase:'conflict',draft:{weightKg:'81,25'},intent:null});await x.controller.load();expect(x.controller.getSnapshot().draft?.weightKg).toBe('81,25');x.controller.reviewTruth();expect(x.controller.getSnapshot().baseline?.physical).toMatchObject({data:{version:'b'.repeat(64)}});
 });
 it('ambiguous result survives restart; explicit replay uses same key and does not send on initialize/load',async()=>{
  const x=setup();await x.controller.initialize();x.controller.open();await tick();x.controller.begin('energy');jest.mocked(x.api.write).mockResolvedValueOnce(unavailable);await x.controller.save();const stored=await x.repository.read();expect(x.controller.getSnapshot().phase).toBe('uncertain');
  const second=new ConfigurationController(x.api,x.repository,x.invalidate);await second.initialize();await second.load();expect(x.api.write).toHaveBeenCalledTimes(1);expect(second.getSnapshot()).toMatchObject({phase:'uncertain',draft:stored!.draft});await second.recover();expect(jest.mocked(x.api.write).mock.calls[1][0]).toEqual(stored!.intent);expect(await x.repository.read()).toBeNull();
 });
 it('confirmed receipt recovery only rereads when refresh fails',async()=>{
  const x=setup();await x.controller.initialize();x.controller.open();await tick();x.controller.begin('physical');jest.mocked(x.api.refreshToday).mockResolvedValueOnce(false);await x.controller.save();expect(x.controller.getSnapshot().phase).toBe('confirmed');expect((await x.repository.read())?.receipt).toBeDefined();await x.controller.recover();expect(x.api.write).toHaveBeenCalledTimes(1);expect(x.invalidate).toHaveBeenCalledTimes(1);
 });
 it('stale reads do not replace newer truth or open draft; midnight conflict retains draft',async()=>{
  const x=setup();await x.controller.initialize();x.controller.open();await tick();x.controller.begin('physical');x.controller.change('weightKg','82');let resolve!:(r:ReturnType<typeof ok<NutritionConfig>>)=>void;
  jest.mocked(x.api.read).mockImplementationOnce(()=>new Promise(r=>{resolve=r;}));const old=x.controller.load();await x.controller.load();resolve(ok({...configFixture,today:'2026-10-03'}));await old;expect(x.controller.getSnapshot().config?.today).toBe(today);expect(x.controller.getSnapshot().draft?.weightKg).toBe('82');
  jest.mocked(x.api.write).mockResolvedValue({status:'conflict',code:'CONFIG_DAY_CHANGED',message:'Cambió el día',meta:{...meta,outcome:'conflict'}});await x.controller.save();expect(x.controller.getSnapshot()).toMatchObject({phase:'conflict',draft:{weightKg:'82'}});
 });
 it('storage failure blocks before write; unavailable config cannot open draft',async()=>{
  const x=setup();await x.controller.initialize();x.controller.open();await tick();x.controller.begin('physical');x.storage.setItem.mockRejectedValueOnce(new Error('disk'));await x.controller.save();expect(x.api.write).not.toHaveBeenCalled();expect(x.controller.getSnapshot().phase).toBe('blocked');
  const y=setup();await y.controller.initialize();jest.mocked(y.api.read).mockResolvedValue(unavailable);y.controller.open();await tick();y.controller.begin('plan');expect(y.controller.getSnapshot().draft).toBeNull();
 });
});
