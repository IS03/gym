import {describe,expect,it,jest} from '@jest/globals';
import type {MobileApiClient} from './client';
import {fetchNutritionConfig,fetchPhysicalProfile,mutateNutritionConfig,parseNutritionConfig} from './nutrition-config';
import {configFixture} from '@/nutrition/config-fixture.test-helper';
describe('configuration runtime API',()=>{
 it('separate physical profile endpoint is shared, reads and receipts correlate operation/date',async()=>{
  const read=jest.fn<MobileApiClient['read']>(),request=jest.fn<MobileApiClient['request']>(),client={read,request} as unknown as MobileApiClient;
  await fetchNutritionConfig(client);expect(read.mock.calls[0][0].path).toBe('/api/mobile/v1/nutrition/config');expect(read.mock.calls[0][0].parse(configFixture)).toEqual(configFixture);
  await fetchPhysicalProfile(client);expect(read.mock.calls[1][0].path).toBe('/api/mobile/v1/profile/physical');expect(read.mock.calls[1][0].parse({today:configFixture.today,physical:configFixture.physical})).toEqual({today:configFixture.today,physical:configFixture.physical});
  const intent={operation:'physical' as const,date:configFixture.today,expectedVersion:'a'.repeat(64),idempotencyKey:'config:physical',fields:{birthDate:null,sex:null,heightCm:180,weightKg:0}};
  await mutateNutritionConfig(client,intent);expect(request.mock.calls[0][0]).toMatchObject({method:'PATCH',path:'/api/mobile/v1/profile/physical',body:intent});
  const parse=request.mock.calls[0][0].parse,receipt={status:'confirmed',operation:'physical',date:intent.date,version:'b'.repeat(64),weightRecorded:true};expect(parse(receipt)).toEqual(receipt);expect(parse({...receipt,date:'2026-10-03'})).toBeUndefined();expect(parse({...receipt,operation:'plan'})).toBeUndefined();
 });
 it('unavailable differs from missing and never synthesizes a saved plan',()=>{
  expect(parseNutritionConfig({...configFixture,plan:{status:'unavailable'}})?.plan.status).toBe('unavailable');expect(parseNutritionConfig({...configFixture,physical:{status:'ok',data:{}}})).toBeUndefined();
  expect(parseNutritionConfig({...configFixture,plan:{status:'ok',data:{...(configFixture.plan.status==='ok'?configFixture.plan.data:{} as never),weekdays:[]}}})).toBeUndefined();
 });
});
