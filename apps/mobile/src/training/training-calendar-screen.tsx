import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetchMobileTraining, useMobileApi } from '@/api';
import type { MobileTrainingResponse } from '@/api/training';
import { AppText, ScrollScreen, SkeletonBlock, useOwnlevelTheme } from '@/design-system';
import { isoDateForDate, monthForDate } from './calendar';
import { addMonths } from './history-model';
import { CalendarCard } from './training-dashboard';
import { useRead } from './use-read';

const UNAVAILABLE = { status: 'unavailable', reason: 'invalid_response' } as const;

/** Training calendar with month navigation. Tapping any day opens that stored log date. */
export function TrainingCalendarScreen({ now = () => new Date() }: { now?: () => Date }) {
  const { client } = useMobileApi();
  const router = useRouter();
  const { colors } = useOwnlevelTheme();
  const today = isoDateForDate(now());
  const [month, setMonth] = useState(() => monthForDate(now()));
  const load = useCallback((signal: AbortSignal) => client ? fetchMobileTraining(client, month, signal)
    : Promise.resolve({ status: 'unavailable' as const, reason: 'auth' as const, meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const } }), [client, month]);
  const { state, reload } = useRead(load);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  // Never show a different month's days under this month's title.
  const calendar: MobileTrainingResponse['calendar'] | null = state.status === 'ready'
    ? state.data.calendar.status === 'ok' && state.data.calendar.data.month !== month ? (state.stale ? UNAVAILABLE : null) : state.data.calendar
    : state.status === 'loading' ? null : UNAVAILABLE;
  return <ScrollScreen testID="training-calendar-screen" refreshControl={<RefreshControl refreshing={state.status === 'ready' && state.refreshing}
    onRefresh={() => void reload()} tintColor={colors.primary} />}>
    {calendar ? <CalendarCard calendar={calendar} onRefresh={() => void reload()} requestedMonth={month} today={today}
      onChangeMonth={delta => setMonth(current => addMonths(current, delta))}
      onSelectDay={date => router.push(`/(tabs)/train/day/${date}`)} /> : <SkeletonBlock height={360} />}
    <AppText muted variant="caption">Los puntos de color marcan días con al menos una sesión terminada. Tocá un día para ver sus sesiones.</AppText>
  </ScrollScreen>;
}
