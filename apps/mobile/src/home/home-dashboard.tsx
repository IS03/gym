import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';

import type { MobileHomeResponse, MobileHomeTodaySession } from '@/api/home';
import type { HistoryDay } from '@/api/history';
import type { NutritionReport } from '@/api/nutrition-report';
import type { QuickOption, QuickOptions } from '@/api/nutrition-quick';
import type { ProgressBody, ProgressTraining } from '@/api/progress';
import {
  AppIcon,
  AppText,
  Button,
  SkeletonBlock,
  Surface,
  brandTokens,
  pressedStyle,
  radius,
  spacing,
  useOwnlevelTheme,
  useReduceMotion,
} from '@/design-system';

import { formatInteger, profileInitial } from './format';
import type { HomeTrainingWeek } from './home-data';
import { elapsedMinutes, headerDate, readAge } from './home-day';
import { HomeNutrition } from './home-nutrition';
import { HomeProgress, type HomeProgressTarget } from './home-progress';
import { HomeRegister, type HomeRegisterTarget } from './home-register';
import type { HomeResource } from './home-resource';
import { HomeWeek } from './home-week';

export type HomeNavigationTarget = 'nutrition' | 'progress' | 'settings';

export type HomeDashboardProps = {
  avatarUrl: string | null;
  calories: HomeResource<NutritionReport>;
  day: { today: string; weekStart: string };
  home: HomeResource<MobileHomeResponse>;
  now?: () => number;
  onConfigureNutrition: () => void;
  onCreateRoutine: () => void;
  onNavigate: (target: HomeNavigationTarget) => void;
  onNewMeal: () => void;
  /** Completed session detail (`/(tabs)/train/history/{id}`). */
  onOpenCompletedSession: (sessionId: string) => void;
  onOpenDay: (date: string) => void;
  onOpenProgress: (target: HomeProgressTarget) => void;
  /** Active session (`/(tabs)/train/session/{id}`), never the Training hub first. */
  onOpenSession: (sessionId: string) => void;
  onQuickMeal: (option: QuickOption) => void;
  onRefresh: () => void;
  onRegister: (target: HomeRegisterTarget) => void;
  /** Opens the shared StartWorkoutModal (Home never starts a session itself). */
  onStartWorkout: () => void;
  progressBody: HomeResource<ProgressBody>;
  progressTraining: HomeResource<ProgressTraining>;
  progressRecords: HomeResource<ProgressTraining>;
  quick: HomeResource<QuickOptions>;
  today: HomeResource<HistoryDay>;
  training: HomeResource<HomeTrainingWeek>;
};

// Real brand isotype (LEEME.md § logo): `claro` for light backgrounds, `oscuro` for dark.
const isotypes = {
  dark: require('../../assets/brand/logo/isotipo-oscuro.png'),
  light: require('../../assets/brand/logo/isotipo-claro.png'),
};

function heroGradient(scheme: { heroFrom: string; heroTo: string }) {
  return `linear-gradient(150deg, ${scheme.heroFrom} 0%, ${scheme.heroTo} 100%)`;
}

/** Google account photo from the session, with the name initial on a neutral circle as fallback. */
function Avatar({ initial, url }: { initial: string | null; url: string | null }) {
  const { colors } = useOwnlevelTheme();
  const [failed, setFailed] = useState(false);
  const photo = url && !failed;
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]} testID="home-avatar">
      {photo ? (
        <Image accessibilityIgnoresInvertColors onError={() => setFailed(true)} source={{ uri: url }} style={styles.avatarPhoto} testID="home-avatar-photo" />
      ) : initial ? (
        <AppText style={styles.avatarInitial}>{initial}</AppText>
      ) : (
        <AppIcon color={colors.textMuted} name="profile" size={20} />
      )}
    </View>
  );
}

/** Glass only on controls (IDENTIDAD.md § Vidrio): the isotype button. */
function GlassButton({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useOwnlevelTheme();
  if (isLiquidGlassAvailable()) {
    return <GlassView colorScheme={isDark ? 'dark' : 'light'} isInteractive style={styles.glass}>{children}</GlassView>;
  }
  return <View style={[styles.glass, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }]}>{children}</View>;
}

function HomeHeader({ avatarUrl, date, onSettings, profile }: {
  avatarUrl: string | null; date: string; onSettings: () => void; profile: MobileHomeResponse['profile'] | undefined;
}) {
  const { isDark } = useOwnlevelTheme();
  const displayName = profile?.status === 'ok' ? profile.data.displayName : null;
  const initial = profileInitial(displayName);
  return (
    <View style={styles.header}>
      <Pressable accessibilityHint="Perfil y ajustes" accessibilityLabel="Abrir perfil" accessibilityRole="button" onPress={onSettings}
        style={({ pressed }) => [styles.profile, { opacity: pressed ? 0.7 : 1 }]}>
        <Avatar initial={initial} url={avatarUrl} />
        <View style={styles.flex}>
          <AppText muted numberOfLines={1} style={styles.date} variant="caption">{headerDate(date)}</AppText>
        </View>
      </Pressable>
      <Pressable accessibilityLabel="Abrir ajustes" accessibilityRole="button" hitSlop={4} onPress={onSettings}
        style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })} testID="home-isotype">
        <GlassButton>
          <Image accessibilityIgnoresInvertColors resizeMode="contain" source={isDark ? isotypes.dark : isotypes.light} style={styles.isotype} />
        </GlassButton>
      </Pressable>
    </View>
  );
}

function HeroAction({ label, onPress, secondary = false }: { label: string; onPress: () => void; secondary?: boolean }) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={onPress}
      style={({ pressed }) => [styles.heroAction, secondary
        ? { backgroundColor: 'rgba(18,18,20,0.12)' }
        : { backgroundColor: colors.onBrand }, pressedStyle(pressed, reduceMotion)]}>
      <AppText style={[styles.heroActionLabel, { color: secondary ? colors.onBrand : colors.brandSurface }]}>{label}</AppText>
    </Pressable>
  );
}

/** Champagne hero (brand gradient, core RN style with a solid fallback). */
function Hero({ actions, eyebrow, stacked = false, subtitle, testID, title }: {
  actions: React.ReactNode; eyebrow: string; stacked?: boolean; subtitle: string; testID: string; title: string;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const scheme = brandTokens.palette[isDark ? 'dark' : 'light'];
  return (
    <View accessibilityLabel="Entrenamiento" style={[styles.hero, stacked && styles.heroStacked,
      { backgroundColor: colors.brandSurface, experimental_backgroundImage: heroGradient(scheme) }]} testID={testID}>
      <View style={styles.heroText}>
        <AppText style={[styles.eyebrow, { color: colors.onBrand }]}>{eyebrow}</AppText>
        <AppText accessibilityRole="header" numberOfLines={2} numeric style={[styles.heroTitle, { color: colors.onBrand }]}>{title}</AppText>
        <AppText numeric style={[styles.heroSubtitle, { color: colors.onBrand }]}>{subtitle}</AppText>
      </View>
      <View style={stacked ? styles.heroActionsStacked : styles.heroActions}>{actions}</View>
    </View>
  );
}

function lastCompleted(sessions: MobileHomeTodaySession[]): MobileHomeTodaySession | null {
  return sessions.reduce<MobileHomeTodaySession | null>((last, s) => (!last || s.endedAt > last.endedAt ? s : last), null);
}

function durationLabel(ms: number | null): string | null {
  return ms === null ? null : `${formatInteger(Math.max(1, Math.round(ms / 60_000)))} min`;
}

/** Training card, by priority: active session → trained today → (no plan) first step / free day. */
function TrainingCard({ home, now, onCreateRoutine, onOpenCompletedSession, onOpenSession, onRefresh, onStartWorkout }: {
  home: MobileHomeResponse | undefined; now: () => number; onCreateRoutine: () => void; onOpenCompletedSession: (id: string) => void;
  onOpenSession: (id: string) => void; onRefresh: () => void; onStartWorkout: () => void;
}) {
  const { colors } = useOwnlevelTheme();
  if (!home) return <SkeletonBlock height={132} style={styles.cardSkeleton} />;
  const { activeSession, week, workoutStartRoutines } = home.training;

  if (activeSession.status === 'unavailable') {
    return (
      <Surface accessibilityLabel="Entrenamiento" style={styles.statusCard} testID="home-training-unavailable">
        <View style={styles.flex}>
          <AppText accessibilityRole="header" variant="headline">Estado no disponible</AppText>
          <AppText muted variant="footnote">No pudimos verificar si tenés una sesión en curso.</AppText>
        </View>
        <Button label="Reintentar" onPress={onRefresh} variant="secondary" />
      </Surface>
    );
  }

  const active = activeSession.data;
  if (active) {
    return (
      <Hero
        actions={<HeroAction label="Volver" onPress={() => onOpenSession(active.id)} />}
        eyebrow="SESIÓN EN CURSO"
        subtitle={`${active.exercisesCompleted} de ${active.totalExercises} ejercicios`}
        testID="home-hero-active"
        title={`${active.name} · ${elapsedMinutes(active.startedAt, now())} min`}
      />
    );
  }

  const done = week.status === 'ok' ? lastCompleted(week.data.todaySessions) : null;
  if (done) {
    const duration = durationLabel(done.durationMilliseconds);
    return (
      <Surface accessibilityLabel="Entrenamiento" style={styles.doneCard} testID="home-trained-today">
        <View style={styles.doneRow}>
          <View style={[styles.doneIcon, { backgroundColor: colors.brandSubtle }]}>
            <AppIcon color={colors.primary} name="check" size={20} />
          </View>
          <View style={styles.flex}>
            <AppText style={[styles.eyebrow, { color: colors.primary }]}>ENTRENASTE HOY</AppText>
            <AppText accessibilityRole="header" numberOfLines={2} numeric variant="headline">{duration ? `${done.name} · ${duration}` : done.name}</AppText>
          </View>
        </View>
        <View style={styles.doneActions}>
          <View style={styles.doneButton}><Button label="Ver detalle" onPress={() => onOpenCompletedSession(done.id)} variant="secondary" /></View>
          <View style={styles.doneButton}><Button label="Entrenar otra vez" onPress={onStartWorkout} /></View>
        </View>
      </Surface>
    );
  }

  // No planned routine exists in the product yet (no "Hoy toca" until Programs).
  if (workoutStartRoutines.status === 'ok' && workoutStartRoutines.data.length === 0) {
    return (
      <Hero
        actions={<><HeroAction label="Crear rutina" onPress={onCreateRoutine} /><HeroAction label="Entrenar libre" onPress={onStartWorkout} secondary /></>}
        eyebrow="PRIMER PASO"
        stacked
        subtitle="O entrená libre y la guardamos después."
        testID="home-hero-first-step"
        title="Armá tu primera rutina"
      />
    );
  }

  return (
    <Hero
      actions={<HeroAction label="Elegir rutina" onPress={onStartWorkout} />}
      eyebrow="DÍA LIBRE"
      subtitle="No tenés nada planificado. Elegí una rutina."
      testID="home-hero-free"
      title="¿Entrenás hoy?"
    />
  );
}

function OfflineNotice({ confirmedAt, now, onRetry }: { confirmedAt: number; now: () => number; onRetry: () => void }) {
  const { colors } = useOwnlevelTheme();
  return (
    <Surface accessibilityRole="alert" style={styles.notice} testID="home-offline">
      <AppIcon color={colors.textMuted} name="warning" size={20} />
      <View style={styles.flex}>
        <AppText variant="headline">Uy, no pudimos actualizar</AppText>
        <AppText muted variant="footnote">
          Te mostramos lo último que cargó, de {readAge(confirmedAt, now())}. Tus datos están guardados.
        </AppText>
      </View>
      <Pressable accessibilityLabel="Reintentar" accessibilityRole="button" hitSlop={6} onPress={onRetry}
        style={({ pressed }) => [styles.noticeAction, { backgroundColor: colors.surfaceRaised, opacity: pressed ? 0.7 : 1 }]}>
        <AppText style={styles.noticeActionLabel}>Reintentar</AppText>
      </Pressable>
    </Surface>
  );
}

export function HomeDashboard(props: HomeDashboardProps) {
  const { avatarUrl, calories, day, home, onNavigate, onRefresh, quick, today, training } = props;
  const now = props.now ?? Date.now;
  const data = home.data;
  const stale = home.status === 'unavailable' && !!data;
  const date = data?.date ?? day.today;
  const weekStart = data?.training.week.status === 'ok' ? data.training.week.data.summary.weekStart : day.weekStart;
  return (
    <View style={styles.dashboard} testID="real-home-dashboard">
      <HomeHeader avatarUrl={avatarUrl} date={date} onSettings={() => onNavigate('settings')} profile={data?.profile} />
      {stale && home.confirmedAt !== null ? <OfflineNotice confirmedAt={home.confirmedAt} now={now} onRetry={onRefresh} /> : null}
      <View style={[styles.blocks, stale && styles.stale]}>
        <TrainingCard home={data} now={now} onCreateRoutine={props.onCreateRoutine} onOpenCompletedSession={props.onOpenCompletedSession}
          onOpenSession={props.onOpenSession} onRefresh={onRefresh} onStartWorkout={props.onStartWorkout} />
        <HomeNutrition home={home} onConfigure={props.onConfigureNutrition} onNewMeal={props.onNewMeal} onQuickMeal={props.onQuickMeal}
          quick={quick} today={today} />
        <HomeWeek calories={calories} onOpenDay={props.onOpenDay} onProgress={() => onNavigate('progress')} today={date}
          training={training} week={data?.training.week} weekStart={weekStart} />
        <HomeRegister date={day.today} onRegister={props.onRegister} today={today} />
        <HomeProgress body={props.progressBody} date={day.today} onAll={() => onNavigate('progress')}
          onOpen={props.onOpenProgress} onRetry={onRefresh} records={props.progressRecords} training={props.progressTraining} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  avatarInitial: { fontSize: 17, fontWeight: '700' },
  avatarPhoto: { height: 44, width: 44 },
  blocks: { gap: spacing.md },
  cardSkeleton: { borderRadius: radius.card },
  dashboard: { gap: spacing.xl },
  date: { fontWeight: '600', letterSpacing: 0.7 },
  doneActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  doneButton: { flexGrow: 1, flexBasis: 140 },
  doneCard: { gap: spacing.lg, minHeight: 132, padding: 18 },
  doneIcon: { alignItems: 'center', borderRadius: radius.full, height: 36, justifyContent: 'center', width: 36 },
  doneRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  eyebrow: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, opacity: 0.75 },
  flex: { flex: 1, gap: 2, minWidth: 150 },
  glass: { alignItems: 'center', borderRadius: radius.full, height: 44, justifyContent: 'center', overflow: 'hidden', width: 44 },
  header: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between', minHeight: 44 },
  hero: { alignItems: 'center', borderRadius: radius.card, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, minHeight: 132, overflow: 'hidden', padding: spacing.xl, paddingLeft: 18 },
  heroAction: { alignItems: 'center', borderRadius: radius.button, flexGrow: 1, justifyContent: 'center', minHeight: 50, paddingHorizontal: spacing.lg },
  heroActionLabel: { fontSize: 15, fontWeight: '600' },
  heroActions: { flexDirection: 'row' },
  heroActionsStacked: { alignSelf: 'stretch', flexDirection: 'row', gap: spacing.sm },
  heroStacked: { alignItems: 'stretch', flexDirection: 'column' },
  heroSubtitle: { fontSize: 13, marginTop: 2, opacity: 0.78 },
  heroText: { flex: 1, minWidth: 170 },
  heroTitle: { fontSize: 19, fontWeight: '700', letterSpacing: -0.2, marginTop: 2 },
  isotype: { height: 24, width: 30 },
  notice: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  noticeAction: { alignItems: 'center', borderRadius: radius.chip, justifyContent: 'center', minHeight: 32, paddingHorizontal: spacing.md },
  noticeActionLabel: { fontSize: 13, fontWeight: '600' },
  profile: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: spacing.md, minHeight: 44, minWidth: 0 },
  stale: { opacity: 0.6 },
  statusCard: { gap: spacing.md },
});
