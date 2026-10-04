import {NutritionIntentRepository,type NutritionStoragePort} from './intent-repository';
import {parseConfigIntent,parseConfigReceipt,configRecord,type ConfigIntent,type ConfigReceipt} from '@/api/nutrition-config';
import {validateConfigurationDraft,type ConfigDraft} from './config-model';
export type StoredConfigIntent={version:1;intent:ConfigIntent;draft:ConfigDraft;receipt?:ConfigReceipt};
function parseStored(v:unknown):StoredConfigIntent {
 if(!configRecord(v))throw new Error('Invalid configuration intent');
 const i=parseConfigIntent(v.intent),r=v.receipt?parseConfigReceipt(v.receipt):undefined;
 if(v.version!==1||!i||!configRecord(v.draft)||Object.values(v.draft).some(t=>typeof t!=='string')||JSON.stringify(validateConfigurationDraft(i.operation,v.draft as ConfigDraft).fields)!==JSON.stringify(i.fields)||v.receipt&&(!r||r.operation!==i.operation||r.date!==i.date))throw new Error('Invalid configuration intent');
 return {version:1,intent:i,draft:v.draft as ConfigDraft,...(r?{receipt:r}:{})};
}
export class ConfigurationIntentRepository extends NutritionIntentRepository<StoredConfigIntent>{
 constructor(port:NutritionStoragePort,userId:string){super(port,`ownlevel.nutrition.config.v1.${encodeURIComponent(userId)}`,parseStored);}
}
