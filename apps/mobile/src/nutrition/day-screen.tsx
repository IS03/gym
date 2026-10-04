import { NutritionReports } from './report-screen';
import {useConfigurationController} from './use-config-controller';
import {ConfigurationEditor} from './config-editor';
import {useSavedController} from './use-saved-controller';
import {SavedEditor} from './saved-editor';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { AppState, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { selectedRouteDate } from '@/history/navigation';
import { ReturnToHistoryDay } from '@/history/return-to-day';
import { useDomainDate } from '@/history/use-domain-date';
import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import { AppText, Button, LoadingState, ScrollScreen, UnavailableState, spacing, useOwnlevelTheme } from '@/design-system';
import { displayNutritionDate, nutritionToday, shiftNutritionDate } from './day-format';
import { NutritionDateSelector } from './date-selector';
import { NutritionDayContent } from './day-content';
import { useNutritionDayResource } from './day-resource';
import type { NutritionDayMeal } from '../../../../src/lib/mobile-api/nutrition-day-contract';
import { useMealController } from './use-meal-controller';
import { useDayWriteController } from './use-day-write-controller';
import { DayWriteEditor } from './day-write-editor';
import type { MobileNutritionDayResponse } from '@/api/nutrition-day';
import { MealEditor } from './meal-editor';
import { useQuickController } from './use-quick-controller';
import { useFoodController } from './use-food-controller';
import { FoodEditor } from './food-editor';
import { foodQuickOption } from '@/api/nutrition-food';
import { QuickEditor } from './quick-editor';

function NutritionDayView({ date, today, onSelect, onToday, onServerToday, onAdd, addChoices, onManageFoods, onManageSaved, onConfigure, onReport, onEdit, onActivity, onContext }: {
  date: string; today: string; onSelect: (date: string) => void; onToday: () => void; onServerToday: (date: string) => void;
  onAdd?: () => void; onEdit?: (meal: NutritionDayMeal) => void;
  onConfigure?: () => void; onReport?: () => void; addChoices?: ReactNode; onManageFoods?: () => void; onManageSaved?: () => void;
  onActivity?: (data: MobileNutritionDayResponse) => void; onContext?: (data: MobileNutritionDayResponse) => void;
}) {
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const { state, refresh } = useNutritionDayResource(client, date);
  const [selector, setSelector] = useState(false);
  const current = state.status === 'ready' ? state.current
    : state.status === 'unavailable' ? state.previous : undefined;
  const serverToday = current?.data.today;
  useEffect(() => { if (serverToday) onServerToday(serverToday); }, [serverToday, onServerToday]);
  const runRefresh = () => { void refresh(); };
  const previous = shiftNutritionDate(date, -1), next = shiftNutritionDate(date, 1);
  return <ScrollScreen testID="nutrition-day-screen" refreshControl={
    <RefreshControl colors={[colors.primary]} onRefresh={runRefresh}
      progressBackgroundColor={colors.surface} refreshing={state.status === 'ready' && state.refreshing}
      testID="nutrition-refresh" tintColor={colors.primary} />
  }>
    <View style={styles.header}>
      <ReturnToHistoryDay />
      <AppText variant="overline">{date === today ? 'Hoy' : 'Día nutricional'}</AppText>
      <AppText accessibilityRole="header" variant="heading">{displayNutritionDate(date)}</AppText>
      <View style={styles.dates}>
        <Button accessibilityLabel="Día anterior" disabled={!previous} label="‹" onPress={() => { if (previous) onSelect(previous); }} variant="secondary" />
        <View style={styles.choose}><Button label="Elegir fecha" onPress={() => setSelector(true)} variant="secondary" /></View>
        <Button accessibilityLabel="Día siguiente" disabled={!next} label="›" onPress={() => { if (next) onSelect(next); }} variant="secondary" />
      </View>
      {date !== today ? <Button label="Volver a hoy" onPress={onToday} variant="quiet" /> : null}
      {onAdd ? <Button label="Agregar comida" onPress={onAdd} /> : null}
      {addChoices}
      {onManageSaved ? <Button label="Administrar comidas guardadas" variant="quiet" onPress={onManageSaved} /> : null}
      {onReport ? <Button label="Reporte nutricional" variant="quiet" onPress={onReport} /> : null}
      {onConfigure ? <Button label="Configurar nutrición" variant="quiet" onPress={onConfigure} /> : null}
      {onManageFoods ? <Button label="Administrar alimentos" variant="quiet" onPress={onManageFoods} /> : null}
    </View>
    {!current ? state.status === 'loading' ? <LoadingState label="Cargando día nutricional" />
      : <UnavailableState title="No pudimos cargar este día"
        description={state.status === 'auth_required' || state.status === 'unauthorized' ? 'No pudimos confirmar tu sesión.' : 'Revisá la conexión e intentá nuevamente.'}
        action={<Button label="Reintentar" onPress={runRefresh} />} />
      : <>
        {state.status !== 'ready' ? <View style={styles.header}>
          <AppText accessibilityRole="alert">No pudimos actualizar. Mostramos la última lectura de esta fecha.</AppText>
          <Button label="Reintentar" onPress={runRefresh} variant="secondary" />
        </View> : null}
        <NutritionDayContent data={current.data} onEdit={state.status === 'ready' ? onEdit : undefined}
          onActivity={state.status === 'ready' ? onActivity : undefined} onContext={state.status === 'ready' ? onContext : undefined} />
      </>}
    {selector ? <NutritionDateSelector date={date} onClose={() => setSelector(false)} onSelect={onSelect} /> : null}
  </ScrollScreen>;
}

export function NutritionDayScreen() {
  const { session } = useMobileAuth();
  return <NutritionUserDayScreen key={session?.user.id ?? 'anonymous'} userId={session?.user.id ?? 'anonymous'} />;
}
function NutritionUserDayScreen({ userId }: { userId: string }) {
  const routeDate = selectedRouteDate(useLocalSearchParams());
  const { client } = useMobileApi();
  const [revision, setRevision] = useState(0);
  const invalidate = useCallback(() => setRevision(v => v + 1), []);
  const config = useConfigurationController(client, userId, invalidate);
  const meals = useMealController(client, userId, invalidate);
  const writes = useDayWriteController(client, userId, invalidate);
  const quick = useQuickController(client, userId, invalidate);
  const foods = useFoodController(client, userId);
  const quickController=quick?.controller;
  const invalidateQuick=useCallback(()=>{if(quickController)void quickController.loadOptions();},[quickController]);
  const saved=useSavedController(client,userId,invalidateQuick);
  const [reportOpen, setReportOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [today, setToday] = useState(() => nutritionToday());
  const [selected, setSelected] = useDomainDate(routeDate);
  // Today follows Cordoba midnight on focus/foreground; a chosen date stays fixed.
  const updateToday = useCallback(() => setToday(nutritionToday()), []);
  useFocusEffect(useCallback(() => { updateToday(); }, [updateToday]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') updateToday(); });
    return () => subscription.remove();
  }, [updateToday]);
  const date = selected ?? today;
  const editable = meals?.state.phase === 'idle' && !meals.state.intent && writes?.state.phase === 'idle' && !writes.state.intent
    && quick?.state.phase === 'idle' && !quick.state.intent && foods?.state.phase === 'idle' && !foods.state.intent && saved?.state.phase==='idle' && !saved.state.intent && config?.state.phase==='idle' && !config.state.intent;
  return <>
    <NutritionDayView key={`${userId}:${date}:${revision}`} date={date} today={today}
      onSelect={setSelected} onToday={() => { updateToday(); setSelected(null); }} onServerToday={setToday}
      onAdd={editable ? () => setAdding(true) : undefined}
      onReport={() => setReportOpen(true)}
      onConfigure={editable?()=>config.controller.open():undefined}
      onManageSaved={editable?()=>saved.controller.open():undefined}
      onManageFoods={editable ? () => foods.controller.open(null) : undefined}
      addChoices={adding ? <View style={styles.header} testID="nutrition-add-choice">
        <Button disabled={!editable} label="Rápido" onPress={() => { setAdding(false); quick?.controller.open(date); }} />
        <Button disabled={!editable} label="Alimento" variant="secondary" onPress={() => { setAdding(false); foods?.controller.open(date); }} />
        <Button disabled={!editable} label="Manual" variant="secondary" onPress={() => { setAdding(false); meals?.controller.open(date); }} />
        <Button label="Cancelar" variant="quiet" onPress={() => setAdding(false)} />
      </View> : undefined}
      onEdit={editable ? meal => meals.controller.open(date, meal) : undefined}
      onActivity={editable ? data => writes.controller.open('metrics', data) : undefined}
      onContext={editable ? data => writes.controller.open('context', data) : undefined} />
    {reportOpen ? <NutritionReports onClose={() => setReportOpen(false)} onDate={setSelected} /> : null}
    {meals?.state.message && !meals.state.editor ? <View style={styles.header}><AppText accessibilityRole="alert">{meals.state.message}</AppText>
      {meals.state.intent ? <Button label="Revisar intento guardado" onPress={() => meals.controller.showRecovery()} /> : null}
      {meals.state.phase === 'blocked' ? <Button label="Comprobar almacenamiento" onPress={() => void meals.controller.recover()} /> : null}</View> : null}
    {writes?.state.message && !writes.state.draft ? <View style={styles.header}><AppText accessibilityRole="alert">{writes.state.message}</AppText>
      {writes.state.intent ? <Button label="Revisar intento de actividad/contexto" onPress={() => writes.controller.showRecovery()} /> : null}
      {writes.state.phase === 'blocked' ? <Button label="Comprobar almacenamiento del día" onPress={() => void writes.controller.recover()} /> : null}</View> : null}
    {quick?.state.message && !quick.state.open ? <View style={styles.header}><AppText accessibilityRole="alert">{quick.state.message}</AppText>
      {quick.state.intent ? <Button label="Revisar intento rápido" onPress={() => quick.controller.showRecovery()} /> : null}
      {quick.state.phase === 'blocked' ? <Button label="Comprobar almacenamiento rápido" onPress={() => void quick.controller.recover()} /> : null}</View> : null}
    {quick && !(foods?.state.open && foods.state.mode === 'register') ? <QuickEditor controller={quick.controller} state={quick.state} /> : null}
    {foods && quick ? <FoodEditor controller={foods.controller} state={foods.state} quick={quick} onChoose={food => { quick.controller.open(foods.state.date!, foodQuickOption(food)); foods.controller.registration(); }} /> : null}
    {foods?.state.message && !foods.state.open ? <View style={styles.header}><AppText accessibilityRole="alert">{foods.state.message}</AppText>
      {foods.state.intent ? <Button label="Revisar intento de catálogo" onPress={() => foods.controller.showRecovery()} /> : null}
      {foods.state.phase === 'blocked' ? <Button label="Comprobar almacenamiento de alimentos" onPress={() => void foods.controller.recover()} /> : null}</View> : null}
    {saved?<SavedEditor controller={saved.controller} state={saved.state}/>:null}
    {saved?.state.message&&!saved.state.open?<View style={styles.header}><AppText accessibilityRole="alert">{saved.state.message}</AppText>{saved.state.intent?<Button label="Revisar intento de guardadas" onPress={()=>saved.controller.showRecovery()}/>:null}{saved.state.phase==='blocked'?<Button label="Comprobar almacenamiento de guardadas" onPress={()=>void saved.controller.recover()}/>:null}</View>:null}
    {config ? <ConfigurationEditor controller={config.controller} state={config.state} /> : null}
    {config?.state.message && !config.state.open ? <View style={styles.header}><AppText accessibilityRole="alert">{config.state.message}</AppText>{config.state.intent ? <Button label="Revisar intento de configuración" onPress={()=>config.controller.showRecovery()} /> : null}{config.state.phase==='blocked'?<Button label="Comprobar almacenamiento de configuración" onPress={()=>void config.controller.recover()}/>:null}</View>:null}
    {writes ? <DayWriteEditor controller={writes.controller} state={writes.state} /> : null}
    {meals ? <MealEditor controller={meals.controller} state={meals.state} /> : null}
  </>;
}
const styles = StyleSheet.create({
  header: { gap: spacing.md }, dates: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, choose: { flex: 1 },
});
