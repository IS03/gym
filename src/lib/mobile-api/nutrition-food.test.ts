import { beforeEach,describe,expect,it,vi } from 'vitest';
import { NextRequest } from 'next/server';
import { MobileApiUnauthorizedError } from './auth';
import { parseFoodFields,parseFoodIntent,parsePersonalFood,parseFoodsResponse } from './nutrition-food-contract';
import { parseQuickIntent,parseQuickSelection } from './nutrition-quick-contract';
vi.mock('server-only',()=>({}));vi.mock('./supabase',()=>({authenticateMobileMutationAccessToken:vi.fn()}));
import { authenticateMobileMutationAccessToken } from './supabase';
import { GET,POST,OPTIONS } from '@/app/api/mobile/v1/nutrition/foods/route';
import { GET as detail,PATCH,DELETE } from '@/app/api/mobile/v1/nutrition/foods/[id]/route';
const id='42200000-0000-4000-8000-000000000001',version='a'.repeat(64),time='2026-10-04T02:00:00.123456Z';
const fields={name:'Café',description:null,servingQuantity:0.125,servingUnit:'unidad',calories:22.5,proteinG:null,carbsG:1.11,fatG:0,sourceNote:null};
const raw={id,user_id:id,name:'CAFÉ',description:null,serving_quantity:0.125,serving_unit:'unidad',calories:22.5,protein_g:null,carbs_g:1.11,fat_g:0,precision_level:'label',source_note:null,is_active:true,created_at:time,updated_at:time,version};
const intent={operation:'create',id:null,expectedVersion:null,fields,idempotencyKey:'food:1'};
const rpc=vi.fn(),ctx={params:Promise.resolve({id})};
const request=(path='/foods',method='GET',body:unknown=undefined,auth='Bearer token')=>new NextRequest(`https://ownlevel.fit/api/mobile/v1/nutrition${path}`,{method,headers:{authorization:auth,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(authenticateMobileMutationAccessToken).mockResolvedValue({userId:id,supabase:{rpc}} as never);});
describe('Personal Foods Mobile API',()=>{
 it('catalog fields preserve fractional calories/base/null/zero with explicit limits',()=>{
  expect(parseFoodFields(fields)).toMatchObject({name:'CAFÉ',calories:22.5,servingQuantity:0.125,proteinG:null,fatG:0});
  for(const patch of [{servingQuantity:0},{servingQuantity:1.2345},{calories:1.234},{proteinG:1000000},{calories:null,proteinG:null,carbsG:null,fatG:null},{user_id:id}])expect(parseFoodFields({...fields,...patch})).toBeUndefined();
  expect(parseFoodIntent(intent)).toBeDefined();expect(parseFoodIntent({...intent,user_id:id})).toBeUndefined();
  expect(parsePersonalFood({...fields,id,version,precisionLevel:'label',isActive:true,createdAt:time,updatedAt:time})).toBeDefined();
  expect(parseFoodsResponse({status:'ok',foods:[]})).toEqual({status:'ok',foods:[]});expect(parseFoodsResponse({status:'ok',foods:[{}]})).toBeUndefined();
 });
 it('expands only food quantity to three decimals and keeps old source rules',()=>{
  const s={date:'2026-10-03',source:{kind:'food',id,version},quantities:[{itemId:id,quantity:0.125}]};
  expect(parseQuickSelection(s)).toEqual(s);expect(parseQuickIntent({...s,operation:'register',idempotencyKey:'food-reg:1'})).toBeDefined();
  expect(parseQuickSelection({...s,source:{...s.source,kind:'saved'}})).toBeUndefined();expect(parseQuickIntent({...s,operation:'saveSuggestion',idempotencyKey:'key'})).toBeUndefined();
  expect(parseQuickSelection({...s,quantities:null})).toBeUndefined();expect(parseQuickSelection({...s,quantities:[{itemId:'42200000-0000-4000-8000-000000000002',quantity:1}]})).toBeUndefined();
  expect(parseQuickSelection({...s,quantities:[{itemId:id,quantity:1.2345}]})).toBeUndefined();
 });
 it('auth required before reads/writes and no client ownership accepted',async()=>{
  expect((await GET(request('/foods','GET',undefined,''))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();
  vi.mocked(authenticateMobileMutationAccessToken).mockRejectedValueOnce(new MobileApiUnauthorizedError());expect((await POST(request('/foods','POST',intent))).status).toBe(401);
  expect((await POST(request('/foods','POST',{...intent,user_id:id}))).status).toBe(400);
 });
 it('search ignores case/accents, preserves ordering and separates active/archive/all',async()=>{
  const archived={...raw,id:'42200000-0000-4000-8000-000000000002',is_active:false};
  for(const [query,count] of [['?q=cafe',1],['?filter=archived&q=CAFE',1],['?filter=all&q=CaFé',2],['?q=arroz',0]] as const){
   rpc.mockResolvedValueOnce({data:[raw,archived],error:null});const response=await GET(request('/foods'+query));expect(response.status).toBe(200);
   const body=await response.json();expect(body.foods).toHaveLength(count);if(count)expect(body.foods[0].user_id).toBeUndefined();expect(response.headers.get('cache-control')).toBe('no-store');
  }
  expect((await GET(request('/foods?filter=global'))).status).toBe(400);
  expect(rpc).toHaveBeenCalledWith('mobile_read_foods',{p_id:null},{get:true});
 });
 it('detail includes archived truth; absent is explicit and errors never become empty',async()=>{
  rpc.mockResolvedValueOnce({data:[{...raw,is_active:false}],error:null});expect(await (await detail(request(),ctx)).json()).toMatchObject({food:{isActive:false}});
  rpc.mockResolvedValueOnce({data:[],error:null});expect(await (await detail(request(),ctx)).json()).toEqual({status:'ok',food:null});
  for(const result of [{data:null,error:{code:'unavailable'}},{data:[{...raw,protein_g:undefined}],error:null}]){rpc.mockResolvedValueOnce(result);expect((await GET(request())).status).toBe(503);}
 });
 it.each(['create','update','archive','reactivate','delete'])('%s is explicit, versioned and uses one RPC/receipt',async operation=>{
  const i={...intent,operation,id:operation==='create'?null:id,expectedVersion:operation==='create'?null:version,fields:['create','update'].includes(operation)?fields:null};
  const receipt={status:'confirmed',operation,id,version:operation==='delete'?null:version,updatedAt:operation==='delete'?null:time};
  rpc.mockResolvedValueOnce({data:[{response_status:201,response_body:receipt,replayed:true}],error:null});
  const response=operation==='create'?await POST(request('/foods','POST',i)):await (operation==='delete'?DELETE:PATCH)(request('/foods/'+id,operation==='delete'?'DELETE':'PATCH',i),ctx);
  expect(response.status).toBe(201);expect(await response.json()).toEqual(receipt);expect(rpc).toHaveBeenCalledWith('mobile_mutate_food',{p_intent:parseFoodIntent(i)});
 });
 it.each(['FOOD_CHANGED','FOOD_UNAVAILABLE','FOOD_NAME_EXISTS','IDEMPOTENCY_KEY_REUSED'])('%s remains an explicit conflict',async error=>{
  rpc.mockResolvedValueOnce({data:[{response_status:409,response_body:{error,message:'review'}}],error:null});expect((await POST(request('/foods','POST',intent))).status).toBe(409);
 });
 it('ambiguous RPC/schema mismatch is unavailable and preflight stays private',async()=>{
  rpc.mockResolvedValueOnce({data:null,error:{code:'57014'}});expect((await POST(request('/foods','POST',intent))).status).toBe(503);
  rpc.mockResolvedValueOnce({data:[{response_status:201,response_body:{status:'confirmed',operation:'delete',id,version:null,updatedAt:null}}],error:null});expect((await POST(request('/foods','POST',intent))).status).toBe(503);
  expect((await OPTIONS(request('/foods','OPTIONS'))).status).toBe(204);
 });
});
