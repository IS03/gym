import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { MobileApiClient } from '@/api/client';
import { fetchHistoryRange, historyDomainLabels } from '@/api/history';
import { AppText, Button, InlineUnavailable, ScrollScreen, SkeletonBlock, spacing, useOwnlevelTheme } from '@/design-system';
import { buildTrainingMonth, formatTrainingMonth } from '@/training/calendar';
import { addMonths } from '@/training/history-model';
import { useHistoryResource } from './use-history-resource';
import { historyDayHref } from './navigation';
import { useDomainDate } from './use-domain-date';

export function HistoryCalendarScreen() {
  const params = useLocalSearchParams(), router = useRouter(), { colors } = useOwnlevelTheme();
  const [month, setMonth] = useDomainDate(typeof params.month === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month) ? params.month : null);
  const [serverToday, setServerToday] = useState<string | null>(null);
  const read = useCallback(async (client: MobileApiClient, signal: AbortSignal) => {
    const dates = month ? buildTrainingMonth(month).flat().filter(d => !!d).map(d => d!.date) : null;
    const result = await fetchHistoryRange(client, dates?.length ? { from: dates[0], to: dates.at(-1)! } : undefined, signal);
    if (!signal.aborted && result.status === 'ok') { setServerToday(result.data.today); if (!month) setMonth(result.data.today.slice(0, 7)); }
    return result;
  }, [month, setMonth]);
  const { data, state, stale, refresh } = useHistoryResource(`calendar:${month ?? 'server-month'}`, read);
  const partial = data && Object.values(data.availability).some(s => s === 'unavailable');
  const facts = new Map(data?.days.map(d => [d.date, d]));
  return <ScrollScreen testID="global-calendar" refreshControl={<RefreshControl refreshing={state.status === 'ready' && state.refreshing}
    onRefresh={() => void refresh()} tintColor={colors.primary} />}>
    {month ? <View style={styles.row}>
      <Button label="‹" accessibilityLabel="Mes anterior" onPress={() => setMonth(addMonths(month, -1))} variant="secondary" />
      <AppText variant="label" style={styles.title}>{formatTrainingMonth(month)}</AppText>
      <Button label="›" accessibilityLabel="Mes siguiente" disabled={!serverToday || addMonths(month, 1) > serverToday.slice(0, 7)} onPress={() => setMonth(addMonths(month, 1))} variant="secondary" />
    </View> : null}
    {!data ? state.status === 'loading' ? <SkeletonBlock height={300} /> : <InlineUnavailable message="No pudimos cargar este mes." actionLabel="Reintentar" onAction={() => void refresh()} /> : <>
      {stale || partial ? <InlineUnavailable message={stale ? 'La última lectura de este mes no pudo actualizarse.' : 'Algunos indicadores no están disponibles.'} actionLabel="Reintentar" onAction={() => void refresh()} /> : null}
      {month ? <View accessibilityLabel="Calendario mensual">
        <View style={styles.row}>{['L','M','X','J','V','S','D'].map((d, i) => <AppText key={i} muted style={styles.weekday}>{d}</AppText>)}</View>
        {buildTrainingMonth(month).map((week, i) => <View key={i} style={styles.row}>{week.map((cell, j) => {
          if (!cell) return <View key={j} style={styles.cell} />;
          const future = cell.date > data.today, fact = facts.get(cell.date);
          const labels = fact ? historyDomainLabels(fact) : [];
          return <Pressable key={cell.date} style={[styles.cell, cell.date === data.today ? { backgroundColor: colors.surfaceRaised } : null]}
            accessibilityRole="button" accessibilityLabel={`${cell.date}. ${future ? 'Fecha futura' : labels.join(', ') || (partial ? 'Cobertura parcial' : 'Sin actividad')}`}
            disabled={future} onPress={() => router.push(historyDayHref(cell.date, month))}>
            <AppText muted={future}>{cell.day}</AppText>
            <AppText variant="caption" numberOfLines={1}>{labels.map(l => ({ Training: 'T', Nutrición: 'N', Cuerpo: 'C', Métricas: 'M' })[l as 'Training']).join(' ') || ' '}</AppText>
          </Pressable>;
        })}</View>)}
      </View> : null}
      <AppText muted variant="caption">T: Training · N: Nutrición · C: Cuerpo · M: Métricas</AppText>
      <Button label="Abrir hoy" variant="quiet" onPress={() => router.push(historyDayHref(data.today, month ?? undefined))} />
    </>}
  </ScrollScreen>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }, title: { flex: 1, textAlign: 'center' },
  weekday: { flex: 1, textAlign: 'center' }, cell: { flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 8 } });
