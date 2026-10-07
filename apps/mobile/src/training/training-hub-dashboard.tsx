import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';

import type { MobileHomeResponse, MobileHomeWorkoutStartRoutine } from '@/api/home';
import type { MobileTrainingResponse } from '@/api/training';
import type { TrainingHistorySession } from '@/api/training-history';
import { AppIcon, AppText, InlineUnavailable, ListGroup, ListRow, SkeletonBlock, brandTokens, radius, spacing, useOwnlevelTheme } from '@/design-system';
import { Capsule, Hero } from '@/home/home-dashboard';
import { elapsedMinutes, mondayOf, WEEKDAY_LETTERS, weekDates } from '@/home/home-day';
import type { HomeResource } from '@/home/home-resource';
import { HomeSectionHeader } from '@/home/home-ui';

import { hubRoutineMetadata, type HubWeek } from './training-hub-data';
import { trainingRoutineColor } from './routine-colors';

export const HUB_WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function hubMonthName(month: string, year = false): string {
  const text = new Intl.DateTimeFormat('es-AR', { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${month}-01T12:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1) + (year ? ` ${month.slice(0, 4)}` : '');
}

export function hubDayName(date: string, today: string): string {
  if (date === today) return 'Hoy';
  const index = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return `${HUB_WEEKDAY_NAMES[index]} ${Number(date.slice(8))}`;
}

export function HubCircleButton({ icon, label, onPress, visualSize = 34, glass = false }: {
  icon: 'calendar' | 'chevronLeft' | 'chevronRight' | 'play'; label: string; onPress: () => void; visualSize?: number; glass?: boolean;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const nativeGlass = glass && Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable();
  const circle = { alignItems: 'center' as const, borderRadius: radius.full, height: visualSize, justifyContent: 'center' as const, width: visualSize };
  const image = <AppIcon color={icon === 'play' ? colors.primary : colors.textMuted} name={icon} size={icon === 'play' ? 16 : 17} />;
  return <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress}
    style={({ pressed }) => [styles.circleTouch, { opacity: pressed ? 0.55 : 1 }]}>
    {nativeGlass ? <GlassView colorScheme={isDark ? 'dark' : 'light'} glassEffectStyle="regular" style={circle}>{image}</GlassView> :
      <View style={[circle, { backgroundColor: icon === 'play' ? colors.brandSubtle : glass ? brandTokens.glass[isDark ? 'dark' : 'light'].fill : colors.surfaceRaised }]}>{image}</View>}
  </Pressable>;
}

export function HubHeader({ onCalendar }: { onCalendar: () => void }) {
  return <View style={styles.header}>
    <AppText accessibilityRole="header" variant="largeTitle">Entrenar</AppText>
    <HubCircleButton glass icon="calendar" label="Abrir calendario" onPress={onCalendar} visualSize={38} />
  </View>;
}

export function HubWeekStrip({ boundaryCalendars = [], calendar, month, onCalendar, onSelect, selected, today, week }: {
  boundaryCalendars?: HomeResource<MobileTrainingResponse>[];
  calendar: HomeResource<MobileTrainingResponse>; month: string; onCalendar: () => void; onSelect: (date: string) => void;
  selected: string; today: string; week: HomeResource<HubWeek>;
}) {
  const { colors } = useOwnlevelTheme();
  const { fontScale, width } = useWindowDimensions();
  const read = calendar.data?.calendar;
  const days = read?.status === 'ok' ? new Set(read.data.days.map(day => day.date)) : null;
  const knownMonths = new Map([calendar, ...boundaryCalendars].flatMap(resource => resource.data?.calendar.status === 'ok'
    ? [[resource.data.calendar.data.month, new Set(resource.data.calendar.data.days.map(day => day.date))] as const] : []));
  const dates = weekDates(mondayOf(selected));
  // A single commit when the downward gesture ends; no per-frame React updates.
  const pull = Gesture.Pan().activeOffsetY(18).failOffsetX([-20, 20]).onEnd(event => {
    if (event.translationY > 18) scheduleOnRN(onCalendar);
  });
  return <View style={styles.weekSection} testID="training-week-strip">
    <Pressable accessibilityLabel={`Abrir calendario de ${hubMonthName(month)}`} accessibilityRole="button" hitSlop={{ top: 10, bottom: 10 }} onPress={onCalendar} style={styles.monthRow}>
      <AppText style={styles.monthName} variant="subheadline">{hubMonthName(month)}</AppText>
      {days ? <AppText muted numeric variant="footnote">{days.size} {days.size === 1 ? 'día entrenado' : 'días entrenados'}</AppText> :
        calendar.status === 'loading' ? <SkeletonBlock height={14} width={96} /> : <AppText muted variant="footnote">No disponible</AppText>}
    </Pressable>
    <GestureDetector gesture={pull}>
      <View style={[styles.weekRow, (fontScale > 1.5 || width - 32 < 346) && styles.wrap]}>
        {dates.map((date, index) => {
          const selectedDay = date === selected;
          const todayDay = date === today;
          const count = week.data?.sessions.filter(session => session.logDate === date).length;
          const monthDays = knownMonths.get(date.slice(0, 7));
          const activityKnown = monthDays !== undefined;
          const trained = monthDays?.has(date) ?? false;
          return <Pressable key={date} accessibilityRole="button" accessibilityLabel={`${HUB_WEEKDAY_NAMES[index]} ${Number(date.slice(8))}${todayDay ? ', hoy' : ''}, ${count !== undefined ? `${count} ${count === 1 ? 'sesión' : 'sesiones'}` : !activityKnown ? 'actividad no disponible' : trained ? 'con entrenamiento' : 'sin entrenamiento'}`}
            accessibilityState={{ selected: selectedDay }} onPress={() => onSelect(date)} testID={`training-week-day-${date}`}
            style={({ pressed }) => [styles.weekDay, { backgroundColor: selectedDay ? colors.surface : 'transparent', opacity: pressed ? 0.6 : 1 },
              todayDay && !selectedDay && { borderColor: colors.primary, borderWidth: 1.5 }]}>
            <AppText style={{ color: selectedDay ? colors.primary : colors.textMuted, fontWeight: '600' }} variant="caption">{WEEKDAY_LETTERS[index]}</AppText>
            <AppText numeric style={[styles.dayNumber, { color: selectedDay ? colors.primary : date > today ? colors.textMuted : colors.text, opacity: date > today ? 0.6 : 1 }]}>{Number(date.slice(8))}</AppText>
            <View accessibilityElementsHidden style={[styles.dayDot, { backgroundColor: trained ? colors.primary : 'transparent' }]} testID={trained ? `training-week-dot-${date}` : undefined} />
          </Pressable>;
        })}
      </View>
    </GestureDetector>
  </View>;
}

function DaySessions({ onSession, onRetry, selected, today, week }: { onSession: (id: string) => void; onRetry: () => void; selected: string; today: string; week: HomeResource<HubWeek> }) {
  const sessions = week.data?.sessions.filter(session => session.logDate === selected);
  return <View style={styles.section} testID="training-day-sessions">
    <AppText muted numeric variant="footnote">{hubDayName(selected, today)}{sessions ? ` · ${sessions.length} ${sessions.length === 1 ? 'sesión' : 'sesiones'}` : ''}</AppText>
    {!sessions ? week.status === 'loading' ? <SkeletonBlock height={80} /> :
      <InlineUnavailable message="No pudimos cargar las sesiones de esta semana." actionLabel="Reintentar" onAction={onRetry} /> :
      <ListGroup bordered={false} compact>
        {sessions.length ? sessions.map(session => {
          const minutes = session.durationMilliseconds === null ? 'Duración no registrada' : `${Math.round(session.durationMilliseconds / 60_000)} min`;
          const value = `${minutes} · ${session.completedSets} ${session.completedSets === 1 ? 'serie' : 'series'}`;
          return <ListRow compact accessibilityLabel={`${session.routineName}, ${value}`} key={session.id} title={session.routineName} value={value}
            numericValue onPress={() => onSession(session.id)} testID={`training-completed-${session.id}`} />;
        }) : <View style={{ paddingVertical: 12 }}><AppText muted variant="subheadline">Sin entrenamiento este día</AppText></View>}
      </ListGroup>}
    {week.status === 'unavailable' && sessions ? <InlineUnavailable message="Mostramos la última semana guardada. No pudimos actualizarla." actionLabel="Reintentar" onAction={onRetry} /> : null}
  </View>;
}

function RoutineRow({ onOpen, onPlay, routine, sessions, today }: { onOpen: (id: string) => void; onPlay: (id: string) => void; routine: MobileHomeWorkoutStartRoutine; sessions: TrainingHistorySession[]; today: string }) {
  const { colors, isDark } = useOwnlevelTheme();
  return <View style={styles.routineRow}>
    <Pressable accessibilityLabel={`Abrir rutina ${routine.name}`} accessibilityRole="button" onPress={() => onOpen(routine.id)} style={({ pressed }) => [styles.routineLead, { opacity: pressed ? 0.6 : 1 }]}>
      <AppIcon color={colors.primary} name="dumbbell" size={20} />
      <View style={styles.flex}>
        <View style={styles.routineName}>
          <AppText style={{ flexShrink: 1 }} variant="body">{routine.name}</AppText>
          {routine.color ? <View accessibilityElementsHidden style={[styles.routineDot, { backgroundColor: trainingRoutineColor(routine.color, isDark) }]} /> : null}
        </View>
        <AppText muted numeric variant="footnote">{hubRoutineMetadata(routine.exerciseCount, routine.id, sessions, today)}</AppText>
      </View>
    </Pressable>
    <HubCircleButton icon="play" label={`Iniciar ${routine.name}`} onPress={() => onPlay(routine.id)} visualSize={32} />
  </View>;
}

export function TrainingHubDashboard({ boundaryCalendars = [], home, calendar, week, selected, today, month, now, observedSessions, onCalendar, onSelect, onRefresh, onStart, onPlay, onSession, onContinue, onRoutine, onLibrary }: {
  boundaryCalendars?: HomeResource<MobileTrainingResponse>[];
  home: HomeResource<MobileHomeResponse>; calendar: HomeResource<MobileTrainingResponse>; week: HomeResource<HubWeek>;
  selected: string; today: string; month: string; now: number; observedSessions: TrainingHistorySession[];
  onCalendar: () => void; onSelect: (date: string) => void; onRefresh: () => void; onStart: () => void; onPlay: (id: string) => void;
  onSession: (id: string) => void; onContinue: (id: string) => void; onRoutine: (id: string) => void; onLibrary: (target: 'routines' | 'exercises' | 'history') => void;
}) {
  const { colors } = useOwnlevelTheme();
  const active = home.data?.training.activeSession;
  const routines = home.data?.training.workoutStartRoutines;
  return <View style={styles.dashboard} testID="training-dashboard">
    <HubHeader onCalendar={onCalendar} />
    {home.status === 'loading' ? <SkeletonBlock height={92} /> : active?.status === 'ok' && active.data ?
      <Hero label="Sesión en curso" title={active.data.name} subtitle={`${elapsedMinutes(active.data.startedAt, now)} min · ${active.data.exercisesCompleted} de ${active.data.totalExercises} ejercicios`}
        actions={<Capsule label="Volver" onPress={() => onContinue(active.data!.id)} />} testID="training-active-session" /> :
      active?.status !== 'ok' ? <InlineUnavailable actionLabel="Reintentar" message="No pudimos verificar si tenés una sesión en curso." onAction={onRefresh} /> : null}
    {home.status === 'unavailable' || calendar.status === 'unavailable' ? <View testID="training-stale"><InlineUnavailable message="No pudimos actualizar Entrenar. Mostramos los datos guardados cuando están disponibles." actionLabel="Reintentar" onAction={onRefresh} /></View> : null}
    <HubWeekStrip boundaryCalendars={boundaryCalendars} calendar={calendar} month={month} onCalendar={onCalendar} onSelect={onSelect} selected={selected} today={today} week={week} />
    <DaySessions onSession={onSession} onRetry={onRefresh} selected={selected} today={today} week={week} />
    <View style={styles.section}>
      <HomeSectionHeader title="Empezar" action="Ver todas" onAction={() => onLibrary('routines')} />
      <ListGroup bordered={false} compact>
        <Pressable accessibilityLabel="Nueva sesión" accessibilityRole="button" onPress={onStart} style={({ pressed }) => [styles.newSession, { opacity: pressed ? 0.6 : 1 }]}>
          <AppIcon color={colors.primary} name="plus" size={20} />
          <View style={styles.flex}><AppText style={{ color: colors.primary }} variant="headline">Nueva sesión</AppText><AppText muted variant="footnote">Elegí rutina o entrená libre</AppText></View>
          <AppIcon color={colors.textMuted} name="chevronRight" size={17} />
        </Pressable>
        {routines?.status === 'ok' ? routines.data.slice(0, 3).map(routine => <RoutineRow key={routine.id} onOpen={onRoutine} onPlay={onPlay} routine={routine} sessions={observedSessions} today={today} />) : null}
        {routines?.status === 'ok' && !routines.data.length ? <ListRow title="Creá tu primera rutina" onPress={() => onLibrary('routines')} /> : null}
      </ListGroup>
      {!routines ? home.status === 'loading' ? <SkeletonBlock height={100} /> : <InlineUnavailable message="No pudimos cargar tus rutinas." onAction={onRefresh} actionLabel="Reintentar" /> :
        routines.status === 'unavailable' ? <InlineUnavailable message="No pudimos cargar tus rutinas. Podés elegir una sesión libre." onAction={onRefresh} actionLabel="Reintentar" /> : null}
    </View>
    <View style={styles.section}>
      <HomeSectionHeader title="Biblioteca" />
      <ListGroup bordered={false} compact>
        <ListRow compact icon="routines" title="Rutinas" accessibilityLabel="Abrir Rutinas" onPress={() => onLibrary('routines')} />
        <ListRow compact icon="book" title="Ejercicios" accessibilityLabel="Abrir Ejercicios" onPress={() => onLibrary('exercises')} />
        <ListRow compact icon="clock" title="Historial" accessibilityLabel="Abrir Historial" onPress={() => onLibrary('history')} />
      </ListGroup>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  dashboard: { gap: spacing.md },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 44 },
  circleTouch: { alignItems: 'center', justifyContent: 'center', height: 44, width: 44 },
  weekSection: { gap: spacing.md },
  monthRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', minHeight: 24, gap: spacing.xs },
  monthName: { fontWeight: '600' },
  weekRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 4 },
  wrap: { flexWrap: 'wrap', justifyContent: 'flex-start' },
  weekDay: { alignItems: 'center', borderRadius: 16, gap: 4, justifyContent: 'center', minHeight: 66, minWidth: 46, paddingVertical: 8, width: 46 },
  dayNumber: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  dayDot: { borderRadius: radius.full, height: 5, width: 5 },
  section: { gap: spacing.xs },
  routineRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  routineLead: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 50, paddingVertical: spacing.xs },
  routineName: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs },
  routineDot: { borderRadius: radius.full, height: 8, width: 8 },
  flex: { flex: 1, minWidth: 0 },
  newSession: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 50, paddingVertical: spacing.xs },
});
