import { NutritionIntentRepository,type NutritionStoragePort } from './intent-repository';
import { parseSavedIntent,parseSavedReceipt,parsePersonalSavedMeal,type SavedIntent,type SavedReceipt,type PersonalSavedMeal } from '@/api/nutrition-saved';
import { parseSavedDraft,validateSavedDraft,type SavedDraft } from './saved-model';
export type StoredSavedIntent={version:1;intent:SavedIntent;draft:SavedDraft|null;editing:PersonalSavedMeal|null;receipt?:SavedReceipt};
function parseStored(v:unknown):StoredSavedIntent {
  if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('Invalid saved intent');
  const r=v as Record<string,unknown>,intent=parseSavedIntent(r.intent),draft=r.draft===null?null:parseSavedDraft(r.draft),receipt=r.receipt?parseSavedReceipt(r.receipt):undefined,editing=r.editing===null?null:parsePersonalSavedMeal(r.editing);
  if(r.version!==1||!intent||draft===undefined||editing===undefined||(intent.operation==='create'?editing!==null:!editing||editing.id!==intent.id||editing.version!==intent.expectedVersion)||intent.fields&&(!draft||JSON.stringify(validateSavedDraft(draft).fields)!==JSON.stringify(intent.fields))
    ||!intent.fields&&draft!==null||r.receipt&&(!receipt||receipt.operation!==intent.operation||intent.id&&receipt.id!==intent.id))throw new Error('Invalid saved intent');
  return {version:1,intent,draft,editing,...(receipt?{receipt}:{})};
}
export class SavedIntentRepository extends NutritionIntentRepository<StoredSavedIntent> {
  constructor(port:NutritionStoragePort,userId:string){super(port,`ownlevel.nutrition.saved.v1.${encodeURIComponent(userId)}`,parseStored);}
}
