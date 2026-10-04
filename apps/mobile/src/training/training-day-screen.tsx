import { useCallback, useLayoutEffect } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useMobileApi } from '@/api';
import { fetchTrainingDay } from '@/api/training-history';
import { AppText, Button, EmptyState, ScrollScreen, Surface, spacing, useOwnlevelTheme } from '@/design-system';
import { formatDuration } from '@/home/format';
import { dayHeading, plural, volumeLabel } from './history-model';
import { ListCard, ReadStateScreen, SessionRow, StaleNotice } from './history-components';
import { useRead } from './use-read';
import { historyReturnParams } from '@/history/navigation';
import { ReturnToHistoryDay } from '@/history/return-to-day';

function Stat({ value, label }: { value: string | null; label: string }) {
  return <View style={styles.stat}><AppText variant="label">{value ?? '—'}</AppText><AppText muted variant="caption">{label}</AppText></View>;
}

/** One stored training day: Web day summary + its completed sessions. */
export function TrainingDayScreen() {
  const params = useLocalSearchParams<{ date: string }>();
  const date = typeof params.date === 'string' ? params.date : '';
  const origin = historyReturnParams(params);
  const { client } = useMobileApi();
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useOwnlevelTheme();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const load = useCallback((signal: AbortSignal) => client && valid ? fetchTrainingDay(client, date, signal)
    : Promise.resolve({ status: 'unavailable' as const, reason: 'invalid_response' as const, meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const } }), [client, date, valid]);
  const { state, reload } = useRead(load);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  useLayoutEffect(() => { if (valid) navigation.setOptions({ title: dayHeading(date) }); }, [date, navigation, valid]);
  if (state.status !== 'ready') return <ReadStateScreen header={<ReturnToHistoryDay />} state={state} onRetry={() => void reload()} testID="training-day" />;
  const { sessions, summary } = state.data;
  return <ScrollScreen testID="training-day" refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void reload()} tintColor={colors.primary} />}>
    <ReturnToHistoryDay />
    {state.stale ? <StaleNotice onRetry={() => void reload()} /> : null}
    {sessions.length === 0 ? <EmptyState title="Sin entrenamientos" description="No hay entrenamientos terminados este día."
      action={<Button label="Volver al calendario" variant="secondary" onPress={() => router.back()} />} /> : <>
      <Surface style={styles.summary} testID="training-day-summary">
        <AppText variant="label">{plural(summary.sessionCount, 'entrenamiento')}</AppText>
        <View style={styles.stats}>
          <Stat value={formatDuration(summary.durationMilliseconds)} label="duración total" />
          <Stat value={String(summary.exercisesCompleted)} label="ejercicios" />
          <Stat value={String(summary.completedSets)} label="series" />
          <Stat value={volumeLabel(summary.volumeKg)} label="volumen total" />
        </View>
      </Surface>
      <AppText muted variant="label">Sesiones del día</AppText>
      <ListCard>{sessions.map((session, index) => <SessionRow key={session.id} session={session} divided={index > 0}
        onPress={() => router.push(origin ? { pathname: '/(tabs)/train/history/[id]', params: { id: session.id, ...origin } } : `/(tabs)/train/history/${session.id}`)} />)}</ListCard>
    </>}
  </ScrollScreen>;
}
const styles = StyleSheet.create({
  summary: { gap: spacing.md },
  stats: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  stat: { width: '50%', gap: 2 },
});
