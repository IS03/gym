import {describe,expect,it,jest} from '@jest/globals';
import type {MobileApiClient} from './client';
import {fetchSavedMeals,fetchSavedMeal,mutateSavedMeal,parseSavedList,parsePersonalSavedMeal} from './nutrition-saved';
import {personalSaved,savedReceipt,savedId} from '@/nutrition/saved-fixture.test-helper';
import {savedDraft,validateSavedDraft} from '@/nutrition/saved-model';
describe('Saved Meals runtime API boundaries',()=>{
 it('retains null/zero and rejects malformed definitions and false empty',()=>{expect(parsePersonalSavedMeal(personalSaved)).toEqual(personalSaved);expect(parsePersonalSavedMeal({...personalSaved,version:'old'})).toBeUndefined();expect(parseSavedList({status:'ok',meals:[]})).toEqual({status:'ok',meals:[]});expect(parseSavedList({status:'unavailable'})).toBeUndefined();});
 it('search/filter encoding and receipt/detail correlation use the existing client',async()=>{const read=jest.fn<MobileApiClient['read']>(),request=jest.fn<MobileApiClient['request']>(),client={read,request} as unknown as MobileApiClient;
  await fetchSavedMeals(client,'archived','café');expect(read).toHaveBeenCalledWith(expect.objectContaining({path:'/api/mobile/v1/nutrition/saved-meals?filter=archived&q=caf%C3%A9'}));await fetchSavedMeal(client,savedId);expect(read.mock.calls[1][0].parse({status:'ok',meal:{...personalSaved,id:'42300000-0000-4000-8000-000000000002'}})).toBeUndefined();
  await mutateSavedMeal(client,{operation:'create',id:null,expectedVersion:null,fields:validateSavedDraft(savedDraft(personalSaved)).fields!,idempotencyKey:'key'});const parse=request.mock.calls[0][0].parse;expect(parse(savedReceipt)).toEqual(savedReceipt);expect(parse({...savedReceipt,operation:'delete'})).toBeUndefined();expect(request).toHaveBeenCalledTimes(1);
 });
});
