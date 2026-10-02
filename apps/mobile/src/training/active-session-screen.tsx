import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Alert, AppState, Keyboard, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedProps, useAnimatedRef, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRouter } from 'expo-router';
import { usePreventRemove } from 'expo-router/build/react-navigation/core/usePreventRemove';
import type { MobileApiClient } from '@/api/client';
import type { SessionDetailDto } from '@/api/active-session';
import type { RestDeadline } from './active-session-model';
import { AppIcon, AppText, Button, Heading, InlineUnavailable, ProgressBar, ScrollScreen, SkeletonBlock, Surface, UnavailableState, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import { haptics } from '@/platform/haptics';
import { ActiveSessionController, sessionIntentKey } from './active-session-controller';
import { ActiveExerciseCard } from './active-session-exercise-card';
import { durationLabel, restRemaining } from './active-session-model';
import { SessionExercisePicker, SessionQuickHistory } from './active-session-sheets';
import { ExerciseEditorModal } from './exercise-editor-modal';
import { trainingRoutineColor } from './routine-colors';
import { useActiveSession } from './use-active-session';
import { NativeReorderItem, NativeReorderList, SessionDragScrollContext } from './session-native-interactions';
import { FinishSessionSheet } from './finish-session-sheet';
import { CompletedSessionView } from './completed-session-view';

function SessionClock({ session }: { session: SessionDetailDto['session'] }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (session.status !== 'in_progress') return;
    const interval = setInterval(() => setNow(Date.now()), 60000);
    const foreground = AppState.addEventListener('change', next => { if (next === 'active') setNow(Date.now()); });
    return () => { clearInterval(interval); foreground.remove(); };
  }, [session.status]);
  const elapsed = (session.status === 'in_progress' ? now : Date.parse(session.endedAt ?? session.startedAt)) - Date.parse(session.startedAt);
  return <AppText muted variant="caption">{session.status === 'in_progress' ? 'En curso' : 'Sesión cerrada'} · {durationLabel(elapsed)}</AppText>;
}
function SessionProgressHeader({ controller, color }: { controller: ActiveSessionController; color: string }) {
  const progress = useSyncExternalStore(controller.subscribeProgress, controller.getProgress, controller.getProgress);
  const { colors } = useOwnlevelTheme();
  return <View style={styles.progress}>
    <View style={styles.row}><AppText style={styles.flex} variant="caption">{progress.completedSets}/{progress.totalSets} series · {progress.completedExercises}/{progress.exercises} ejercicios</AppText>
      {progress.errors ? <AppText style={{ color: colors.danger }} variant="caption">{progress.errors} sin sincronizar</AppText> : progress.pending ? <AppText style={{ color: colors.primary }} variant="caption">Sincronizando</AppText> : null}
    </View>
    <ProgressBar accessibilityLabel="Progreso del entrenamiento" color={color} maximumValue={Math.max(progress.totalSets, 1)} value={progress.completedSets} />
  </View>;
}
function RestTimerPanel({ controller }: { controller: ActiveSessionController }) {
  const timer = useSyncExternalStore(controller.subscribeTimer, controller.getTimer, controller.getTimer);
  if (!timer) return null;
  return <RestTimerView key={`${timer.exerciseId}:${timer.endAt}`} controller={controller} timer={timer} />;
}
function RestTimerView({ controller, timer }: { controller: ActiveSessionController; timer: RestDeadline }) {
  const [now, setNow] = useState(Date.now);
  const { colors } = useOwnlevelTheme();
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const foreground = AppState.addEventListener('change', next => { if (next === 'active') setNow(Date.now()); });
    return () => { clearInterval(tick); foreground.remove(); };
  }, [timer]);
  const seconds = restRemaining(timer, now);
  const label = seconds ? `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}` : 'Listo';
  return <SafeAreaView edges={['bottom']} style={[styles.timerSafe, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
    <View style={styles.timer} accessibilityLabel="Temporizador de descanso">
      <AppIcon name="clock" color={colors.primary} size={22} />
      <View style={styles.flex}><AppText muted numberOfLines={1} variant="caption">Descanso · {timer.exerciseName}</AppText><AppText style={[styles.timerValue, { color: colors.primary }]} variant="heading">{label}</AppText></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Restar 15 segundos" onPress={() => controller.adjustRest(-15)} style={styles.timerButton}><AppText variant="heading">−</AppText></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel="Sumar 15 segundos" onPress={() => controller.adjustRest(15)} style={styles.timerButton}><AppText variant="heading">+</AppText></Pressable>
      <Button label="Saltar" onPress={() => controller.skipRest()} variant="quiet" />
    </View>
  </SafeAreaView>;
}
export function ActiveSessionScreen({ client, userId, sessionId }: { client: MobileApiClient; userId: string; sessionId: string }) {
  const { controller, state } = useActiveSession(client, userId, sessionId);
  return <ActiveSessionView controller={controller} state={state} client={client} />;
}
export function ActiveSessionView({ controller, state, client }: { controller: ActiveSessionController; state: ReturnType<ActiveSessionController['getSnapshot']>; client: MobileApiClient }) {
  const { colors, isDark } = useOwnlevelTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const navigation = useNavigation();
  const [expanded, setExpanded] = useState<string | null>(null);
  const expandedRef = useRef<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const creatorAfterDismiss = useRef(false);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollY = useSharedValue(0), contentHeight = useSharedValue(0);
  const dragOwner = useSharedValue<string | null>(null);
  const scrollGesture = useMemo(() => Gesture.Native().withTestId('session-native-scroll'), []);
  const scrollProps = useAnimatedProps(() => ({ scrollEnabled: dragOwner.value === null }));
  const onScroll = useAnimatedScrollHandler(event => { scrollY.set(event.contentOffset.y); });
  const dragScroll = useMemo(() => ({ ref: scrollRef, y: scrollY, contentHeight, gesture: scrollGesture, owner: dragOwner }), [scrollRef, scrollY, contentHeight, scrollGesture, dragOwner]);
  const detail = state.detail;
  const existingIds = useMemo(() => new Set(detail?.exercises.map(exercise => exercise.exerciseId) ?? []), [detail]);
  const returnToTraining = useCallback(() => router.replace('/(tabs)/train'), [router]);
  useEffect(() => { if (state.status === 'cancelled') { haptics.success(); returnToTraining(); } }, [returnToTraining, state.status]);
  const returnHome = useCallback(() => router.replace('/(tabs)/home'), [router]);
  // Confirmed finish (server truth): success feedback once, then the read-only view.
  useEffect(() => { if (state.finished) haptics.success(); }, [state.finished]);
  usePreventRemove(state.intent?.phase === 'running', ({ data }) => {
    Alert.alert('Hay una operación en curso', 'La intención se conserva para comprobar el resultado cuando vuelvas.', [
      { text: 'Esperar', style: 'cancel' }, { text: 'Volver a Entrenar', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
  const toggle = useCallback((id: string) => {
    if (expandedRef.current) void controller.flush(expandedRef.current);
    expandedRef.current = expandedRef.current === id ? null : id; setExpanded(expandedRef.current);
  }, [controller]);
  const showHistory = useCallback((id: string) => setHistoryId(id), []);
  const remove = useCallback((id: string, name: string) => Alert.alert(`¿Quitar ${name}?`, 'Se quitará sólo de esta sesión. Su última escritura en curso se comprobará antes de quitarlo.', [
    { text: 'Seguir entrenando', style: 'cancel' }, { text: 'Quitar', style: 'destructive', onPress: () => void controller.remove(id) },
  ]), [controller]);
  const openCreator = () => {
    creatorAfterDismiss.current = true; setPickerOpen(false);
    if (Platform.OS !== 'ios') { creatorAfterDismiss.current = false; setCreatorOpen(true); }
  };
  const creatorDismissed = () => { if (creatorAfterDismiss.current) { creatorAfterDismiss.current = false; setCreatorOpen(true); } };
  const intentPanel = state.intent && state.intent.phase !== 'running' ? <Surface style={{ borderColor: colors.warning }}>
    <AppText variant="label">Operación pendiente de confirmación</AppText>
    <AppText muted variant="caption">{state.notice ?? 'Conservamos la misma intención para evitar duplicados.'}</AppText>
    <Button label="Comprobar operación" onPress={() => void controller.retryIntent()} variant="secondary" />
    {state.intent.phase === 'blocked' ? <Button label="Descartar intención y actualizar" onPress={() => void controller.discardBlockedIntent()} variant="quiet" /> : null}
  </Surface> : null;
  if (!detail || state.status === 'not_found') return <ScrollScreen testID={state.status === 'loading' ? 'active-session-loading' : 'active-session-unavailable'}>
    {state.status === 'loading' ? <><SkeletonBlock height={80} /><SkeletonBlock height={100} /><SkeletonBlock height={100} /></> : <>
      <UnavailableState title={state.status === 'not_found' ? 'Sesión no disponible' : 'No pudimos cargar la sesión'}
        description={state.notice ?? 'Reintentá para comprobar su estado. Los borradores locales se conservan.'}
        action={<Button label="Reintentar" onPress={() => void controller.refresh()} />} />
      {intentPanel}<Button label="Volver a Entrenar" onPress={returnToTraining} variant="secondary" />
    </>}
  </ScrollScreen>;
  // A closed session uses its own read-only view. While an intent is unresolved
  // (e.g. a finish whose outcome is unknown) keep the recovery panel visible here.
  if (detail.session.status !== 'in_progress' && !state.intent) {
    return <CompletedSessionView detail={detail} finished={state.finished} onHome={returnHome} onTraining={returnToTraining} />;
  }
  const locked = state.fenced || state.refreshing || Boolean(state.intent) || state.finishing;
  const active = detail.session.status === 'in_progress';
  const accent = detail.session.routineId && detail.session.routineColor ? trainingRoutineColor(detail.session.routineColor, isDark) : colors.primary;
  const historyExercise = detail.exercises.find(exercise => exercise.id === historyId);
  return <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={88}>
    <SafeAreaView edges={['left', 'right']} style={styles.screen} testID="active-session-ready"><SessionDragScrollContext.Provider value={dragScroll}>
    <GestureDetector gesture={scrollGesture}><Animated.ScrollView ref={scrollRef} animatedProps={scrollProps} directionalLockEnabled removeClippedSubviews={false} onScroll={onScroll} scrollEventThrottle={16} onContentSizeChange={(_width, height) => { contentHeight.set(height); }}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.xl + insets.bottom }]} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => { setPullRefreshing(true); void controller.refresh().finally(() => setPullRefreshing(false)); }} tintColor={colors.primary} />}>
      <Surface elevated style={[styles.sessionHeader, { borderLeftColor: accent }]}>
        <AppText muted variant="overline">{active ? 'TU ENTRENAMIENTO' : 'SESIÓN CERRADA'}</AppText>
        <View style={styles.row}><Heading level={2} style={styles.flex}>{detail.session.name}</Heading>
          {state.refreshing || state.intent?.phase === 'running' ? <ActivityIndicator testID="session-background-sync" accessibilityLabel="Sincronizando sesión" size="small" color={colors.textMuted} /> : null}
        </View>
        <SessionClock session={detail.session} /><SessionProgressHeader controller={controller} color={accent} />
      </Surface>
      {state.storageError ? <InlineUnavailable actionLabel="Reintentar" onAction={() => void controller.refresh()} message="No pudimos guardar o leer el borrador en el dispositivo. Mantené esta pantalla abierta hasta sincronizar." /> : null}
      {!active ? <Surface><AppText variant="label">Esta sesión ya no está en curso</AppText><AppText muted variant="caption">Mostramos la versión guardada en modo lectura.</AppText></Surface> : null}
      {intentPanel}
      {state.notice && !state.intent ? <InlineUnavailable message={state.notice} actionLabel="Comprobar sesión" onAction={() => void controller.refresh()} /> : null}
      <View style={styles.row}><AppText style={styles.flex} variant="heading">Ejercicios</AppText>
        {active ? <Button disabled={locked || Boolean(state.interaction)} label="+ Agregar" onPress={() => setPickerOpen(true)} variant="quiet" /> : null}</View>
      {detail.exercises.length ? <NativeReorderList ids={detail.exercises.map(exercise => exercise.id)}
        onLift={() => { const accepted = controller.beginExerciseDrag(); if (accepted) Keyboard.dismiss(); return accepted; }}
        onDrop={ids => controller.dropExercises(ids)} onCancel={() => controller.cancelDrag()}>
        {detail.exercises.map(exercise => <NativeReorderItem key={exercise.id} id={exercise.id} gap={spacing.lg}>
          <ActiveExerciseCard controller={controller} id={exercise.id} expanded={expanded === exercise.id} locked={locked} onToggle={toggle} onHistory={showHistory} onRemove={remove} />
        </NativeReorderItem>)}
      </NativeReorderList> :
        <Surface><AppText muted>Esta sesión no tiene ejercicios.</AppText><AppText muted variant="caption">Agregá uno desde tu biblioteca para empezar a registrar series.</AppText></Surface>}
      {active ? <Button disabled={locked || Boolean(state.interaction)} label="Finalizar entrenamiento" onPress={() => setFinishOpen(true)} /> : null}
      <Button label="Volver a Entrenar" onPress={returnToTraining} variant="secondary" />
      {active ? <View>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen(!moreOpen)} style={styles.more}>
          <AppText muted variant="label">Más opciones</AppText><AppText muted>{moreOpen ? '−' : '+'}</AppText></Pressable>
        {moreOpen ? <Surface>
          <Pressable accessibilityRole="button" disabled={locked} onPress={() => Alert.alert('¿Cancelar entrenamiento?', 'Elimina sólo esta sesión en curso. La rutina y el historial anteriores se conservan.', [
            { text: 'Seguir entrenando', style: 'cancel' }, { text: 'Cancelar entrenamiento', style: 'destructive', onPress: () => void controller.cancel() },
          ])} style={[styles.cancelButton, { borderColor: colors.danger }]}><AppText style={{ color: colors.danger }} variant="label">Cancelar entrenamiento</AppText></Pressable>
        </Surface> : null}
      </View> : null}
    </Animated.ScrollView></GestureDetector></SessionDragScrollContext.Provider></SafeAreaView>
    <RestTimerPanel controller={controller} />
    {finishOpen && !state.finished ? <FinishSessionSheet controller={controller} onClose={() => setFinishOpen(false)} /> : null}
    <SessionExercisePicker visible={pickerOpen} client={client} existingIds={existingIds} onClose={() => setPickerOpen(false)} onDismiss={creatorDismissed} onCreate={openCreator}
      onAdd={exercise => { setPickerOpen(false); void controller.add({ operation: 'add_existing', exerciseId: exercise.id, idempotencyKey: sessionIntentKey() }); }} />
    {creatorOpen ? <ExerciseEditorModal purpose="session" target={{ mode: 'create' }} routines={[]} pending={Boolean(state.intent) || state.refreshing} createIdempotencyKey={sessionIntentKey}
      onSetStatus={() => undefined} onClose={() => setCreatorOpen(false)} onSave={async (exercise, _routineIds, key) => {
        const confirmed = await controller.add({ operation: 'create_and_add', exercise, idempotencyKey: key ?? sessionIntentKey() });
        if (confirmed || controller.getSnapshot().intent) { setCreatorOpen(false); return null; }
        return controller.getSnapshot().notice ?? 'No pudimos agregar el ejercicio.';
      }} /> : null}
    {historyExercise ? <SessionQuickHistory exercise={historyExercise} history={detail.quickHistory} onClose={() => setHistoryId(null)} onRefresh={() => void controller.refresh()} /> : null}
  </KeyboardAvoidingView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 }, flex: { flex: 1 }, content: { alignSelf: 'center', flexGrow: 1, maxWidth: sizes.contentMaxWidth, width: '100%', padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sessionHeader: { borderLeftWidth: 3, gap: spacing.sm }, progress: { gap: spacing.sm, marginTop: spacing.sm },
  more: { flexDirection: 'row', minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'space-between' },
  cancelButton: { borderWidth: 1, borderRadius: radius.md, minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center', padding: spacing.sm },
  timerSafe: { borderTopWidth: 1 }, timer: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  timerButton: { width: sizes.touchTarget, minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' }, timerValue: { fontVariant: ['tabular-nums'] },
});
