import { useCallback } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { fetchMobileHome, useApiResource, useMobileApi } from '@/api';
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

import {
  HomeDashboard,
  type HomeNavigationTarget,
} from './home-dashboard';

const HOME_ROUTES = {
  nutrition: '/(tabs)/nutrition',
  progress: '/(tabs)/progress',
  settings: '/settings',
  train: '/(tabs)/train',
} as const;

function HomeSkeleton() {
  return (
    <ScrollScreen
      accessibilityLabel="Cargando Inicio"
      safeAreaEdges={['top', 'left', 'right', 'bottom']}
      testID="home-loading"
    >
      <View style={styles.skeletonHeader}>
        <SkeletonBlock height={38} width={142} />
        <SkeletonBlock height={44} width={44} />
      </View>
      <SkeletonBlock height={244} style={styles.heroSkeleton} />
      <SkeletonBlock height={28} width={176} />
      <Surface elevated>
        <SkeletonBlock height={24} width="56%" />
        <SkeletonBlock height={62} />
        <SkeletonBlock height={44} />
      </Surface>
      <SkeletonBlock height={28} width={208} />
      <Surface elevated>
        <SkeletonBlock height={64} />
        <SkeletonBlock height={48} />
        <SkeletonBlock height={42} />
      </Surface>
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
          <AppText muted variant="overline">
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
  const current =
    state.status === 'ready'
      ? state.current
      : state.status === 'loading'
        ? undefined
        : state.previous;

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
        onRefresh={runRefresh}
      />
    </ScrollScreen>
  );
}

const styles = StyleSheet.create({
  heroSkeleton: {
    borderRadius: 24,
  },
  skeletonHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  unavailableHeader: {
    minHeight: 64,
    justifyContent: 'center',
  },
});
