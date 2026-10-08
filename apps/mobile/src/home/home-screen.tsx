import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';

import { useMobileApi } from '@/api';
import type { QuickOption } from '@/api/nutrition-quick';
import { useMobileAuth } from '@/auth';
import {
  AppText,
  Button,
  Heading,
  ScrollScreen,
  UnavailableState,
  useOwnlevelTheme,
} from '@/design-system';
import { useNutritionConfiguration } from '@/nutrition/config-provider';
import { haptics } from '@/platform/haptics';
import { StartWorkoutModal } from '@/training/start-workout-modal';

import { HomeDashboard, type HomeNavigationTarget } from './home-dashboard';
import { useHomeResources } from './home-data';
import { homeDay } from './home-day';
import { homeLayout } from './home-layout';
import type { HomeMealEntry } from './home-nutrition';
import type { HomeProgressTarget } from './home-progress';
import type { HomeRegisterTarget } from './home-register';
import { homeResource } from './home-resource';
import { HomeStartSheet } from './home-start-sheet';

// The start flow presents its own modal; it opens once the sheet's dismissal has run.
const SHEET_DISMISS_MS = 350;

type StartRequest = { free?: boolean; immediate: boolean; routineId?: string };

const HOME_ROUTES = {
  nutrition: '/(tabs)/nutrition',
  progress: '/(tabs)/progress',
  settings: '/settings',
} as const;

function HomeUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <ScrollScreen safeAreaEdges={['top', 'left', 'right', 'bottom']} testID="home-unavailable">
      <View style={styles.unavailableHeader}>
        <View>
          <AppText muted variant="footnote">OWNLEVEL</AppText>
          <Heading>Inicio</Heading>
        </View>
      </View>
      <UnavailableState
        action={<Button accessibilityHint="Vuelve a consultar el resumen de Inicio" label="Reintentar" onPress={onRetry} />}
        description="Tus datos siguen seguros. Revisá la conexión e intentá nuevamente."
        title="No pudimos cargar Inicio"
      />
    </ScrollScreen>
  );
}

/** Google account photo carried by the Supabase session (no upload/storage in M9). */
function sessionAvatarUrl(metadata: Record<string, unknown> | undefined): string | null {
  const url = metadata?.avatar_url ?? metadata?.picture;
  return typeof url === 'string' && /^https:\/\//u.test(url) ? url : null;
}

export function HomeScreen({ now = () => new Date() }: { now?: () => Date }) {
  const { client } = useMobileApi();
  const { session } = useMobileAuth();
  const { colors } = useOwnlevelTheme();
  const router = useRouter();
  const resources = useHomeResources(client, now);
  const { refresh } = resources;
  const configuration = useNutritionConfiguration(refresh);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [start, setStart] = useState<StartRequest | null>(null);
  const startTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (startTimer.current) clearTimeout(startTimer.current); }, []);

  const home = homeResource(resources.home.state);
  const day = homeDay(now());

  const navigate = useCallback((target: HomeNavigationTarget) => {
    haptics.selection();
    if (target === 'settings') router.push(HOME_ROUTES.settings);
    else router.navigate(HOME_ROUTES[target]);
  }, [router]);

  // "Arrancar rutina" / "+ Nueva sesión" open the sheet. Picking there starts through the
  // shared modal (same as TrainingScreen): it owns verification, idempotency and conflicts;
  // Home only follows the session it reports.
  const openStart = useCallback(() => { haptics.selection(); setSheetOpen(true); }, []);
  const startAfterSheet = useCallback((request: StartRequest | null, then?: () => void) => {
    haptics.selection();
    setSheetOpen(false);
    if (startTimer.current) clearTimeout(startTimer.current);
    startTimer.current = setTimeout(() => { startTimer.current = null; if (request) setStart(request); then?.(); }, SHEET_DISMISS_MS);
  }, []);
  const toSession = useCallback((id: string) => {
    setStart(null);
    refresh();
    router.push(`/(tabs)/train/session/${id}`);
  }, [refresh, router]);

  const actions = useMemo(() => ({
    onConfigureNutrition: () => { if (configuration) configuration.controller.open(); },
    // Existing Nutrition flows: manual meal, food search, or the quick list ("Ver todas").
    onMealEntry: (entry: HomeMealEntry) => {
      haptics.selection();
      router.navigate({ pathname: '/(tabs)/nutrition', params: entry === 'quick' ? { quick: 'all' } : { add: entry } });
    },
    onOpenCalories: () => {
      haptics.selection();
      router.push({ pathname: '/(tabs)/nutrition/reports', params: { period: 'custom', from: day.weekStart, to: day.today } });
    },
    onOpenCompletedSession: (id: string) => { haptics.selection(); router.push({ pathname: '/(tabs)/train/history/[id]', params: { id } }); },
    onOpenDay: (date: string) => { haptics.selection(); router.push({ pathname: '/history/day/[date]', params: { date } }); },
    onOpenProgress: (target: HomeProgressTarget) => {
      haptics.selection();
      if (target.kind === 'body') router.push({ pathname: '/(tabs)/progress/trends/body', params: { period: target.period } });
      else if (target.kind === 'training') router.push({ pathname: '/(tabs)/progress/trends/training', params: { period: target.period } });
      else router.push({ pathname: '/(tabs)/progress/trends/exercise/[id]', params: { id: target.exerciseId, period: target.period } });
    },
    onOpenSession: (id: string) => { haptics.selection(); router.push(`/(tabs)/train/session/${id}`); },
    // A2: opens the existing quick registration with this meal; the user confirms there.
    onQuickMeal: (option: QuickOption) => {
      haptics.selection();
      router.navigate({ pathname: '/(tabs)/nutrition', params: { quick: `${option.source.kind}:${option.source.id}` } });
    },
    onRegister: (target: HomeRegisterTarget) => {
      haptics.selection();
      if (target.kind === 'metric') router.push({ pathname: '/(tabs)/progress/metrics', params: { editar: 'metricas' } });
      else router.push('/(tabs)/progress/metrics');
    },
  }), [configuration, day.today, day.weekStart, router]);

  if (!home.data && home.status === 'unavailable') {
    return <HomeUnavailable onRetry={refresh} />;
  }

  return (
    <>
      <ScrollScreen
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={refresh}
            progressBackgroundColor={colors.surface}
            refreshing={resources.home.state.status === 'ready' && resources.home.state.refreshing}
            testID="home-refresh-control"
            tintColor={colors.primary}
          />
        }
        // Blocks apply their own gutter (with the side insets) so the Nutrition band is full-bleed;
        // the bottom keeps the tab bar inset plus homeLayout.bottomExtra.
        contentContainerStyle={styles.content}
        safeAreaEdges={['top', 'bottom']}
        testID={home.data ? 'home-screen' : 'home-loading'}
      >
        <HomeDashboard
          {...actions}
          avatarUrl={sessionAvatarUrl(session?.user.user_metadata)}
          calories={homeResource(resources.calories.state)}
          day={day}
          home={home}
          now={() => now().getTime()}
          onNavigate={navigate}
          onRefresh={refresh}
          onStartWorkout={openStart}
          progressBody={homeResource(resources.progressBody.state)}
          progressRecords={homeResource(resources.progressRecords.state)}
          quick={homeResource(resources.quick.state)}
          today={homeResource(resources.today.state)}
          training={homeResource(resources.training.state)}
        />
      </ScrollScreen>
      <HomeStartSheet
        onClose={() => setSheetOpen(false)}
        onCreateRoutine={() => startAfterSheet(null, () => router.push('/(tabs)/train/routines'))}
        onFree={() => startAfterSheet({ free: true, immediate: true })}
        onPickRoutine={routineId => startAfterSheet({ immediate: true, routineId })}
        open={sheetOpen}
        plan={null}
        routines={home.data?.training.workoutStartRoutines}
        week={homeResource(resources.training.state).data}
      />
      {start ? (
        <StartWorkoutModal initialFree={start.free} initialRoutineId={start.routineId} key={start.routineId ?? 'free'} onClose={() => setStart(null)}
          onContinue={toSession} onStarted={toSession} startImmediately={start.immediate} />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: homeLayout.bottomExtra, paddingHorizontal: 0 },
  unavailableHeader: { justifyContent: 'center', minHeight: 64 },
});
