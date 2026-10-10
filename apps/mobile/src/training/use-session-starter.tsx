import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Modal, StyleSheet, View } from 'react-native';

import { AppText, GlassSurface, radius, spacing, useOwnlevelTheme } from '@/design-system';

import { useWorkoutStart } from './use-workout-start';

export type SessionStartRequest = { free?: boolean; routineId?: string };

const AMBIGUOUS = 'No pudimos iniciar el entrenamiento. Revisá la conexión e intentá nuevamente.';

/** Small "Iniciando…" HUD on glass; it also blocks touches so a second tap can't start twice. */
function StartingHud() {
  const { colors } = useOwnlevelTheme();
  return (
    <Modal animationType="fade" statusBarTranslucent transparent visible>
      <View accessibilityLabel="Iniciando entrenamiento" accessibilityRole="progressbar" style={styles.backdrop} testID="session-starting">
        <GlassSurface style={styles.hud}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="subheadline">Iniciando…</AppText>
        </GlassSurface>
      </View>
    </Modal>
  );
}

/**
 * Starts the chosen session with no chooser UI: the same shared flow as before (active
 * session check, idempotency key, explicit retry with the same key, conflicts), with native
 * alerts for the cases that need a decision.
 */
function HeadlessStart({ onDone, onSession, request }: { onDone: () => void; onSession: (id: string) => void; request: SessionStartRequest }) {
  const flow = useWorkoutStart({ initialFree: request.free, initialRoutineId: request.routineId, onClose: onDone, onStarted: onSession });
  const submitted = useRef(false);
  const alerted = useRef<string | null>(null);
  const activeState = flow.active.state;
  const activeRead = activeState.status === 'ready' && !activeState.refreshing ? activeState.current.data.activeSession : null;
  const activeUnknown = activeState.status === 'unavailable' || (activeRead !== null && activeRead.status !== 'ok');
  const ready = flow.selected?.kind === 'routine' ? flow.routineConfirmed : flow.selected?.kind === 'free';
  const routineGone = !!request.routineId && flow.routineConfirmed && flow.selected === null;

  useEffect(() => {
    const once = (key: string, show: () => void) => { if (alerted.current !== key) { alerted.current = key; show(); } };
    if (flow.activeSession) {
      const active = flow.activeSession;
      once(`active:${active.id}`, () => Alert.alert('Ya tenés una sesión en curso', `${active.name}. Solo puede haber una a la vez.`, [
        { onPress: onDone, style: 'cancel', text: 'Cancelar' },
        { onPress: () => onSession(active.id), text: 'Continuar' },
      ]));
      return;
    }
    if (activeUnknown && !submitted.current) {
      once('verify', () => Alert.alert('No pudimos verificar tu sesión', 'No sabemos si tenés una sesión en curso. Revisá la conexión e intentá nuevamente.', [
        { onPress: onDone, style: 'cancel', text: 'Cancelar' },
        { onPress: () => { alerted.current = null; void flow.active.refresh(); }, text: 'Reintentar' },
      ]));
      return;
    }
    if (routineGone && !submitted.current) {
      once('gone', () => Alert.alert('La rutina ya no está disponible', undefined, [{ onPress: onDone, text: 'OK' }]));
      return;
    }
    if (flow.error) {
      const error = flow.error;
      // Only an ambiguous result can be retried, and always with the same idempotency key.
      once(`error:${error}`, () => Alert.alert('No pudimos iniciar el entrenamiento', error === AMBIGUOUS ? 'Revisá la conexión e intentá nuevamente.' : error,
        error === AMBIGUOUS
          ? [{ onPress: onDone, style: 'cancel', text: 'Cancelar' }, { onPress: () => { alerted.current = null; void flow.submit(); }, text: 'Reintentar' }]
          : [{ onPress: onDone, text: 'OK' }]));
      return;
    }
    if (!submitted.current && flow.verifiedNoActive && ready) {
      submitted.current = true;
      void flow.submit();
    }
  });
  return <StartingHud />;
}

/** One start at a time; `start` is safe to call from a confirmation or after a sheet closes. */
export function useSessionStarter({ onSession }: { onSession: (id: string) => void }): { element: ReactNode; start: (request: SessionStartRequest) => void } {
  const [request, setRequest] = useState<(SessionStartRequest & { id: number }) | null>(null);
  const counter = useRef(0);
  const element = request ? (
    <HeadlessStart key={request.id} onDone={() => setRequest(null)} onSession={id => { setRequest(null); onSession(id); }} request={request} />
  ) : null;
  return { element, start: next => setRequest(current => current ?? { ...next, id: ++counter.current }) };
}

const styles = StyleSheet.create({
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.08)', flex: 1, justifyContent: 'center' },
  hud: { alignItems: 'center', borderRadius: radius.card, gap: spacing.sm, justifyContent: 'center', minWidth: 140, paddingHorizontal: spacing.xl, paddingVertical: spacing.lg },
});
