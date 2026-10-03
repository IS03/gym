import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useMobileApi } from '@/api';
import { fetchTrainingHistory, fetchTrainingHistoryExercises, type TrainingHistoryExercise, type TrainingHistorySession } from '@/api/training-history';
import { AppIcon, AppText, Button, EmptyState, ScrollScreen, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import { dayHeading, groupSessionsByDate, markLabel, mergeHistoryPage, plural, shortDate } from './history-model';
import { ListCard, ReadStateScreen, SegmentedControl, SessionRow, StaleNotice } from './history-components';
import { useRead } from './use-read';

type View_ = 'sessions' | 'exercises';
const VIEWS = [{ value: 'sessions', label: 'Sesiones' }, { value: 'exercises', label: 'Ejercicios' }] as const;
const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function SessionsTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const load = useCallback((signal: AbortSignal) => client ? fetchTrainingHistory(client, null, signal)
    : Promise.resolve({ status: 'unavailable' as const, reason: 'auth' as const, meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const } }), [client]);
  const { state, reload } = useRead(load);
  // Later pages are appended locally; a refresh restarts from the newest page.
  const [more, setMore] = useState<{ base: unknown; sessions: TrainingHistorySession[]; cursor: string | null; loading: boolean; failed: boolean } | null>(null);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  if (state.status !== 'ready') return <ReadStateScreen state={state} onRetry={() => void reload()} testID="history-sessions" />;
  const extra = more?.base === state.data ? more : null;
  const sessions = extra ? mergeHistoryPage(state.data.sessions, extra.sessions) : state.data.sessions;
  const cursor = extra ? extra.cursor : state.data.nextCursor;
  const loadMore = async () => {
    if (!client || !cursor) return;
    const base = state.data;
    setMore({ base, sessions: extra?.sessions ?? [], cursor, loading: true, failed: false });
    const result = await fetchTrainingHistory(client, cursor);
    setMore(current => current?.base !== base ? current : result.status === 'ok'
      ? { base, sessions: mergeHistoryPage(current.sessions, result.data.sessions), cursor: result.data.nextCursor, loading: false, failed: false }
      : { ...current, loading: false, failed: true });
  };
  return <ScrollScreen testID="history-sessions" refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void reload()} tintColor={colors.primary} />}>
    {state.stale ? <StaleNotice onRetry={() => void reload()} /> : null}
    {sessions.length === 0 ? <EmptyState title="Todavía no hay sesiones" description="Cuando finalices un entrenamiento, va a aparecer acá." />
      : groupSessionsByDate(sessions).map(group => <View key={group.date} style={styles.group}>
        <AppText muted variant="label">{dayHeading(group.date)}</AppText>
        <ListCard>{group.sessions.map((session, index) => <SessionRow key={session.id} session={session} divided={index > 0} onPress={() => onOpen(session.id)} />)}</ListCard>
      </View>)}
    {extra?.failed ? <AppText style={{ color: colors.danger }} variant="caption">No pudimos cargar más sesiones. Probá de nuevo.</AppText> : null}
    {cursor ? <Button label={extra?.loading ? 'Cargando…' : 'Ver más'} variant="secondary" disabled={extra?.loading} onPress={() => void loadMore()} /> : null}
  </ScrollScreen>;
}

function ExerciseRow({ exercise, onPress, divided }: { exercise: TrainingHistoryExercise; onPress: () => void; divided: boolean }) {
  const { colors } = useOwnlevelTheme();
  const identity = [exercise.muscleLabel ?? exercise.muscleGroup, exercise.implement].filter(Boolean).join(' · ');
  const last = exercise.lastDate ? `Última: ${shortDate(exercise.lastDate)} · ${markLabel(exercise.lastMark)}` : 'Sin registros';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${exercise.name}. ${last}. ${plural(exercise.sessions, 'sesión', 'sesiones')}`}
    onPress={onPress} testID={`history-exercise-${exercise.id}`}
    style={({ pressed }) => [styles.exerciseRow, divided ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
      pressed ? { backgroundColor: colors.surfaceRaised } : null]}>
    <View style={styles.flex}>
      <AppText numberOfLines={1} variant="label">{exercise.name}</AppText>
      {identity ? <AppText muted numberOfLines={1} variant="caption">{identity}</AppText> : null}
      <AppText muted numberOfLines={1} variant="caption">{last} · {plural(exercise.sessions, 'sesión', 'sesiones')}</AppText>
    </View>
    <AppIcon color={colors.textMuted} name="chevronRight" size={14} />
  </Pressable>;
}

function ExercisesTab({ onOpen }: { onOpen: (id: string) => void }) {
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const [query, setQuery] = useState('');
  const load = useCallback((signal: AbortSignal) => client ? fetchTrainingHistoryExercises(client, signal)
    : Promise.resolve({ status: 'unavailable' as const, reason: 'auth' as const, meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const } }), [client]);
  const { state, reload } = useRead(load);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const filtered = useMemo(() => state.status !== 'ready' ? [] : state.data.filter(exercise =>
    normalize([exercise.name, exercise.muscleGroup, exercise.muscleLabel, exercise.implement].filter(Boolean).join(' ')).includes(normalize(query))), [query, state]);
  if (state.status !== 'ready') return <ReadStateScreen state={state} onRetry={() => void reload()} testID="history-exercises" />;
  return <ScrollScreen testID="history-exercises" refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => void reload()} tintColor={colors.primary} />}>
    {state.stale ? <StaleNotice onRetry={() => void reload()} /> : null}
    {state.data.length === 0 ? <EmptyState title="Todavía no hay ejercicios registrados" description="Los ejercicios aparecen acá cuando completás series en una sesión finalizada." /> : <>
      <TextInput accessibilityLabel="Buscar ejercicio" placeholder="Buscar ejercicio" placeholderTextColor={colors.textMuted} value={query} onChangeText={setQuery}
        autoCorrect={false} clearButtonMode="while-editing" returnKeyType="search"
        style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]} />
      {filtered.length === 0 ? <EmptyState title="Sin resultados" description="Probá con otro nombre o grupo muscular." />
        : <ListCard>{filtered.map((exercise, index) => <ExerciseRow key={exercise.id} exercise={exercise} divided={index > 0} onPress={() => onOpen(exercise.id)} />)}</ListCard>}
    </>}
  </ScrollScreen>;
}

export function HistoryScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { colors } = useOwnlevelTheme();
  const [view, setView] = useState<View_>('sessions');
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => <Pressable accessibilityRole="button" accessibilityLabel="Abrir calendario de entrenamiento" hitSlop={8}
      onPress={() => router.push('/(tabs)/train/calendar')} style={styles.headerButton}><AppIcon color={colors.primary} name="calendar" size={20} /></Pressable> });
  }, [colors.primary, navigation, router]);
  return <View style={[styles.screen, { backgroundColor: colors.background }]} testID="history-screen">
    <View style={styles.segmentedWrap}><SegmentedControl label="Vista de historial" options={VIEWS} value={view} onChange={setView} /></View>
    {view === 'sessions'
      ? <SessionsTab onOpen={id => router.push(`/(tabs)/train/history/${id}`)} />
      : <ExercisesTab onOpen={id => router.push(`/(tabs)/train/history/exercise/${id}`)} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  segmentedWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  group: { gap: spacing.xs },
  flex: { flex: 1, gap: 2 },
  exerciseRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  search: { minHeight: sizes.touchTarget, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: 16 },
  headerButton: { minWidth: sizes.touchTarget, minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
});
