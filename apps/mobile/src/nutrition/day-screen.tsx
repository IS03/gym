import { useCallback, useEffect, useState } from 'react';
import { AppState, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useMobileApi } from '@/api';
import { useMobileAuth } from '@/auth';
import { AppText, Button, LoadingState, ScrollScreen, UnavailableState, spacing, useOwnlevelTheme } from '@/design-system';
import { displayNutritionDate, nutritionToday, shiftNutritionDate } from './day-format';
import { NutritionDateSelector } from './date-selector';
import { NutritionDayContent } from './day-content';
import { useNutritionDayResource } from './day-resource';

function NutritionDayView({ date, today, onSelect, onToday, onServerToday }: {
  date: string; today: string; onSelect: (date: string) => void; onToday: () => void; onServerToday: (date: string) => void;
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
      <AppText variant="overline">{date === today ? 'Hoy' : 'Día nutricional'}</AppText>
      <AppText accessibilityRole="header" variant="heading">{displayNutritionDate(date)}</AppText>
      <View style={styles.dates}>
        <Button accessibilityLabel="Día anterior" disabled={!previous} label="‹" onPress={() => { if (previous) onSelect(previous); }} variant="secondary" />
        <View style={styles.choose}><Button label="Elegir fecha" onPress={() => setSelector(true)} variant="secondary" /></View>
        <Button accessibilityLabel="Día siguiente" disabled={!next} label="›" onPress={() => { if (next) onSelect(next); }} variant="secondary" />
      </View>
      {date !== today ? <Button label="Volver a hoy" onPress={onToday} variant="quiet" /> : null}
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
        <NutritionDayContent data={current.data} />
      </>}
    {selector ? <NutritionDateSelector date={date} onClose={() => setSelector(false)} onSelect={onSelect} /> : null}
  </ScrollScreen>;
}

export function NutritionDayScreen() {
  const { session } = useMobileAuth();
  const [today, setToday] = useState(() => nutritionToday());
  const [selected, setSelected] = useState<string | null>(null);
  // Today follows Cordoba midnight on focus/foreground; a chosen date stays fixed.
  const updateToday = useCallback(() => setToday(nutritionToday()), []);
  useFocusEffect(useCallback(() => { updateToday(); }, [updateToday]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => { if (next === 'active') updateToday(); });
    return () => subscription.remove();
  }, [updateToday]);
  const date = selected ?? today;
  return <NutritionDayView key={`${session?.user.id ?? 'anonymous'}:${date}`} date={date} today={today}
    onSelect={setSelected} onToday={() => { updateToday(); setSelected(null); }} onServerToday={setToday} />;
}
const styles = StyleSheet.create({
  header: { gap: spacing.md }, dates: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, choose: { flex: 1 },
});
