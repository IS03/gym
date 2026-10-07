import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { useMobileApi } from '@/api';
import type { ResourceRefreshTrigger } from '@/api/resource';
import { ScrollScreen, SkeletonBlock, useOwnlevelTheme } from '@/design-system';
import { homeDay, weekDates, mondayOf } from '@/home/home-day';
import { haptics } from '@/platform/haptics';

import { TrainingHubCache, shiftHubMonth, useHubRead } from './training-hub-data';
import { HubHeader, TrainingHubDashboard } from './training-hub-dashboard';
import { TrainingHubCalendarSheet } from './training-hub-calendar-sheet';
import { StartWorkoutModal } from './start-workout-modal';

const systemNow = () => new Date();

export function TrainingScreen({ now = systemNow }: { now?: () => Date }) {
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const router = useRouter();
  const [clock, setClock] = useState(now);
  const today = homeDay(clock).today;
  const [selected, setSelected] = useState(today);
  const [sheetMonth, setSheetMonth] = useState(today.slice(0, 7));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [start, setStart] = useState<{ routineId?: string; immediate: boolean } | null>(null);
  const cache = useMemo(() => new TrainingHubCache(client), [client]);
  const home = useHubRead(cache.home);
  const currentMonth = today.slice(0, 7);
  const previousMonth = shiftHubMonth(currentMonth, -1);
  useHubRead(cache.month(currentMonth));
  useHubRead(cache.month(previousMonth));
  const month = selected.slice(0, 7);
  const calendar = useHubRead(cache.month(month));
  const sheetCalendar = useHubRead(cache.month(calendarOpen ? sheetMonth : month));
  const week = useHubRead(cache.week(selected));
  const boundaryDates = weekDates(mondayOf(selected));
  const firstWeekMonth = boundaryDates[0].slice(0, 7);
  const lastWeekMonth = boundaryDates[6].slice(0, 7);
  const firstMonth = useHubRead(cache.month(firstWeekMonth));
  const lastMonth = useHubRead(cache.month(lastWeekMonth));
  const boundaryCalendars = [firstMonth, lastMonth];
  const priorToday = useRef(today);

  useEffect(() => {
    const interval = setInterval(() => setClock(now()), 30_000);
    return () => clearInterval(interval);
  }, [now]);
  useEffect(() => {
    if (priorToday.current !== today) {
      const oldToday = priorToday.current;
      priorToday.current = today;
      if (selected === oldToday) setSelected(today);
    }
  }, [selected, today]);
  useEffect(() => () => cache.dispose(), [cache]);

  const refresh = useCallback((trigger: ResourceRefreshTrigger = 'manual') => {
    setClock(now());
    const resources = new Set([cache.home, cache.month(currentMonth), cache.month(previousMonth), cache.month(month),
      cache.month(calendarOpen ? sheetMonth : month), cache.month(firstWeekMonth), cache.month(lastWeekMonth), cache.week(selected)]);
    resources.forEach(resource => { void resource.refresh(trigger); });
  }, [cache, calendarOpen, currentMonth, month, now, previousMonth, selected, sheetMonth, firstWeekMonth, lastWeekMonth]);
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useFocusEffect(useCallback(() => { refreshRef.current('foreground'); }, []));

  const selectDay = (date: string) => { if (date !== selected) haptics.selection(); setSelected(date); setSheetMonth(date.slice(0, 7)); };
  const openCalendar = () => { setSheetMonth(month); setCalendarOpen(true); };
  const toSession = (id: string, replace = false) => {
    setStart(null);
    refresh('foreground');
    const path = `/(tabs)/train/session/${id}` as const;
    if (replace) router.replace(path); else router.push(path);
  };
  const onLibrary = (target: 'routines' | 'exercises' | 'history') => router.push(`/(tabs)/train/${target}`);
  const homeState = cache.home.getSnapshot();

  return <>
    <ScrollScreen contentContainerStyle={{ paddingBottom: 100, paddingTop: 0 }} safeAreaEdges={['top', 'left', 'right']}
      refreshControl={<RefreshControl onRefresh={() => refresh()} refreshing={homeState.status === 'ready' && homeState.refreshing && homeState.trigger === 'manual'}
        tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surface} testID="training-refresh-control" />} testID="training-screen">
      {home.status === 'loading' && calendar.status === 'loading' ? <View style={{ gap: 12 }} testID="training-loading">
        <HubHeader onCalendar={openCalendar} /><SkeletonBlock height={66} /><SkeletonBlock height={90} /><SkeletonBlock height={190} /><SkeletonBlock height={160} />
      </View> : <TrainingHubDashboard home={home} calendar={calendar} week={week} selected={selected} today={today} month={month} now={clock.getTime()}
        boundaryCalendars={boundaryCalendars} observedSessions={cache.observedSessions(today)} onCalendar={openCalendar} onSelect={selectDay} onRefresh={refresh}
        onStart={() => { haptics.selection(); setStart({ immediate: false }); }} onPlay={id => setStart({ routineId: id, immediate: true })}
        onContinue={id => toSession(id)} onSession={id => router.push(`/(tabs)/train/history/${id}`)}
        onRoutine={id => router.push(`/(tabs)/train/routines/${id}`)} onLibrary={onLibrary} />}
    </ScrollScreen>
    <TrainingHubCalendarSheet open={calendarOpen} onClose={() => setCalendarOpen(false)} calendar={sheetCalendar} month={sheetMonth}
      onMonth={delta => setSheetMonth(value => shiftHubMonth(value, delta))} onSelect={selectDay} selected={selected} today={today} week={week} onRetry={refresh}
      onDay={date => { setCalendarOpen(false); router.push({ pathname: '/history/day/[date]', params: { date } }); }} />
    {start ? <StartWorkoutModal key={start.routineId ?? 'free-choice'} initialRoutineId={start.routineId} startImmediately={start.immediate}
      onClose={() => setStart(null)} onContinue={id => toSession(id, true)} onStarted={id => toSession(id, true)} /> : null}
  </>;
}
