import {useState} from 'react';
import {Alert,KeyboardAvoidingView,Modal,Platform,StyleSheet,TextInput,View} from 'react-native';
import {AppText,Button,Heading,LoadingState,ScrollScreen,Surface,spacing,useOwnlevelTheme} from '@/design-system';
import type {SavedController,SavedState} from './saved-controller';
import {draftTotals,ingredientBase,ingredientLabel,ingredientUnit,savedLabels} from './saved-model';
import {FoodSearchControls} from './food-search-controls';
const shown=(n:number|null)=>n===null?'sin dato':String(n).replace('.',',');
function Nutrition({calories,proteinG,carbsG,fatG}:{calories:number|null;proteinG:number|null;carbsG:number|null;fatG:number|null}){return <AppText>{`${shown(calories)} kcal · P ${shown(proteinG)} · C ${shown(carbsG)} · G ${shown(fatG)}`}</AppText>;}
export function SavedEditor({controller,state}:{controller:SavedController;state:SavedState}){
 const {colors}=useOwnlevelTheme();const [picker,setPicker]=useState(false),[search,setSearch]=useState('');
 if(!state.open)return null;
 const pending=state.phase==='pending'||state.phase==='loading',locked=state.phase!=='idle'||!!state.intent,d=state.draft;
 const discard=(action:()=>void)=>controller.dirty()&&!state.intent?Alert.alert('¿Descartar cambios?','Estos cambios de la plantilla no están guardados.',[{text:'Seguir editando',style:'cancel'},{text:'Descartar',style:'destructive',onPress:action}]):action();
 const close=()=>{if(!pending)discard(()=>{setPicker(false);controller.close();});};
 const action=(op:'archive'|'reactivate'|'delete')=>Alert.alert(op==='delete'?'¿Eliminar comida guardada?':op==='archive'?'¿Archivar plantilla?':'¿Reactivar plantilla?',`Las comidas ya registradas no cambian.${controller.dirty()?' Los cambios sin guardar se descartarán.':''}`,[{text:'Cancelar',style:'cancel'},{text:op==='delete'?'Eliminar':op==='archive'?'Archivar':'Reactivar',style:op==='delete'?'destructive':'default',onPress:()=>void controller.save(op)}]);
 const input=(key:keyof typeof savedLabels)=><View key={key} style={styles.field}><AppText variant="label">{savedLabels[key]}</AppText>
  <TextInput accessibilityLabel={savedLabels[key]} value={d![key]} editable={!locked} keyboardType={['calories','proteinG','carbsG','fatG'].includes(key)?'decimal-pad':'default'} multiline={key==='description'} onChangeText={v=>controller.change(key,v)} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
  {state.errors[key]?<AppText accessibilityRole="alert">{state.errors[key]}</AppText>:null}</View>;
 const totals=d&&draftTotals(d);
 const searchable=(s:string)=>s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toUpperCase();
 return <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}><KeyboardAvoidingView style={styles.screen} behavior={Platform.OS==='ios'?'padding':undefined}>
 <ScrollScreen safeAreaEdges={['top','left','right','bottom']} testID="saved-editor">
 <Heading level={2}>{picker?'Agregar ingrediente':state.mode==='browse'?'Comidas guardadas':state.mode==='create'?'Nueva comida guardada':'Editar comida guardada'}</Heading>
 <AppText muted>Plantillas personales. Las comidas registradas conservan su propio snapshot.</AppText>
 {picker?<><FoodSearchControls search={search} filter="active" onSearch={setSearch} onFilter={()=>{}} activeOnly/>
  {state.pickerLoading?<LoadingState label="Cargando alimentos"/>:null}
  {state.pickerError||state.pickerFoods===null&&!state.pickerLoading?<><AppText>No hay una lectura confirmada de alimentos.</AppText><Button label="Cargar alimentos" onPress={()=>void controller.loadFoods()}/></>:null}
  {state.pickerFoods?.filter(f=>searchable(f.name).includes(searchable(search.trim()))).map(f=><Surface key={f.id}><AppText variant="label">{f.name}</AppText><AppText>{`${f.servingQuantity} ${f.servingUnit} · ${shown(f.calories)} kcal base`}</AppText>
   <Button label={`Elegir ${f.name}`} disabled={locked||state.pickerLoading||state.pickerError||d?.items.some(i=>(i.food?.id??i.snapshot?.sourceFoodId)===f.id)} onPress={()=>{controller.addIngredient(f);setPicker(false);}}/></Surface>)}
  {state.pickerFoods?.length===0?<AppText>No tenés alimentos activos. Crealos en Administrar alimentos.</AppText>:null}
  {state.pickerFoods?.length&&!state.pickerFoods.some(f=>searchable(f.name).includes(searchable(search.trim())))?<AppText>No encontramos alimentos con esa búsqueda.</AppText>:null}
  <Button label="Volver a ingredientes" variant="quiet" onPress={()=>setPicker(false)}/>
 </>:state.mode==='browse'?<>
  <TextInput accessibilityLabel="Buscar guardada" placeholder="Buscar guardada" value={state.search} onChangeText={v=>controller.query(v)} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
  <View style={styles.field}>{(['active','archived','all'] as const).map((f,i)=><Button key={f} label={['Activas','Archivadas','Todas'][i]} variant={state.filter===f?'primary':'secondary'} onPress={()=>controller.setFilter(f)}/>)}</View>
  <Button label="Crear manual" disabled={locked} onPress={()=>controller.begin(undefined,'manual')}/><Button label="Crear compuesta" variant="secondary" disabled={locked} onPress={()=>controller.begin(undefined,'composite')}/>
  {state.listLoading?<LoadingState label="Cargando guardadas"/>:null}
  {state.listError?<AppText accessibilityRole="alert">No pudimos actualizar las guardadas. {state.meals?'Mostramos la última lectura.':''}</AppText>:null}
  {state.meals?.length===0&&!state.listError&&!state.listLoading?<AppText>{state.search?'Sin resultados para esa búsqueda.':'No tenés guardadas en este filtro.'}</AppText>:null}
  {state.meals?.map(m=><Surface key={m.id}><AppText variant="label">{m.name}</AppText><AppText muted>{`${m.templateType==='manual'?'Manual':'Compuesta'} · ${m.isActive?'Activa':'Archivada'}`}</AppText><Nutrition {...m}/>
   <Button label={`Editar ${m.name}`} disabled={locked||state.listError||state.listLoading} variant="secondary" onPress={()=>controller.begin(m)}/></Surface>)}
  <Button label="Actualizar guardadas" onPress={()=>void controller.load()} variant="secondary"/>
 </>:d?<>{input('name')}{input('description')}
  {d.templateType==='manual'?<><AppText muted>Vacío significa desconocido. 0 es un valor explícito. Para registrar la plantilla deberá tener calorías positivas.</AppText>{(['calories','proteinG','carbsG','fatG'] as const).map(input)}</>:<>
   <AppText muted>Cantidades de hasta 2 decimales. Editar conserva la base nutricional capturada de cada ingrediente.</AppText>
   {d.items.map((i,index)=><Surface key={`${i.snapshot?.id??i.food?.id}:${index}`}><AppText variant="label">{ingredientLabel(i)}</AppText><AppText muted>{`Base ${ingredientBase(i).baseQuantity} ${ingredientUnit(i)}`}</AppText>
    <Nutrition calories={ingredientBase(i).baseCalories} proteinG={ingredientBase(i).baseProteinG} carbsG={ingredientBase(i).baseCarbsG} fatG={ingredientBase(i).baseFatG}/>
    <TextInput accessibilityLabel={`Cantidad ${index+1}`} value={i.quantity} editable={!locked} keyboardType="decimal-pad" onChangeText={v=>controller.quantity(index,v)} style={[styles.input,{color:colors.text,borderColor:colors.border}]}/>
    {state.errors[`quantity:${index}`]?<AppText accessibilityRole="alert">{state.errors[`quantity:${index}`]}</AppText>:null}
    <Button label={`Subir ${ingredientLabel(i)}`} variant="secondary" disabled={locked||index===0} onPress={()=>controller.moveIngredient(index,-1)}/>
    <Button label={`Bajar ${ingredientLabel(i)}`} variant="secondary" disabled={locked||index===d.items.length-1} onPress={()=>controller.moveIngredient(index,1)}/>
    <Button label={`Quitar ${ingredientLabel(i)}`} variant="quiet" disabled={locked} onPress={()=>controller.removeIngredient(index)}/></Surface>)}
   <Button label="Agregar ingrediente" disabled={locked||d.items.length>=50} onPress={()=>{setSearch('');setPicker(true);void controller.loadFoods();}}/>
   {state.errors.items?<AppText accessibilityRole="alert">{state.errors.items}</AppText>:null}
   <Surface><AppText variant="label">Total de la plantilla</AppText>{totals?<Nutrition {...totals}/>:<AppText>Completá cantidades válidas para ver el total.</AppText>}</Surface>
  </>}
  <Button label="Guardar plantilla" disabled={locked} onPress={()=>void controller.save()}/>
  {state.editing?<><Button label={state.editing.isActive?'Archivar plantilla':'Reactivar plantilla'} variant="secondary" disabled={locked} onPress={()=>action(state.editing!.isActive?'archive':'reactivate')}/><Button label="Eliminar plantilla" variant="quiet" disabled={locked} onPress={()=>action('delete')}/></>:null}
  {!locked?<Button label="Volver a guardadas" variant="quiet" onPress={()=>discard(()=>controller.back())}/>:null}
 </>:null}
 {state.message?<AppText accessibilityRole="alert">{state.message}</AppText>:null}
 {state.phase==='conflict'?<Surface><AppText variant="label">Revisar conflicto</AppText>{state.truth?<><AppText>{state.truth.name}</AppText><Nutrition {...state.truth}/><Button label="Revisar borrador con versión actual" onPress={()=>controller.reviewTruth()}/>
  <Button label="Adoptar ingredientes actuales" variant="secondary" onPress={()=>Alert.alert('¿Usar ingredientes actuales?','Reemplaza los ingredientes y cantidades del borrador. Conserva nombre y descripción.',[{text:'Cancelar',style:'cancel'},{text:'Usar actuales',onPress:()=>controller.adoptServerIngredients()}])}/></>:null}
  <Button label="Revisar alimentos elegidos" onPress={()=>controller.reviewFoods()} variant="secondary"/>
  <Button label="Actualizar versión del servidor" onPress={()=>void controller.loadTruth()} variant="secondary"/>
  <Button label="Cancelar edición" onPress={()=>discard(()=>controller.back())} variant="quiet"/>
 </Surface>:null}
 {['uncertain','confirmed','blocked'].includes(state.phase)?<Button label={state.intent?.receipt?'Actualizar catálogo confirmado':'Comprobar intento guardado'} onPress={()=>void controller.recover()}/>:null}
 <Button label="Cerrar" variant="quiet" disabled={pending} onPress={close}/>
 </ScrollScreen></KeyboardAvoidingView></Modal>;
}
const styles=StyleSheet.create({screen:{flex:1},field:{gap:spacing.sm},input:{borderWidth:1,borderRadius:12,padding:spacing.md,minHeight:48}});
