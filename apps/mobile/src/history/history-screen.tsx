import { useCallback } from 'react';
import { RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { fetchHistoryRange, historyDomainLabels, historyHasActivity } from '@/api/history';
import type { MobileApiClient } from '@/api/client';
import { AppText, Button, EmptyState, Heading, InlineUnavailable, PressableSurface, ScrollScreen, SkeletonBlock, useOwnlevelTheme } from '@/design-system';
import { formatBodyDate } from '@/body/body-model';
import { useHistoryResource } from './use-history-resource';
import { historyDayHref } from './navigation';

export function HistoryScreen() {
  const router = useRouter(), { colors } = useOwnlevelTheme();
  const read = useCallback((client: MobileApiClient, signal: AbortSignal) => fetchHistoryRange(client, undefined, signal), []);
  const { data, state, stale, refresh } = useHistoryResource('recent', read);
  const days = data?.days.filter(d => historyHasActivity(d) === true).reverse() ?? [];
  const partial = data && Object.values(data.availability).some(s => s === 'unavailable');
  return <ScrollScreen testID="global-history" refreshControl={<RefreshControl refreshing={state.status === 'ready' && state.refreshing}
    onRefresh={() => void refresh()} tintColor={colors.primary} />}>
    <Heading level={1}>Historial</Heading>
    <AppText muted>Actividad registrada en los últimos 30 días.</AppText>
    <Button label="Calendario" onPress={() => router.push('/history/calendar')} variant="secondary" />
    {data ? <Button label="Abrir hoy" onPress={() => router.push(historyDayHref(data.today))} variant="quiet" /> : null}
    {!data ? state.status === 'loading' ? <SkeletonBlock height={180} /> : <InlineUnavailable message="No pudimos cargar el historial." actionLabel="Reintentar" onAction={() => void refresh()} /> : <>
      {stale ? <InlineUnavailable message="Mostramos la última lectura confirmada. No se pudo actualizar." actionLabel="Reintentar" onAction={() => void refresh()} /> : null}
      {partial ? <InlineUnavailable message="Cobertura parcial: algunos dominios no están disponibles." actionLabel="Reintentar" onAction={() => void refresh()} /> : null}
      {!days.length ? partial ? <AppText muted>No hay actividad confirmada en las fuentes disponibles.</AppText>
        : <EmptyState title="Sin actividad reciente" description="Podés explorar fechas anteriores en el calendario." /> : days.map(d =>
        <PressableSurface key={d.date} accessibilityLabel={`${formatBodyDate(d.date)}. ${historyDomainLabels(d).join(', ')}`}
          onPress={() => router.push(historyDayHref(d.date))}>
          <AppText variant="label">{d.date === data.today ? 'Hoy · en curso' : formatBodyDate(d.date)}</AppText>
          <AppText muted>{historyDomainLabels(d).join(' · ')}</AppText>
        </PressableSurface>)}
    </>}
  </ScrollScreen>;
}
