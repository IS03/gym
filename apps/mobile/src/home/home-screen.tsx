import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import { fetchMobileHome, useApiResource, useMobileApi } from '@/api';
import {
  AppText,
  Button,
  Heading,
  ScrollScreen,
  SkeletonBlock,
  Surface,
  UnavailableState,
  radius,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';
import { haptics } from '@/platform/haptics';
import { StartWorkoutModal } from '@/training/start-workout-modal';

import {
  HomeDashboard,
  type HomeNavigationTarget,
} from './home-dashboard';

const HOME_ROUTES = {
  nutrition: '/(tabs)/nutrition',
  progress: '/(tabs)/progress',
  settings: '/settings',
} as const;

function HomeSkeleton() {
  return (
    <ScrollScreen
      accessibilityLabel="Cargando Inicio"
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
      testID="home-loading"
    >
      <View style={styles.dashboardSkeleton}>
        <View style={styles.skeletonHeader}>
          <View style={styles.skeletonProfile}>
            <SkeletonBlock height={48} style={styles.skeletonAvatar} width={48} />
            <View style={styles.skeletonProfileText}>
              <SkeletonBlock height={16} width={44} />
              <SkeletonBlock height={24} width={120} />
            </View>
          </View>
          <SkeletonBlock height={29} width={36} />
        </View>
        <SkeletonBlock height={96} style={styles.cardSkeleton} />
        <View style={styles.sectionSkeleton}>
          <SkeletonBlock height={28} width={176} />
          <Surface elevated>
            <SkeletonBlock height={24} width="56%" />
            <SkeletonBlock height={62} />
            <SkeletonBlock height={44} />
          </Surface>
        </View>
        <View style={styles.sectionSkeleton}>
          <SkeletonBlock height={28} width={208} />
          <Surface elevated>
            <SkeletonBlock height={22} width="80%" />
            <SkeletonBlock height={48} />
          </Surface>
        </View>
      </View>
    </ScrollScreen>
  );
}

function HomeUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <ScrollScreen
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
      testID="home-unavailable"
    >
      <View style={styles.unavailableHeader}>
        <View>
          <AppText muted variant="footnote">
            OWNLEVEL
          </AppText>
          <Heading>Inicio</Heading>
        </View>
      </View>
      <UnavailableState
        action={
          <Button
            accessibilityHint="Vuelve a consultar el resumen de Inicio"
            label="Reintentar"
            onPress={onRetry}
          />
        }
        description="Tus datos siguen seguros. Revisá la conexión e intentá nuevamente."
        title="No pudimos cargar Inicio"
      />
    </ScrollScreen>
  );
}

export function HomeScreen() {
  const { client } = useMobileApi();
  const { colors } = useOwnlevelTheme();
  const router = useRouter();
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
      return fetchMobileHome(client, signal);
    },
    [client],
  );
  const { refresh, state } = useApiResource(load);
  // Reflect server changes made elsewhere (e.g. a finished session) on return.
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const current =
    state.status === 'ready'
      ? state.current
      : state.status === 'loading'
        ? undefined
        : state.previous;

  const [startOpen, setStartOpen] = useState(false);

  const navigate = useCallback(
    (target: HomeNavigationTarget) => {
      haptics.selection();
      if (target === 'settings') {
        router.push(HOME_ROUTES.settings);
        return;
      }
      router.navigate(HOME_ROUTES[target]);
    },
    [router],
  );

  // Same pattern as TrainingScreen: the shared modal owns verification, idempotency
  // and conflicts; Home only opens it and follows the session it reports.
  const openStart = useCallback(() => {
    haptics.selection();
    setStartOpen(true);
  }, []);
  const toSession = useCallback((id: string) => {
    setStartOpen(false);
    void refresh();
    router.push(`/(tabs)/train/session/${id}`);
  }, [refresh, router]);
  const openSession = useCallback((id: string) => {
    haptics.selection();
    router.push(`/(tabs)/train/session/${id}`);
  }, [router]);
  const openCompletedSession = useCallback((id: string) => {
    haptics.selection();
    router.push({ pathname: '/(tabs)/train/history/[id]', params: { id } });
  }, [router]);

  const runRefresh = useCallback(() => {
    void refresh();
  }, [refresh]);

  if (!current && state.status === 'loading') {
    return <HomeSkeleton />;
  }

  if (!current) {
    return <HomeUnavailable onRetry={runRefresh} />;
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
          testID="home-refresh-control"
          tintColor={colors.primary}
        />
      }
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
      testID="home-screen"
    >
      <HomeDashboard
        data={current.data}
        isStale={state.status !== 'ready'}
        onNavigate={navigate}
        onOpenCompletedSession={openCompletedSession}
        onOpenSession={openSession}
        onRefresh={runRefresh}
        onStartWorkout={openStart}
      />
    </ScrollScreen>
    {startOpen ? (
      <StartWorkoutModal
        onClose={() => setStartOpen(false)}
        onContinue={toSession}
        onStarted={toSession}
      />
    ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  cardSkeleton: {
    borderRadius: radius.card,
  },
  dashboardSkeleton: {
    gap: spacing.xl,
  },
  sectionSkeleton: {
    gap: spacing.md,
  },
  skeletonAvatar: {
    borderRadius: radius.full,
  },
  skeletonHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  skeletonProfile: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  skeletonProfileText: {
    gap: spacing.xs,
  },
  unavailableHeader: {
    minHeight: 64,
    justifyContent: 'center',
  },
});
