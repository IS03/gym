import { describe, expect, it, jest } from '@jest/globals';
import { createMobileApiClient } from './client';
import { mutateManualMeal, type MealMutationIntent } from './nutrition-meal';
const date='2026-10-03', id='41200000-0000-4000-8000-000000000001', version='2026-10-03T12:00:00.123456Z';
const intent: MealMutationIntent={operation:'edit',sourceDate:date,mealId:id,expectedUpdatedAt:version,idempotencyKey:'same-intent',
  fields:{date,title:null,description:null,calories:200,proteinG:null,carbsG:0,fatG:null},forceDuplicate:false};
const response=(status:number,body:unknown)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body)}) as Response;
function client(fetchImplementation:typeof fetch) {return createMobileApiClient({auth:{getAccessToken:async()=>({status:'ok',accessToken:'test-token'}),revalidateAfterUnauthorized:async()=>({status:'invalid'})},
  config:{appEnv:'development',baseUrl:'https://example.test',host:'example.test',timeoutMs:1000},fetchImplementation,
  runtime:{appVersion:'1',build:'1',platform:'ios'},telemetry:{record:()=>{}}});}
describe('Meal API request/recovery contract',()=>{
  it('sends observed version and exact intent once without retrying network ambiguity',async()=>{
    const fetch=jest.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('connection lost'));
    const result=await mutateManualMeal(client(fetch),intent);
    expect(result.status).toBe('unavailable'); expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1]?.method).toBe('PATCH'); expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual(intent);
  });
  it('parses a real moved-date CAS conflict for server truth recovery',async()=>{
    const body={error:'MEAL_CHANGED',message:'changed',currentDate:'2026-10-02'};
    const fetch=jest.fn<typeof globalThis.fetch>().mockResolvedValue(response(409,body));
    expect(await mutateManualMeal(client(fetch),intent)).toMatchObject({status:'conflict',code:'MEAL_CHANGED',data:body});
  });
  it('malformed conflict and mismatched receipt remain ambiguous',async()=>{
    const fetch=jest.fn<typeof globalThis.fetch>().mockResolvedValueOnce(response(409,{error:'MEAL_CHANGED',message:'changed'}))
      .mockResolvedValueOnce(response(200,{status:'saved',mealId:id,sourceDate:date,destinationDate:'2026-10-02',updatedAt:version}));
    const api=client(fetch);
    expect((await mutateManualMeal(api,intent)).status).toBe('unavailable'); expect((await mutateManualMeal(api,intent)).status).toBe('unavailable');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
