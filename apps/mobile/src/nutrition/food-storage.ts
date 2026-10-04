import { NutritionIntentRepository,type NutritionStoragePort } from './intent-repository';
import { parseFoodIntent,parseFoodReceipt,parsePersonalFood,type FoodIntent,type FoodReceipt,type PersonalFood } from '@/api/nutrition-food';
import { parseFoodDraft,validateFoodDraft,type FoodDraft } from './food-model';
export type StoredFoodIntent={version:1;intent:FoodIntent;draft:FoodDraft|null;editing:PersonalFood|null;receipt?:FoodReceipt};
function parseStored(v:unknown):StoredFoodIntent {
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid food intent');
  const r=v as Record<string,unknown>,intent=parseFoodIntent(r.intent),draft=r.draft===null?null:parseFoodDraft(r.draft),receipt=r.receipt?parseFoodReceipt(r.receipt):undefined,editing=r.editing===null?null:parsePersonalFood(r.editing);
  if(r.version!==1||!intent||draft===undefined||editing===undefined||(intent.operation==='create'?editing!==null:!editing||editing.id!==intent.id||editing.version!==intent.expectedVersion)||intent.fields&&(!draft||JSON.stringify(validateFoodDraft(draft).fields)!==JSON.stringify(intent.fields))
    ||!intent.fields&&draft!==null||r.receipt&&(!receipt||receipt.operation!==intent.operation||intent.id&&receipt.id!==intent.id))throw new Error('Invalid food intent');
  return {version:1,intent,draft,editing,...(receipt?{receipt}:{})};
}
export class FoodIntentRepository extends NutritionIntentRepository<StoredFoodIntent> {
  constructor(port:NutritionStoragePort,userId:string){super(port,`ownlevel.nutrition.food.v1.${encodeURIComponent(userId)}`,parseStored);}
}
