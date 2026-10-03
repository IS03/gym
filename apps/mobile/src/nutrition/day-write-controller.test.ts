import { describe,expect,it,jest } from '@jest/globals';
import { DayWriteController,type DayWriteApi } from './day-write-controller';
import { DayWriteRepository } from './day-write-storage';
import { buildDayWriteIntent,dayWriteDraft,metricInputValue,rebaseDayDraft } from './day-write-model';
import { nutritionFixture } from './day-fixture.test-helper';
import type { NutritionStoragePort } from './intent-repository';
const date='2026-10-02',meta={durationMs:1,httpStatus:200,outcome:'ok' as const};
const failure={status:'unavailable' as const,reason:'network' as const,meta:{durationMs:1,httpStatus:null,outcome:'unavailable' as const}};
function fixture(){
 const map=new Map<string,string>();const port:NutritionStoragePort={getItem:async k=>map.get(k)??null,setItem:async(k,v)=>{map.set(k,v);},removeItem:async k=>{map.delete(k);}};
 const repository=new DayWriteRepository(port,'owner');
 const api:DayWriteApi={mutate:jest.fn<DayWriteApi['mutate']>().mockImplementation(async i=>({status:'ok',data:{status:'saved',date:i.date,operation:i.operation},meta})),read:jest.fn<DayWriteApi['read']>().mockImplementation(async d=>({status:'ok',data:nutritionFixture(d),meta}))};
 const invalidate=jest.fn<()=>void>();let key=0;const controller=new DayWriteController(api,repository,invalidate,()=>`test:${++key}`);
 const activity=nutritionFixture().activity;const metricId=activity.status==='ok'?activity.data.metrics[0].id:'';
 return {map,port,repository,api,invalidate,controller,metricId};
}
async function open(f:ReturnType<typeof fixture>,kind:'metrics'|'context'='metrics'){
 await f.controller.initialize();f.controller.open(kind,nutritionFixture(date));
 if(kind==='metrics')f.controller.changeMetric(f.metricId,'value','2,5');else f.controller.changeContext('target','1900');
}
describe('Activity/context models',()=>{
 it('preserves missing versus zero, decimals, integer and minute semantics',()=>{
  expect(metricInputValue({value:'',hours:'',minutes:''},'decimal')).toBeNull();
  expect(metricInputValue({value:'0',hours:'',minutes:''},'integer')).toBe(0);
  expect(metricInputValue({value:'1,1234',hours:'',minutes:''},'decimal')).toBe(1.1234);
  expect(metricInputValue({value:'1.2',hours:'',minutes:''},'integer')).toBeUndefined();
  expect(metricInputValue({value:'',hours:'8',minutes:'5'},'duration')).toBe(485);
  expect(metricInputValue({value:'',hours:'0',minutes:''},'duration')).toBe(0);
  expect(metricInputValue({value:'',hours:'8',minutes:'60'},'duration')).toBeUndefined();
 });
 it('sends only changed metrics and explicit context clear/set',()=>{
  const d=dayWriteDraft('metrics',nutritionFixture());const id=Object.keys(d.metrics)[0];
  expect(buildDayWriteIntent(d,'k').empty).toBe(true);d.metrics[id].value='';
  expect(buildDayWriteIntent(d,'k').intent).toMatchObject({operation:'metrics',changes:[{metricId:id,value:null,expectedUpdatedAt:date+'T12:00:00Z'}]});
  const c=dayWriteDraft('context',nutritionFixture());c.target='1900';expect(buildDayWriteIntent(c,'k').intent).toMatchObject({changes:{target:{action:'set',value:1900}}});
  const data=nutritionFixture();if(data.nutrition.status==='ok'&&data.nutrition.data.dayState==='recorded')data.nutrition.data.context.expenditureOverrideKcal=2400;
  const clear=dayWriteDraft('context',data);clear.expenditure='';expect(buildDayWriteIntent(clear,'k').intent).toMatchObject({changes:{expenditure:{action:'clear'}}});
  c.target='0';expect(buildDayWriteIntent(c,'k').errors.target).toBeTruthy();
 });
 it('keeps edited drafts but adopts current untouched fields only after conscious review',()=>{
  const d=dayWriteDraft('context',nutritionFixture());d.target='1900';const truth=nutritionFixture();
  if(truth.nutrition.status==='ok'&&truth.nutrition.data.dayState==='recorded'){truth.nutrition.data.context.expenditureOverrideKcal=2500;truth.nutrition.data.context.updatedAt=date+'T13:00:00.654321Z';}
  const rebased=rebaseDayDraft(d,truth)!;expect(rebased.target).toBe('1900');expect(rebased.expenditure).toBe('2500');
  expect(buildDayWriteIntent(rebased,'k').intent).toMatchObject({expectedUpdatedAt:date+'T13:00:00.654321Z',changes:{target:{action:'set',value:1900}}});
 });
 it('never drops a changed archived metric or reinterprets its meaning during conflict review',()=>{
  const d=dayWriteDraft('metrics',nutritionFixture()),id=Object.keys(d.metrics)[0];d.metrics[id].value='';const truth=nutritionFixture();
  if(truth.activity.status==='ok')truth.activity.data.metrics=[];
  expect(rebaseDayDraft(d,truth)).toBeNull();
  const changed=nutritionFixture();if(changed.activity.status==='ok')changed.activity.data.metrics[0].valueType='integer';expect(rebaseDayDraft(d,changed)).toBeNull();
 });
});
describe('Reliable day writes',()=>{
 it('persists before network, gates double save and refreshes confirmed server truth',async()=>{
  const f=fixture();await open(f);let finish!:(r:Awaited<ReturnType<DayWriteApi['mutate']>>)=>void;
  (f.api.mutate as jest.Mock<DayWriteApi['mutate']>).mockImplementation(async()=>{expect(await f.repository.read()).not.toBeNull();return new Promise(r=>{finish=r;});});
  const save=f.controller.save();await f.controller.save();while(!finish)await Promise.resolve();expect(f.controller.getSnapshot().phase).toBe('pending');
  f.controller.changeMetric(f.metricId,'value','9');expect(f.controller.getSnapshot().draft!.metrics[f.metricId].value).toBe('2,5');
  finish({status:'ok',data:{status:'saved',operation:'metrics',date},meta});await save;
  expect(f.api.mutate).toHaveBeenCalledTimes(1);expect(f.api.read).toHaveBeenCalledWith(date);expect(f.invalidate).toHaveBeenCalled();expect(await f.repository.read()).toBeNull();expect(f.controller.getSnapshot().draft).toBeNull();
 });
 it('restores ambiguous intent without automatic send; explicit recovery replays exact key/payload',async()=>{
  const f=fixture();await open(f,'context');(f.api.mutate as jest.Mock<DayWriteApi['mutate']>).mockResolvedValueOnce(failure);await f.controller.save();
  const stored=await f.repository.read();f.controller.close();expect(f.controller.getSnapshot().intent).toBeTruthy();
  const recovered=new DayWriteController(f.api,f.repository,f.invalidate);await recovered.initialize();expect(f.api.mutate).toHaveBeenCalledTimes(1);expect(recovered.getSnapshot().phase).toBe('uncertain');
  await recovered.recover();expect((f.api.mutate as jest.Mock).mock.calls[1][0]).toEqual(stored!.intent);expect(await f.repository.read()).toBeNull();
 });
 it('confirmed receipt with read failure recovers only reads, never sends another mutation',async()=>{
  const f=fixture();await open(f);(f.api.read as jest.Mock<DayWriteApi['read']>).mockResolvedValueOnce(failure);await f.controller.save();
  expect(f.controller.getSnapshot().phase).toBe('confirmed');expect((await f.repository.read())?.receipt).toBeTruthy();await f.controller.recover();expect(f.api.mutate).toHaveBeenCalledTimes(1);expect(f.api.read).toHaveBeenCalledTimes(2);expect(await f.repository.read()).toBeNull();
 });
 it('conflict keeps draft, fetches truth and requires conscious CAS adoption plus another save',async()=>{
  const f=fixture();await open(f);(f.api.mutate as jest.Mock<DayWriteApi['mutate']>).mockResolvedValueOnce({status:'conflict',code:'METRICS_CHANGED',message:'changed',meta:{...meta,httpStatus:409,outcome:'conflict'}});
  const truth=nutritionFixture();if(truth.activity.status==='ok'){truth.activity.data.metrics[0].value=1;truth.activity.data.metrics[0].updatedAt=date+'T13:00:00.654321Z';}
  (f.api.read as jest.Mock<DayWriteApi['read']>).mockResolvedValue({status:'ok',data:truth,meta});await f.controller.save();
  expect(f.controller.getSnapshot().phase).toBe('conflict');expect(f.controller.getSnapshot().draft!.metrics[f.metricId].value).toBe('2,5');await f.controller.save();expect(f.api.mutate).toHaveBeenCalledTimes(1);
  f.controller.reviewWithServerVersion();expect(f.api.mutate).toHaveBeenCalledTimes(1);await f.controller.save();
  expect((f.api.mutate as jest.Mock).mock.calls[1][0]).toMatchObject({changes:[{expectedUpdatedAt:date+'T13:00:00.654321Z',value:2.5}]});
 });
 it('partial activity/nutrition availability is independent when confirming',async()=>{
  const f=fixture();await open(f);const truth=nutritionFixture();truth.nutrition={status:'unavailable'};
  (f.api.read as jest.Mock<DayWriteApi['read']>).mockResolvedValue({status:'ok',data:truth,meta});await f.controller.save();expect(f.controller.getSnapshot().phase).toBe('idle');
 });
 it('scope teardown after delayed persistence never sends a write',async()=>{
  const f=fixture();await open(f);let release!:()=>void;
  f.port.setItem=async(k,v)=>{await new Promise<void>(r=>{release=r;});f.map.set(k,v);};
  const pending=f.controller.save();while(!release)await Promise.resolve();f.controller.dispose();release();await pending;
  expect(f.api.mutate).not.toHaveBeenCalled();expect(await f.repository.read()).not.toBeNull();
 });
 it('wrong-date reads do not clear confirmed intent',async()=>{
  const f=fixture();await open(f);(f.api.read as jest.Mock<DayWriteApi['read']>).mockResolvedValue({status:'ok',data:nutritionFixture('2026-09-01'),meta});await f.controller.save();expect(f.controller.getSnapshot().phase).toBe('confirmed');expect(await f.repository.read()).not.toBeNull();
 });
 it('unreadable storage fences writes and storage failure prevents sending',async()=>{
  const f=fixture();f.map.set(f.repository.key,'corrupt');await f.controller.initialize();expect(f.controller.getSnapshot().phase).toBe('blocked');f.controller.open('context',nutritionFixture());expect(f.controller.getSnapshot().draft).toBeNull();expect(f.api.mutate).not.toHaveBeenCalled();
  f.map.clear();await open(f);f.port.setItem=async()=>{throw new Error('disk');};await f.controller.save();expect(f.api.mutate).not.toHaveBeenCalled();expect(f.controller.getSnapshot().phase).toBe('blocked');
 });
 it('old repositories cannot clear or overwrite a newer pending intent',async()=>{
  const f=fixture();await open(f);(f.api.mutate as jest.Mock<DayWriteApi['mutate']>).mockResolvedValueOnce(failure);await f.controller.save();const old=(await f.repository.read())!;await f.repository.clear(old.intent.idempotencyKey);
  const next={...old,intent:{...old.intent,idempotencyKey:'new'}};await f.repository.write(next);await f.repository.clear(old.intent.idempotencyKey);expect((await f.repository.read())?.intent.idempotencyKey).toBe('new');await expect(f.repository.write(old)).rejects.toThrow();
 });
});
