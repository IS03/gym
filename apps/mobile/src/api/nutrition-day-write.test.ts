import { describe,expect,it,jest } from '@jest/globals';
import { createMobileApiClient } from './client';
import { mutateNutritionDay,type DayWriteIntent } from './nutrition-day-write';
const response=(status:number,body:unknown)=>({status,ok:status>=200&&status<300,text:async()=>JSON.stringify(body)}) as Response;
function client(fetchImplementation:typeof fetch) {return createMobileApiClient({auth:{getAccessToken:async()=>({status:'ok',accessToken:'test-token'}),revalidateAfterUnauthorized:async()=>({status:'invalid'})},
  config:{appEnv:'development',baseUrl:'https://example.test',host:'example.test',timeoutMs:1000},fetchImplementation,
  runtime:{appVersion:'1',build:'1',platform:'ios'},telemetry:{record:()=>{}}});}

const intent:DayWriteIntent={operation:'context',date:'2026-10-02',idempotencyKey:'key',expectedUpdatedAt:'2026-10-02T12:00:00.123456Z',changes:{target:{action:'clear'}}};
describe('Day writes API',()=>{
 it('sends exact intent once, without retrying network loss',async()=>{
  const fetch=jest.fn<typeof globalThis.fetch>().mockRejectedValue(new Error('lost'));expect((await mutateNutritionDay(client(fetch),intent)).status).toBe('unavailable');expect(fetch).toHaveBeenCalledTimes(1);expect(JSON.parse(fetch.mock.calls[0][1]?.body as string)).toEqual(intent);
 });
 it('parses conflicts and rejects wrong date/kind receipts',async()=>{
  const fetch=jest.fn<typeof globalThis.fetch>().mockResolvedValueOnce(response(409,{error:'CONTEXT_CHANGED',message:'changed'})).mockResolvedValueOnce(response(200,{status:'saved',date:'2026-10-01',operation:'context'})).mockResolvedValueOnce(response(200,{status:'saved',date:intent.date,operation:'metrics'}));
  const api=client(fetch);expect((await mutateNutritionDay(api,intent)).status).toBe('conflict');expect((await mutateNutritionDay(api,intent)).status).toBe('unavailable');expect((await mutateNutritionDay(api,intent)).status).toBe('unavailable');
 });
});
