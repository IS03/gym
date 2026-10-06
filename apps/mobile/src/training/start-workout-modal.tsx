import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchMobileTraining, fetchMobileTrainingRoutines, startMobileTrainingSession, useApiResource, useMobileApi } from '@/api';
import type { MobileTrainingActiveSession } from '@/api/training';
import type { MobileTrainingRoutine } from '@/api/routines';
import { AppIcon, AppText, Button, Heading, InlineUnavailable, Separator, SkeletonBlock, Surface, radius, sizes, spacing, useOwnlevelTheme } from '@/design-system';
import { haptics } from '@/platform/haptics';

import { monthForDate } from './calendar';
import { activeStartRoutines, initialStartSelection, sameStartSelection, StartIntent, startCtaLabel, startRoutineMeta, validStartSelection, type StartSelection } from './start-workout-model';
import { trainingRoutineColor } from './routine-colors';

type Props = {
  initialRoutineId?: string;
  onClose: () => void;
  onContinue: (sessionId: string) => void;
  onStarted: (sessionId: string) => void;
};

const unavailableResult = {
  status: 'unavailable' as const,
  reason: 'invalid_response' as const,
  meta: { durationMs: 0, httpStatus: null, outcome: 'unavailable' as const },
};

function Choice({
  disabled, icon, label, metadata, onPress, selected, color,
}: {
  disabled: boolean;
  icon?: 'dumbbell';
  label: string;
  metadata: string;
  onPress: () => void;
  selected: boolean;
  color?: string;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <Pressable
      accessibilityLabel={`${label}, ${metadata}`}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.choice, {
        backgroundColor: selected ? colors.brandSubtle : colors.surface,
        borderColor: selected ? colors.primary : colors.border,
        opacity: pressed ? 0.65 : disabled ? 0.6 : 1,
      }]}
    >
      {icon ? <AppIcon color={colors.primary} name={icon} size={23} /> :
        <View accessibilityElementsHidden style={[styles.colorDot, { backgroundColor: color ?? colors.textMuted }]} />}
      <View style={styles.flex}>
        <AppText variant="label">{label}</AppText>
        <AppText muted variant="caption">{metadata}</AppText>
      </View>
      {selected ? <AppIcon color={colors.primary} name="check" size={23} /> : <View style={styles.checkSpacer} />}
    </Pressable>
  );
}

export function StartWorkoutModal({ initialRoutineId, onClose, onContinue, onStarted }: Props) {
  const { client } = useMobileApi();
  const { colors, isDark } = useOwnlevelTheme();
  const loadActive = useCallback((signal: AbortSignal) => client
    ? fetchMobileTraining(client, monthForDate(new Date()), signal)
    : Promise.resolve(unavailableResult), [client]);
  const loadRoutines = useCallback((signal: AbortSignal) => client
    ? fetchMobileTrainingRoutines(client, signal)
    : Promise.resolve(unavailableResult), [client]);
  const active = useApiResource(loadActive);
  const routineRead = useApiResource(loadRoutines);
  const [chosen, setChosen] = useState<StartSelection | null | undefined>(undefined);
  const [conflictActive, setConflictActive] = useState<MobileTrainingActiveSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [keyConflict, setKeyConflict] = useState(false);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const intent = useRef(new StartIntent());

  const activeResource = active.state.status === 'ready' && !active.state.refreshing
    ? active.state.current.data.activeSession : null;
  const activeSession = conflictActive ?? (activeResource?.status === 'ok' ? activeResource.data : null);
  const verifiedNoActive = !conflictActive && activeResource?.status === 'ok' && activeResource.data === null;
  const routineResource = routineRead.state.status === 'ready'
    ? routineRead.state.current.data.routines : null;
  const routineConfirmed = routineRead.state.status === 'ready' && !routineRead.state.refreshing && routineResource?.status === 'ok';
  const routines = routineResource?.status === 'ok' ? activeStartRoutines(routineResource.data) : [];
  const selected = validStartSelection(chosen === undefined
    ? initialStartSelection(routines, initialRoutineId) : chosen, routines);

  const close = () => {
    if (pendingRef.current) return;
    intent.current.reset();
    onClose();
  };
  const select = (next: StartSelection) => {
    if (pendingRef.current) return;
    if (!sameStartSelection(selected, next) || keyConflict) intent.current.reset();
    setChosen(next);
    setKeyConflict(false);
    setError(null);
    haptics.selection();
  };
  const submit = async () => {
    if (pendingRef.current || !verifiedNoActive || !selected || !client || keyConflict ||
      (selected.kind === 'routine' && !routineConfirmed)) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);
    const result = await startMobileTrainingSession(client, {
      routineId: selected.kind === 'free' ? null : selected.routineId,
      idempotencyKey: intent.current.keyFor(selected),
    });
    pendingRef.current = false;
    setPending(false);
    if (result.status === 'ok' && result.data.status === 'started') {
      haptics.selection();
      onStarted(result.data.session.id);
      return;
    }
    if (result.status === 'conflict' && result.code === 'ACTIVE_SESSION_EXISTS' && result.data?.status === 'active') {
      setConflictActive(result.data.session);
      void AccessibilityInfo.announceForAccessibility('Ya tenés una sesión en curso.');
      return;
    }
    if (result.status === 'conflict' && result.code === 'IDEMPOTENCY_KEY_REUSED') {
      setKeyConflict(true);
      setError('Este intento ya se usó con otra selección. Elegí de nuevo una opción para continuar.');
    } else if (result.status === 'validation') {
      setError(result.message);
    } else if (result.status === 'not_found') {
      setError('La rutina ya no está disponible.');
      setChosen(null);
      intent.current.reset();
      void routineRead.refresh();
    } else if (result.status === 'auth_required' || result.status === 'unauthorized') {
      setError('Tu sesión necesita volver a validarse.');
    } else {
      // An ambiguous failure retains this intent's key for an explicit manual retry.
      setError('No pudimos iniciar el entrenamiento. Revisá la conexión e intentá nuevamente.');
    }
  };

  return (
    <Modal animationType="slide" onRequestClose={close} presentationStyle="pageSheet" visible>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} testID="start-workout-modal">
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.flex}>
            <Heading level={2}>{activeSession ? 'Sesión en curso' : 'Nueva sesión'}</Heading>
            <AppText muted variant="caption">{activeSession ? 'Ya tenés un entrenamiento activo.' : '¿Qué vas a entrenar hoy?'}</AppText>
          </View>
          <Pressable accessibilityLabel="Cerrar nueva sesión" accessibilityRole="button" disabled={pending} onPress={close} style={styles.close}>
            <AppText style={styles.closeText}>×</AppText>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {activeSession ? (
            <Surface elevated style={styles.activeCard} testID="start-active-session">
              <AppIcon color={colors.primary} name="dumbbell" size={24} />
              <View style={styles.flex}>
                <AppText variant="label">{activeSession.name}</AppText>
                <AppText muted variant="caption">Solo puede haber una sesión en curso. Continuá la existente para seguir registrando tus series.</AppText>
              </View>
            </Surface>
          ) : active.state.status === 'loading' ? (
            <SkeletonBlock height={78} />
          ) : !verifiedNoActive ? (
            <Surface testID="start-active-unavailable">
              <InlineUnavailable actionLabel="Reintentar" message="No pudimos verificar si tenés una sesión en curso." onAction={() => void active.refresh()} />
            </Surface>
          ) : (
            <View accessibilityRole="radiogroup" style={styles.options}>
              {routineRead.state.status === 'loading' ? <SkeletonBlock height={74} /> : null}
              {routineRead.state.status !== 'loading' && routineResource?.status !== 'ok' ? (
                <Surface testID="start-routines-unavailable">
                  <InlineUnavailable actionLabel="Reintentar" message="No pudimos cargar tus rutinas. Todavía podés iniciar una sesión libre." onAction={() => void routineRead.refresh()} />
                </Surface>
              ) : null}
              {routineResource?.status === 'ok' && routines.length === 0 ? (
                <Surface testID="start-routines-empty"><AppText variant="label">Todavía no tenés rutinas.</AppText><AppText muted variant="caption">Podés empezar una sesión libre.</AppText></Surface>
              ) : null}
              {routines.map((routine: MobileTrainingRoutine) => (
                <Choice
                  color={routine.color ? trainingRoutineColor(routine.color, isDark) : undefined}
                  disabled={pending || !routineConfirmed}
                  key={routine.id}
                  label={routine.name}
                  metadata={startRoutineMeta(routine)}
                  onPress={() => select({ kind: 'routine', routineId: routine.id })}
                  selected={selected?.kind === 'routine' && selected.routineId === routine.id}
                />
              ))}
              <Separator />
              <Choice disabled={pending} icon="dumbbell" label="Sesión libre" metadata="Empezar sin una rutina" onPress={() => select({ kind: 'free' })} selected={selected?.kind === 'free'} />
            </View>
          )}
          {error ? <Surface accessibilityRole="alert" style={styles.errorCard}><AppText style={{ color: colors.danger }} variant="caption">{error}</AppText></Surface> : null}
        </ScrollView>
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
          {activeSession ? <Button disabled={pending} label="Continuar entrenamiento →" onPress={() => onContinue(activeSession.id)} /> :
            <Button disabled={!verifiedNoActive || !selected || keyConflict || pending || (selected?.kind === 'routine' && !routineConfirmed)} label={pending ? 'Iniciando…' : startCtaLabel(selected, routines)} onPress={() => void submit()} />}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { alignItems: 'flex-start', borderBottomWidth: 1, flexDirection: 'row', gap: spacing.sm, padding: spacing.lg },
  flex: { flex: 1, gap: spacing.xs },
  close: { alignItems: 'center', height: sizes.touchTarget, justifyContent: 'center', width: sizes.touchTarget },
  closeText: { fontSize: 28, fontWeight: '300', lineHeight: 30 },
  body: { gap: spacing.lg, padding: spacing.lg, paddingBottom: spacing.xxxl },
  options: { gap: spacing.sm },
  choice: { alignItems: 'center', borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.md, minHeight: 68, padding: spacing.md },
  colorDot: { borderRadius: radius.pill, height: 12, width: 12 },
  checkSpacer: { height: 23, width: 23 },
  activeCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  footer: { borderTopWidth: 1, padding: spacing.lg },
  errorCard: { borderColor: 'transparent' },
});
