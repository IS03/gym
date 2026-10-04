import {parseConfigFields,type ConfigOperation,type NutritionConfig,type PlanFields,type EnergyFields,type PhysicalFields} from '@/api/nutrition-config';
export type ConfigDraft=Record<string,string>;
const text=(n:unknown)=>n===null||n===undefined?'':String(n).replace('.',',');
export function configurationDraft(op:ConfigOperation,c:NutritionConfig):ConfigDraft|null {
 const section=c[op];if(section.status!=='ok')return null;
 if(op==='plan'&&c.plan.status==='ok'){
  const d=c.plan.data,r:ConfigDraft={name:d.name,baseWaterL:text(d.baseWaterL),trainingCalorieDeltaKcal:text(d.trainingCalorieDeltaKcal),trainingWaterDeltaL:text(d.trainingWaterDeltaL)};
  d.weekdays.forEach(w=>{r[`calories${w.weekday}`]=text(w.calorieTargetKcal);r[`protein${w.weekday}`]=text(w.proteinTargetG);});return r;
 }
 if(op==='energy'&&c.energy.status==='ok'){const d=c.energy.data;return {activityLevel:d.activityLevel,baseExpenditureMode:d.baseExpenditureMode,customBaseExpenditureKcal:text(d.customBaseExpenditureKcal),trainingExpenditureDeltaKcal:text(d.trainingExpenditureDeltaKcal)};}
 if(c.physical.status!=='ok')return null;const d=c.physical.data;
 return {birthDate:d.birthDate??'',sex:d.sex??'',heightCm:text(d.heightCm),weightKg:text(d.weightKg)};
}
export function validateConfigurationDraft(op:ConfigOperation,d:ConfigDraft):{fields?:PlanFields|EnergyFields|PhysicalFields;errors:Record<string,string>}{
 const errors:Record<string,string>={};
 const number=(key:string,min:number,max:number,digits=2,optional=false)=>{
  const value=d[key]?.trim()??'';if(optional&&!value)return null;
  const n=new RegExp(`^\\d+(?:[,.]\\d{1,${digits || 2}})?$`).test(value)?Number(value.replace(',','.')):NaN;
  if(!Number.isFinite(n)||n<min||n>max||digits===0&&!Number.isInteger(n))errors[key]=`Ingresá un valor entre ${min} y ${max}${digits?' (hasta '+digits+' decimales)':''}.`;
  return n;
 };
 let raw:unknown;
 if(op==='plan'){
  if(!d.name?.trim())errors.name='Completá el nombre de etapa.';
  raw={name:d.name,baseWaterL:number('baseWaterL',0,50),trainingCalorieDeltaKcal:number('trainingCalorieDeltaKcal',0,5000,0),trainingWaterDeltaL:number('trainingWaterDeltaL',0,20),weekdays:Array.from({length:7},(_,i)=>({weekday:i+1,calorieTargetKcal:number(`calories${i+1}`,1,20000,0),proteinTargetG:number(`protein${i+1}`,0,2000)}))};
 }else if(op==='energy')raw={activityLevel:d.activityLevel,baseExpenditureMode:d.baseExpenditureMode,customBaseExpenditureKcal:d.baseExpenditureMode==='custom'?number('customBaseExpenditureKcal',1,20000,0):null,trainingExpenditureDeltaKcal:number('trainingExpenditureDeltaKcal',0,5000,0)};
 else raw={birthDate:d.birthDate.trim()||null,sex:d.sex||null,heightCm:number('heightCm',50,250,0,true),weightKg:number('weightKg',0,999.99,2,true)};
 const fields=parseConfigFields(op,raw);if(!fields&&!Object.keys(errors).length)errors[op==='physical'?'birthDate':'form']='Revisá los datos y la fecha (AAAA-MM-DD).';
 return {fields:Object.keys(errors).length?undefined:fields,errors};
}
