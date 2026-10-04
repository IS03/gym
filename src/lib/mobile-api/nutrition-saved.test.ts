import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NextRequest} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {MobileApiUnauthorizedError} from './auth';
import {parseSavedFields,parseSavedIntent,parsePersonalSavedMeal} from './nutrition-saved-contract';
vi.mock('server-only',()=>({}));vi.mock('./supabase',()=>({authenticateMobileMutationAccessToken:vi.fn()}));
import {authenticateMobileMutationAccessToken} from './supabase';
import {GET,POST} from '@/app/api/mobile/v1/nutrition/saved-meals/route';
import {GET as detail,PATCH,DELETE} from '@/app/api/mobile/v1/nutrition/saved-meals/[id]/route';
const id='42300000-0000-4000-8000-000000000001',version='a'.repeat(64),time='2026-10-04T00:00:00.123456Z';
const fields={name:'Café',description:null,templateType:'manual',calories:null,proteinG:0,carbsG:null,fatG:1.25,items:[]};
const raw={id,user_id:id,name:'CAFÉ',description:null,template_type:'manual',calories:null,protein_g:0,carbs_g:null,fat_g:1.25,is_active:true,created_at:time,updated_at:time,items:[],version};
const intent={operation:'create',id:null,expectedVersion:null,fields,idempotencyKey:'saved:1'},rpc=vi.fn(),ctx={params:Promise.resolve({id})};
const request=(path='/saved-meals',method='GET',body:unknown=undefined,auth='Bearer token')=>new NextRequest(`https://ownlevel.fit/api/mobile/v1/nutrition${path}`,{method,headers:{authorization:auth,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
beforeEach(()=>{vi.clearAllMocks();vi.mocked(authenticateMobileMutationAccessToken).mockResolvedValue({userId:id,supabase:{rpc}} as never);});
describe('Saved Meal management API',()=>{
 it('nullable manual calories, explicit zero, normalization and composite bounds',()=>{
  expect(parseSavedFields(fields)).toMatchObject({name:'CAFÉ',calories:null,proteinG:0});
  const ingredient={kind:'food',id,version,quantity:0.25},composed={...fields,templateType:'composite',proteinG:null,fatG:null,items:[ingredient]};
  expect(parseSavedFields(composed)).toBeDefined();
  for(const patch of [{items:[]},{items:[ingredient,ingredient]},{items:[{...ingredient,quantity:0.125}]},{calories:22.5}])expect(parseSavedFields({...composed,...patch})).toBeUndefined();
  expect(parseSavedFields({...fields,proteinG:null,fatG:null})).toBeUndefined();expect(parseSavedIntent({...intent,user_id:id})).toBeUndefined();
  expect(parseSavedIntent({...intent,fields:{...composed,items:[{kind:'snapshot',id,quantity:1}]}})).toBeUndefined();
 });
 it('private auth precedes reads and writes',async()=>{
  expect((await GET(request('/saved-meals','GET',undefined,''))).status).toBe(401);expect(rpc).not.toHaveBeenCalled();
  vi.mocked(authenticateMobileMutationAccessToken).mockRejectedValueOnce(new MobileApiUnauthorizedError());expect((await POST(request('/saved-meals','POST',intent))).status).toBe(401);
 });
 it('filters/search ignore accents/case and unavailable differs from empty',async()=>{
  for(const [q,n] of [['?q=cafe',1],['?filter=archived',1],['?filter=all',2],['?q=no',0]] as const){rpc.mockResolvedValueOnce({data:[raw,{...raw,id:'42300000-0000-4000-8000-000000000002',is_active:false}],error:null});const r=await GET(request('/saved-meals'+q));expect(r.status).toBe(200);const body=await r.json();expect(body.meals).toHaveLength(n);if(n)expect(body.meals[0].user_id).toBeUndefined();expect(r.headers.get('cache-control')).toBe('no-store');}
  rpc.mockResolvedValueOnce({data:[],error:null});expect(await (await GET(request())).json()).toEqual({status:'ok',meals:[]});
  rpc.mockResolvedValueOnce({data:null,error:{code:'unavailable'}});expect((await GET(request())).status).toBe(503);
  expect((await GET(request('/saved-meals?user_id='+id))).status).toBe(400);
 });
 it('real GET serialization omits optional UUID for catalog and preserves detail ID',async()=>{
  const urls:URL[]=[];const supabase=createClient('https://example.supabase.co','public-test-key',{auth:{persistSession:false},global:{fetch:async input=>{const url=new URL(String(input));urls.push(url);return new Response(JSON.stringify([raw]),{headers:{'content-type':'application/json'}});}}});
  vi.mocked(authenticateMobileMutationAccessToken).mockResolvedValue({userId:id,supabase} as never);
  expect((await GET(request())).status).toBe(200);expect(urls[0].searchParams.has('p_id')).toBe(false);expect((await detail(request(),ctx)).status).toBe(200);expect(urls[1].searchParams.get('p_id')).toBe(id);
 });
 it('component snapshots preserve fractional base calories, unknown and zero',async()=>{
  const item={id,saved_meal_id:id,user_id:id,label:'FOOD',quantity:1,unit:'g',base_quantity:0.125,base_calories:22.5,base_protein_g:null,base_carbs_g:0,base_fat_g:0.1111,source_food_id:id,position:0};
  rpc.mockResolvedValueOnce({data:[{...raw,template_type:'composite',items:[item]}],error:null});const r=await detail(request(),ctx);expect(r.status).toBe(200);const dto=(await r.json()).meal;expect(dto.items[0]).toMatchObject({baseCalories:22.5,baseQuantity:0.125,baseProteinG:null,baseCarbsG:0,baseFatG:0.1111});expect(parsePersonalSavedMeal(dto)).toBeDefined();expect(dto.items[0].user_id).toBeUndefined();
 });
 it.each(['create','update','archive','reactivate','delete'])('%s version/receipt is correlated',async operation=>{
  const i={...intent,operation,id:operation==='create'?null:id,expectedVersion:operation==='create'?null:version,fields:['create','update'].includes(operation)?fields:null};
  const receipt={status:'confirmed',operation,id,version:operation==='delete'?null:version,updatedAt:operation==='delete'?null:time};rpc.mockResolvedValueOnce({data:[{response_status:201,response_body:receipt,replayed:true}],error:null});
  const r=operation==='create'?await POST(request('/saved-meals','POST',i)):await (operation==='delete'?DELETE:PATCH)(request('/saved-meals/'+id,operation==='delete'?'DELETE':'PATCH',i),ctx);expect(r.status).toBe(201);expect(await r.json()).toEqual(receipt);expect(rpc).toHaveBeenCalledWith('mobile_mutate_saved_meal',{p_intent:parseSavedIntent(i)});
 });
 it.each(['SAVED_CHANGED','SAVED_UNAVAILABLE','SAVED_NAME_EXISTS','SAVED_FOOD_CHANGED','SAVED_FOOD_UNAVAILABLE','IDEMPOTENCY_KEY_REUSED'])('%s is explicit',async error=>{rpc.mockResolvedValueOnce({data:[{response_status:409,response_body:{error,message:'Review'}}],error:null});expect((await POST(request('/saved-meals','POST',intent))).status).toBe(409);});
 it('malformed response never masquerades as a confirmed write',async()=>{rpc.mockResolvedValueOnce({data:[{response_status:201,response_body:{status:'confirmed',operation:'delete',id,version:null,updatedAt:null}}],error:null});expect((await POST(request('/saved-meals','POST',intent))).status).toBe(503);});
});
