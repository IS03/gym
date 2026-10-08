import { BottomSheet, Host, RNHostView } from '@expo/ui';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { MobileHomeResponse, MobileHomeWorkoutStartRoutine } from '@/api/home';
import { AppIcon, AppText, InlineUnavailable, SkeletonBlock, radius, spacing, useOwnlevelTheme } from '@/design-system';
import { trainingRoutineColor } from '@/training/routine-colors';

import { formatDuration, plural } from './format';
import type { HomeTrainingWeek } from './home-data';
import { HomeButton, HomeLink, HomeRow, HomeRowSeparator } from './home-ui';

/**
 * Today's planned routine. There are no plans in the product yet, so Home always passes
 * null; when plans exist the sheet opens on "Hoy te toca X" with "Elegir otra rutina".
 */
export type HomeStartPlan = { routineId: string; routineName: string };

type Routines = MobileHomeResponse['training']['workoutStartRoutines'] | undefined;

/**
 * "Última vez" from the history Home already read (newest first). A routine missing from
 * a partial read says what it has, never "Sin registros" (it may have older sessions).
 */
export function routineLastTime(routine: MobileHomeWorkoutStartRoutine, week: HomeTrainingWeek | undefined): string {
  const last = week?.recent.find(session => session.routineId === routine.id);
  if (last) {
    const duration = formatDuration(last.durationMilliseconds);
    return `Última vez: ${[duration, plural(last.completedSets, 'serie')].filter(Boolean).join(' · ')}`;
  }
  if (week?.historyComplete) return 'Sin registros todavía';
  return `${plural(routine.exerciseCount, 'ejercicio')} · ${plural(routine.setCount, 'serie')}`;
}

export function HomeStartContent({ onCreateRoutine, onFree, onPickRoutine, plan, routines, week }: {
  onCreateRoutine: () => void; onFree: () => void; onPickRoutine: (routineId: string) => void;
  plan: HomeStartPlan | null; routines: Routines; week: HomeTrainingWeek | undefined;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const [choosing, setChoosing] = useState(false);
  const free = (
    <HomeRow accessibilityHint="Empieza una sesión sin rutina" chevron leading={<View style={styles.leading}><AppIcon color={colors.textMuted} name="plus" size={17} /></View>}
      onPress={onFree} subtitle="Sin rutina, cargás lo que hagas" testID="home-start-free" title="Entrenar libre" />
  );

  if (plan && !choosing) {
    return (
      <View style={styles.content} testID="home-start-plan">
        <View style={styles.head}>
          <AppText muted variant="subheadline">Hoy te toca</AppText>
          <AppText accessibilityRole="header" variant="title2">{plan.routineName}</AppText>
        </View>
        <HomeButton label="Empezar" onPress={() => onPickRoutine(plan.routineId)} testID="home-start-plan-start" tone="solid" />
        <View style={styles.center}><HomeLink label="Elegir otra rutina" onPress={() => setChoosing(true)} /></View>
      </View>
    );
  }

  const list = routines?.status === 'ok' ? routines.data : null;
  return (
    <View style={styles.content} testID="home-start-choose">
      <View style={styles.head}>
        <AppText accessibilityRole="header" variant="title2">¿Qué entrenás hoy?</AppText>
        <AppText muted variant="subheadline">
          {list && list.length === 0 ? 'Todavía no tenés rutinas. Creá una o entrená libre.' : 'Todavía no tenés una planificación activa. Elegí una rutina para empezar.'}
        </AppText>
      </View>
      <View>
        {!routines ? <SkeletonBlock height={56} /> : null}
        {routines?.status === 'unavailable' ? <InlineUnavailable message="No pudimos cargar tus rutinas. Podés entrenar libre." /> : null}
        {list?.map((routine, index) => {
          const detail = routineLastTime(routine, week);
          return (
            <View key={routine.id}>
              {index > 0 ? <HomeRowSeparator inset /> : null}
              <HomeRow accessibilityHint="Empieza esta rutina" accessibilityLabel={`${routine.name}. ${detail}`} chevron
                leading={<View style={styles.leading}><View style={[styles.dot, { backgroundColor: routine.color ? trainingRoutineColor(routine.color, isDark) : colors.textMuted }]} /></View>}
                onPress={() => onPickRoutine(routine.id)} subtitle={detail} testID={`home-start-routine-${routine.id}`} title={routine.name} />
            </View>
          );
        })}
        {list && list.length === 0 ? (
          <HomeRow accessibilityHint="Abre tus rutinas" chevron leading={<View style={styles.leading}><AppIcon color={colors.primary} name="plus" size={17} /></View>}
            onPress={onCreateRoutine} testID="home-start-create" title="Crear rutina" />
        ) : null}
        {list || routines?.status === 'unavailable' ? <HomeRowSeparator inset /> : null}
        {free}
      </View>
    </View>
  );
}

/** Native sheet with detents (SwiftUI sheet through @expo/ui, like the Training calendar). */
export function HomeStartSheet({ onClose, open, ...props }: Parameters<typeof HomeStartContent>[0] & { onClose: () => void; open: boolean }) {
  const { colors, isDark } = useOwnlevelTheme();
  return (
    <Host colorScheme={isDark ? 'dark' : 'light'} style={styles.host}>
      <BottomSheet containerColor={colors.background} contentPadding={0} isPresented={open} onDismiss={onClose} showDragIndicator snapPoints={['half', 'full']}
        testID="home-start-sheet">
        <RNHostView>
          <ScrollView contentContainerStyle={styles.scroll} style={{ backgroundColor: colors.background }}>
            <HomeStartContent {...props} />
          </ScrollView>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  content: { gap: spacing.lg },
  dot: { borderRadius: radius.full, height: 10, width: 10 },
  head: { gap: spacing.xs },
  host: { height: 0, position: 'absolute', width: 0 },
  leading: { alignItems: 'flex-start', justifyContent: 'center', width: 28 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl, paddingTop: spacing.xl },
});
