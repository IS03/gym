import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { fetchMobileTraining, useApiResource, useMobileApi } from '@/api';
import {
  AppText,
  Button,
  Heading,
  ScrollScreen,
  SkeletonBlock,
  Surface,
  UnavailableState,
  useOwnlevelTheme,
} from '@/design-system';
import { haptics } from '@/platform/haptics';

import { isoDateForDate, monthForDate } from './calendar';
import {
  TrainingDashboard,
  type TrainingDeferredAction,
} from './training-dashboard';
import { StartWorkoutModal } from './start-workout-modal';

const DEFERRED_MESSAGES: Record<Exclude<TrainingDeferredAction, 'routines' | 'exercises'>, string> = {
  history: 'Historial estará disponible en M3.4.',
};

const systemNow = () => new Date();

function TrainingSkeleton() {
  return (
    <ScrollScreen
      accessibilityLabel="Cargando Entrenar"
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
      testID="training-loading"
    >
      <View style={styles.skeletonHeader}>
        <SkeletonBlock height={40} width={154} />
        <SkeletonBlock height={22} width="88%" />
      </View>
      <SkeletonBlock height={44} style={styles.buttonSkeleton} />
      <Surface elevated>
        <SkeletonBlock height={24} width="54%" />
        <SkeletonBlock height={18} width="40%" />
        <SkeletonBlock height={258} />
      </Surface>
      <SkeletonBlock height={44} width={128} />
      <SkeletonBlock height={76} />
      <SkeletonBlock height={76} />
    </ScrollScreen>
  );
}

function TrainingUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <ScrollScreen
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
      testID="training-unavailable"
    >
      <View style={styles.unavailableHeader}>
        <Heading>Entrenar</Heading>
        <AppText muted>Entrená, organizá tus rutinas y revisá tu actividad.</AppText>
      </View>
      <UnavailableState
        action={
          <Button
            accessibilityHint="Vuelve a consultar Entrenar"
            label="Reintentar"
            onPress={onRetry}
          />
        }
        description="Tus datos siguen seguros. Revisá la conexión e intentá nuevamente."
        title="No pudimos cargar Entrenar"
      />
    </ScrollScreen>
  );
}

export function TrainingScreen({ now = systemNow }: { now?: () => Date }) {
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(
    (signal: AbortSignal) => {
      if (!client) {
        return Promise.resolve({
          status: 'unavailable' as const,
          reason: 'invalid_response' as const,
          meta: {
            durationMs: 0,
            httpStatus: null,
            outcome: 'unavailable' as const,
          },
        });
      }
      return fetchMobileTraining(client, monthForDate(now()), signal);
    },
    [client, now],
  );
  const { refresh, state } = useApiResource(load);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const current =
    state.status === 'ready'
      ? state.current
      : state.status === 'loading'
        ? undefined
        : state.previous;
  const currentDate = now();
  const today = isoDateForDate(currentDate);
  const requestedMonth = monthForDate(currentDate);

  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    [],
  );

  const runRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  const showDeferredFeedback = useCallback((action: TrainingDeferredAction) => {
    haptics.selection();
    if (action === 'routines') {
      router.push('/(tabs)/train/routines');
      return;
    }
    if (action === 'exercises') {
      router.push('/(tabs)/train/exercises');
      return;
    }
    const message = DEFERRED_MESSAGES[action];
    setNotice(message);
    void AccessibilityInfo.announceForAccessibility(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4_000);
  }, [router]);

  const openStart = useCallback(() => {
    haptics.selection();
    setStartOpen(true);
  }, []);
  const toBridge = useCallback((id: string, replace = false) => {
    setStartOpen(false);
    void refresh();
    const path = `/(tabs)/train/session/${id}` as const;
    if (replace) router.replace(path);
    else router.push(path);
  }, [refresh, router]);

  if (!current && state.status === 'loading') {
    return <TrainingSkeleton />;
  }
  if (!current) {
    return <TrainingUnavailable onRetry={runRefresh} />;
  }

  return (
    <>
    <ScrollScreen
      refreshControl={
        <RefreshControl
          colors={[colors.primary]}
          onRefresh={runRefresh}
          progressBackgroundColor={colors.surface}
          refreshing={state.status === 'ready' && state.refreshing}
          testID="training-refresh-control"
          tintColor={colors.primary}
        />
      }
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
      testID="training-screen"
    >
      <TrainingDashboard
        data={current.data}
        isStale={state.status !== 'ready'}
        notice={notice}
        onDeferredAction={showDeferredFeedback}
        onNewSession={openStart}
        onContinueSession={(id) => toBridge(id)}
        onRefresh={runRefresh}
        requestedMonth={requestedMonth}
        today={today}
      />
    </ScrollScreen>
    {startOpen ? <StartWorkoutModal onClose={() => setStartOpen(false)} onContinue={(id) => toBridge(id, true)} onStarted={(id) => toBridge(id, true)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  buttonSkeleton: {
    borderRadius: 12,
  },
  skeletonHeader: {
    gap: 8,
  },
  unavailableHeader: {
    gap: 4,
    minHeight: 88,
    justifyContent: 'center',
  },
});
