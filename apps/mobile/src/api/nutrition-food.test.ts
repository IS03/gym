import { describe,expect,it,jest } from '@jest/globals';
import type { MobileApiClient } from './client';
import { fetchFood,fetchFoods,mutateFood,foodQuickOption,parsePersonalFood,parseFoodsResponse } from './nutrition-food';
import { parseQuickSelection,parseQuickPreview } from './nutrition-quick';
import { personalFood,foodId,foodReceipt } from '@/nutrition/food-fixture.test-helper';
import { foodDraft,validateFoodDraft } from '@/nutrition/food-model';
describe('Foods API runtime boundaries',()=>{
 it('rejects malformed definitions, retains unknown/zero and creates discriminated food source',()=>{
  expect(parsePersonalFood(personalFood)).toEqual(personalFood);expect(parsePersonalFood({...personalFood,version:'old'})).toBeUndefined();
  expect(parseFoodsResponse({status:'ok',foods:[]})).toEqual({status:'ok',foods:[]});expect(parseFoodsResponse({status:'unavailable'})).toBeUndefined();
  const option=foodQuickOption(personalFood),selection={date:'2026-10-03',source:option.source,quantities:[{itemId:foodId,quantity:0.125}]};
  expect(parseQuickSelection(selection)).toEqual(selection);
  const snapshot={title:personalFood.name,description:'0,125 UNIDAD',calories:23,proteinG:null,carbsG:1.11,fatG:0,contextType:'food_quantity',precision:'label',sourceNote:'Fuente'};
  expect(parseQuickPreview({status:'preview',selection,snapshot,items:[{...option.items[0],...snapshot}]})).toBeDefined();
 });
 it('encodes search/filter and rejects wrong source or operation in responses',async()=>{
  const read=jest.fn<MobileApiClient['read']>(),request=jest.fn<MobileApiClient['request']>();const client={read,request} as unknown as MobileApiClient;
  await fetchFoods(client,'archived','café');expect(read).toHaveBeenCalledWith(expect.objectContaining({path:'/api/mobile/v1/nutrition/foods?filter=archived&q=caf%C3%A9'}));
  await fetchFood(client,foodId);const detailParser=read.mock.calls[1][0].parse;expect(detailParser({status:'ok',food:{...personalFood,id:'42200000-0000-4000-8000-000000000002'}})).toBeUndefined();
  await mutateFood(client,{operation:'create',id:null,expectedVersion:null,fields:validateFoodDraft(foodDraft(personalFood)).fields!,idempotencyKey:'food:1'});
  const receiptParser=request.mock.calls[0][0].parse;expect(receiptParser(foodReceipt)).toEqual(foodReceipt);expect(receiptParser({...foodReceipt,operation:'update'})).toBeUndefined();expect(request).toHaveBeenCalledTimes(1);
 });
});
