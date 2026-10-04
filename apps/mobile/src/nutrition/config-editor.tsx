import {Alert,KeyboardAvoidingView,Modal,Platform,StyleSheet,TextInput,View} from 'react-native';
import {AppText,Button,Heading,LoadingState,ScrollScreen,Surface,spacing,useOwnlevelTheme} from '@/design-system';
import type {ConfigOperation,NutritionConfig} from '@/api/nutrition-config';
import type {ConfigurationController,ConfigState} from './config-controller';
import type {ConfigDraft} from './config-model';
const WEEKDAYS=['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map((label,i)=>({label,value:i+1}));
const shown=(n:number|null)=>n===null?'Sin dato':`${n} kcal`;
const titles:Record<ConfigOperation,string>={plan:'Plan nutricional',energy:'Energía',physical:'Datos físicos'};
function Field({label,value,onChange,disabled,error,numeric=true}:{label:string;value:string;onChange:(v:string)=>void;disabled:boolean;error?:string;numeric?:boolean}){
 const {colors}=useOwnlevelTheme();return <View style={styles.field}><AppText variant="label">{label}</AppText><TextInput accessibilityLabel={label} value={value} editable={!disabled} onChangeText={onChange} keyboardType={numeric?'decimal-pad':'default'} autoCapitalize={numeric?'none':'sentences'} style={[styles.input,{color:colors.text,borderColor:error?colors.danger:colors.border}]}/>{error?<AppText accessibilityRole="alert">{error}</AppText>:null}</View>;
}
// Shared physical editor: M8 can use this surface and the profile/physical API.
export function PhysicalProfileFields({draft,change,locked,errors,hasHistory}:{draft:ConfigDraft;change:(k:string,v:string)=>void;locked:boolean;errors:Record<string,string>;hasHistory:boolean}){
 return <><AppText muted>Si cambiás el peso, se registra para hoy. Los valores históricos permanecen.</AppText>
  <Field label="Nacimiento (AAAA-MM-DD)" numeric={false} value={draft.birthDate} disabled={locked} error={errors.birthDate} onChange={v=>change('birthDate',v)}/>
  <AppText variant="label">Sexo</AppText>{([['','Sin dato'],['male','Masculino'],['female','Femenino'],['other','Otro']] as const).map(([v,l])=><Button key={v} label={`${draft.sex===v?'✓ ':''}${l}`} disabled={locked} variant="secondary" onPress={()=>change('sex',v)}/>)}
  <Field label="Altura (cm)" value={draft.heightCm} disabled={locked} error={errors.heightCm} onChange={v=>change('heightCm',v)}/>
  <Field label="Peso (kg)" value={draft.weightKg} disabled={locked} error={errors.weightKg} onChange={v=>change('weightKg',v)}/>
  {hasHistory?<AppText muted>El peso con historial no puede quitarse desde este formulario.</AppText>:null}
 </>;
}
function Truth({config,op}:{config:NutritionConfig;op:ConfigOperation}){
 const s=config[op];if(s.status!=='ok')return <AppText>No pudimos obtener la configuración actual.</AppText>;
 if(op==='plan'&&config.plan.status==='ok'){const d=config.plan.data;return <><AppText>{d.name}</AppText>{d.weekdays.map(w=><AppText key={w.weekday}>{`${WEEKDAYS[w.weekday-1].label}: ${w.calorieTargetKcal??'sin dato'} kcal · ${w.proteinTargetG??'sin dato'} g proteína`}</AppText>)}<AppText>{`Agua ${d.baseWaterL??'sin dato'} L · Extra entrenamiento ${d.trainingCalorieDeltaKcal} kcal / ${d.trainingWaterDeltaL} L`}</AppText></>;}
 if(op==='energy'&&config.energy.status==='ok'){const d=config.energy.data;return <><AppText>{`Actividad ${d.activityLevel} · ${d.baseExpenditureMode==='custom'?'Personalizado':'Automático'}`}</AppText><AppText>{`BMR ${shown(d.bmrKcal)} · Base automática ${shown(d.automaticBaseKcal)} · Base usada ${shown(d.usedBaseKcal)}`}</AppText><AppText>{`Personalizado ${shown(d.customBaseExpenditureKcal)} · Extra ${shown(d.trainingExpenditureDeltaKcal)}`}</AppText></>;}
 if(config.physical.status!=='ok')return null;const d=config.physical.data;return <><AppText>{`Nacimiento ${d.birthDate??'sin dato'} · Sexo ${d.sex??'sin dato'}`}</AppText><AppText>{`Altura ${d.heightCm??'sin dato'} cm · Peso ${d.weightKg??'sin dato'} kg · BMR ${shown(d.bmrKcal)}`}</AppText></>;
}
export function ConfigurationEditor({controller,state}:{controller:ConfigurationController;state:ConfigState}){
 if(!state.open)return null;
 const pending=state.phase==='pending',locked=state.phase!=='idle'||!!state.intent;
 const leave=(action:()=>void)=>{if(pending)return;if(controller.dirty()&&!state.intent)Alert.alert('¿Descartar cambios?','Estos cambios todavía no están guardados.',[{text:'Seguir revisando',style:'cancel'},{text:'Descartar',style:'destructive',onPress:action}]);else action();};
 const field=(key:string,label:string,numeric=true)=><Field key={key} label={label} value={state.draft![key]} disabled={locked} error={state.errors[key]} numeric={numeric} onChange={v=>controller.change(key,v)}/>;
 const op=state.operation,draft=state.draft,config=state.config;
 return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={()=>leave(()=>controller.close())}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollScreen safeAreaEdges={['top','left','right','bottom']} testID="nutrition-config-editor">
 <Heading level={2}>{op?titles[op]:'Configurar nutrición'}</Heading><AppText variant="label">Desde hoy{config?` · ${config.today}`:''}</AppText>
 <AppText muted>Configuración general. Los ajustes de un día y el historial permanecen independientes.</AppText>
 {state.loading?<LoadingState label="Actualizando configuración"/>:null}
 {state.readError?<Surface><AppText accessibilityRole="alert">No pudimos actualizar la configuración. Tu borrador sigue intacto.</AppText><Button label="Reintentar lectura" onPress={()=>void controller.load()}/></Surface>:null}
 {!op&&config?(['plan','energy','physical'] as const).map(key=><Surface key={key}><Heading level={2}>{titles[key]}</Heading>{config[key].status==='ok'?<>
  {key!=='physical'?<AppText muted>{config[key].data.source==='v2'?'Plan V2 vigente':config[key].data.source==='legacy'?'Configuración heredada. Guardar adopta V2 desde hoy; algunas reglas anteriores no tienen equivalencia exacta.':'Todavía no hay configuración guardada.'}</AppText>:null}
  {key!=='physical'&&config[key].data.effectiveFrom?<AppText muted>{`Vigente desde ${config[key].data.effectiveFrom}`}</AppText>:null}<Truth config={config} op={key}/><Button label={`Editar ${titles[key].toLowerCase()}`} disabled={locked||state.loading||state.readError} onPress={()=>controller.begin(key)}/>
 </>:<AppText>No disponible. Reintentá la lectura.</AppText>}</Surface>):null}
 {op&&draft?<>
  {op==='plan'?<>{field('name','Nombre de etapa',false)}{WEEKDAYS.map(w=><Surface key={w.value}><AppText variant="label">{w.label}</AppText>{field(`calories${w.value}`,`${w.label} · Calorías (kcal)`)}{field(`protein${w.value}`,`${w.label} · Proteína (g)`)}</Surface>)}
   {field('baseWaterL','Agua base (L)')}{field('trainingCalorieDeltaKcal','Extra de objetivo por entrenamiento (kcal)')}{field('trainingWaterDeltaL','Extra de agua por entrenamiento (L)')}
   <AppText muted>Los extras se aplican cuando hay entrenamiento finalizado. El agua del plan no cambia el objetivo de la métrica Agua.</AppText></>:null}
  {op==='energy'?<>
   <AppText variant="label">Actividad cotidiana</AppText>{([['low','Baja'],['moderate','Moderada'],['high','Alta']] as const).map(([v,l])=><Button key={v} label={`${draft.activityLevel===v?'✓ ':''}${l}`} disabled={locked} variant="secondary" onPress={()=>controller.change('activityLevel',v)}/>)}
   <AppText variant="label">Gasto base</AppText>{([['automatic','Automático'],['custom','Personalizado']] as const).map(([v,l])=><Button key={v} label={`${draft.baseExpenditureMode===v?'✓ ':''}${l}`} disabled={locked} variant="secondary" onPress={()=>controller.change('baseExpenditureMode',v)}/>)}
   <AppText muted>Automático usa tu BMR y actividad cotidiana. Personalizado usa el valor que indicás; ambos requieren datos físicos para calcular BMR.</AppText>
   {config?.energy.status==='ok'?<Surface><AppText>{`BMR: ${shown(config.energy.data.bmrKcal)}`}</AppText><AppText>{`Base automática guardada: ${shown(config.energy.data.automaticBaseKcal)}`}</AppText><AppText>{`Base usada guardada: ${shown(config.energy.data.usedBaseKcal)}`}</AppText></Surface>:null}
   {draft.baseExpenditureMode==='custom'?field('customBaseExpenditureKcal','Gasto base personalizado (kcal)'):null}{field('trainingExpenditureDeltaKcal','Extra de gasto por entrenamiento (kcal)')}
   <Button label="Editar datos físicos" disabled={locked} variant="secondary" onPress={()=>leave(()=>controller.begin('physical'))}/>
  </>:null}
  {op==='physical'?<PhysicalProfileFields draft={draft} change={(k,v)=>controller.change(k,v)} locked={locked} errors={state.errors} hasHistory={config?.physical.status==='ok'&&config.physical.data.hasWeightHistory}/>:null}
  {state.errors.form?<AppText accessibilityRole="alert">{state.errors.form}</AppText>:null}
  {!locked?<Button label={`Guardar ${titles[op].toLowerCase()}`} onPress={()=>void controller.save()}/>:null}
 </>:null}
 {state.message?<AppText accessibilityRole="alert">{state.message}</AppText>:null}
 {state.phase==='conflict'&&op?<Surface><Heading level={2}>Valores actuales del servidor</Heading>{config?<Truth config={config} op={op}/>:null}<Button label="Actualizar valores actuales" onPress={()=>void controller.load()} variant="secondary"/><Button label="Revisar mi borrador con esta versión" disabled={state.loading||state.readError||!config||config[op].status!=='ok'} onPress={()=>controller.reviewTruth()}/></Surface>:null}
 {['uncertain','confirmed','blocked'].includes(state.phase)?<Button label={state.intent?.receipt?'Actualizar lectura confirmada':'Comprobar intento guardado'} onPress={()=>void controller.recover()}/>:null}
 {pending?<LoadingState label="Guardando configuración"/>:null}
 {op&&!state.intent?<Button label="Volver a configuración" disabled={pending} variant="quiet" onPress={()=>leave(()=>controller.back())}/>:null}
 <Button label={state.intent?'Cerrar · conservar intento':'Cerrar configuración'} disabled={pending} variant="quiet" onPress={()=>leave(()=>controller.close())}/>
 </ScrollScreen></KeyboardAvoidingView></Modal>;
}
const styles=StyleSheet.create({screen:{flex:1},field:{gap:spacing.xs},input:{borderWidth:1,borderRadius:8,minHeight:48,padding:12}});
