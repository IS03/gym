import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

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
import { HomeNutrition, type HomeMealEntry } from './home-nutrition';
import { HomeProgress, type HomeProgressTarget } from './home-progress';
import { HomeRegister, type HomeRegisterTarget } from './home-register';
import type { HomeResource } from './home-resource';
import { HomeCard } from './home-ui';
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
  /** Opens an existing Nutrition loading flow: manual meal, food search or the quick list. */
  onMealEntry: (entry: HomeMealEntry) => void;
  onNavigate: (target: HomeNavigationTarget) => void;
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
  progressRecords: HomeResource<ProgressTraining>;
  quick: HomeResource<QuickOptions>;
  today: HomeResource<HistoryDay>;
  training: HomeResource<HomeTrainingWeek>;
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
        <AppIcon color={colors.textMuted} name="profile" size={17} />
      )}
    </View>
  );
}

/** Large-title header (iOS): small uppercase date, "Hoy", and the profile photo (Perfil y Ajustes). */
function HomeHeader({ avatarUrl, date, onSettings, profile }: {
  avatarUrl: string | null; date: string; onSettings: () => void; profile: MobileHomeResponse['profile'] | undefined;
}) {
  const displayName = profile?.status === 'ok' ? profile.data.displayName : null;
  return (
    <View style={styles.header}>
      <View style={styles.flex}>
        <AppText muted numberOfLines={1} style={styles.date}>{headerDate(date)}</AppText>
        <AppText accessibilityRole="header" style={styles.title}>Hoy</AppText>
      </View>
      <Pressable accessibilityLabel="Abrir perfil y ajustes" accessibilityRole="button" hitSlop={8} onPress={onSettings}
        style={({ pressed }) => [styles.avatarButton, { opacity: pressed ? 0.6 : 1 }]}>
        <Avatar initial={profileInitial(displayName)} url={avatarUrl} />
      </Pressable>
    </View>
  );
}

/** Small capsule action (Volver, Elegir rutina…), never full width. */
function Capsule({ accessibilityHint, accessibilityLabel, label, onPress, tone = 'hero' }: {
  accessibilityHint?: string; accessibilityLabel?: string; label: string; onPress: () => void; tone?: 'hero' | 'heroSoft' | 'neutral';
}) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  const palette = {
    hero: { background: colors.onBrand, text: colors.brandSurface },
    heroSoft: { background: 'rgba(18,18,20,0.12)', text: colors.onBrand },
    neutral: { background: colors.surfaceRaised, text: colors.text },
  }[tone];
  return (
    <Pressable accessibilityHint={accessibilityHint} accessibilityLabel={accessibilityLabel ?? label} accessibilityRole="button" hitSlop={4} onPress={onPress}
      style={({ pressed }) => [styles.capsule, { backgroundColor: palette.background }, pressedStyle(pressed, reduceMotion)]}>
      <AppText style={[styles.capsuleLabel, { color: palette.text }]}>{label}</AppText>
    </Pressable>
  );
}

/** Champagne hero (brand gradient, core RN style with a solid fallback), sentence case. */
function Hero({ actions, label, subtitle, testID, title }: {
  actions: React.ReactNode; label: string; subtitle: string; testID: string; title: string;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const scheme = brandTokens.palette[isDark ? 'dark' : 'light'];
  return (
    <View accessibilityLabel="Entrenamiento" style={[styles.hero,
      { backgroundColor: colors.brandSurface, experimental_backgroundImage: heroGradient(scheme) }]} testID={testID}>
      <View style={styles.flex}>
        <AppText style={[styles.heroLabel, { color: colors.onBrand }]}>{label}</AppText>
        <AppText accessibilityRole="header" numberOfLines={2} style={[styles.heroTitle, { color: colors.onBrand }]}>{title}</AppText>
        <AppText numeric style={[styles.heroSubtitle, { color: colors.onBrand }]}>{subtitle}</AppText>
      </View>
      <View style={styles.heroActions}>{actions}</View>
    </View>
  );
}

function durationLabel(ms: number | null): string | null {
  return ms === null ? null : `${formatInteger(Math.max(1, Math.round(ms / 60_000)))} min`;
}

/** Every finished routine of the day (oldest first), each with a small capsule to its real detail. */
function TrainedToday({ onOpenCompletedSession, onStartWorkout, sessions }: {
  onOpenCompletedSession: (id: string) => void; onStartWorkout: () => void; sessions: MobileHomeTodaySession[];
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <HomeCard accessibilityLabel="Entrenamiento" padded={false} testID="home-trained-today">
      <View style={styles.doneHeader}>
        <AppIcon color={colors.primary} name="check" size={15} />
        <AppText accessibilityRole="header" style={[styles.doneLabel, { color: colors.primary }]}>Entrenaste hoy</AppText>
      </View>
      {sessions.map((session, index) => {
        const duration = durationLabel(session.durationMilliseconds);
        const detail = [duration, `${formatInteger(session.completedSets)} ${session.completedSets === 1 ? 'serie' : 'series'}`].filter(Boolean).join(' · ');
        return (
          <View key={session.id} style={[styles.doneRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth }]}
            testID={`home-trained-${session.id}`}>
            <View style={styles.flex}>
              <AppText numberOfLines={1} style={styles.doneName}>{session.name}</AppText>
              <AppText muted numeric variant="footnote">{detail}</AppText>
            </View>
            <Capsule accessibilityHint="Abre el detalle de la sesión" accessibilityLabel={`${session.name}. ${detail}. Ver detalle`}
              label="Ver detalle" onPress={() => onOpenCompletedSession(session.id)} tone="neutral" />
          </View>
        );
      })}
      <Pressable accessibilityLabel="Entrenar otra vez" accessibilityRole="button" hitSlop={8} onPress={onStartWorkout}
        style={({ pressed }) => [styles.again, { opacity: pressed ? 0.6 : 1 }]}>
        <AppIcon color={colors.textMuted} name="plus" size={13} />
        <AppText muted variant="footnote">Entrenar otra vez</AppText>
      </Pressable>
    </HomeCard>
  );
}

/** Training card, by priority: active session → trained today → (no plan) first step / free day. */
function TrainingCard({ home, now, onCreateRoutine, onOpenCompletedSession, onOpenSession, onRefresh, onStartWorkout }: {
  home: MobileHomeResponse | undefined; now: () => number; onCreateRoutine: () => void; onOpenCompletedSession: (id: string) => void;
  onOpenSession: (id: string) => void; onRefresh: () => void; onStartWorkout: () => void;
}) {
  if (!home) return <SkeletonBlock height={92} style={styles.cardSkeleton} />;
  const { activeSession, week, workoutStartRoutines } = home.training;

  if (activeSession.status === 'unavailable') {
    return (
      <HomeCard accessibilityLabel="Entrenamiento" testID="home-training-unavailable">
        <View style={styles.flex}>
          <AppText accessibilityRole="header" variant="headline">Estado no disponible</AppText>
          <AppText muted variant="footnote">No pudimos verificar si tenés una sesión en curso.</AppText>
        </View>
        <Button label="Reintentar" onPress={onRefresh} variant="secondary" />
      </HomeCard>
    );
  }

  const active = activeSession.data;
  if (active) {
    return (
      <Hero
        actions={<Capsule label="Volver" onPress={() => onOpenSession(active.id)} />}
        label="Sesión en curso"
        subtitle={`${elapsedMinutes(active.startedAt, now())} min · ${active.exercisesCompleted} de ${active.totalExercises} ejercicios`}
        testID="home-hero-active"
        title={active.name}
      />
    );
  }

  const doneToday = week.status === 'ok' ? [...week.data.todaySessions].sort((a, b) => a.startedAt.localeCompare(b.startedAt)) : [];
  if (doneToday.length) {
    return <TrainedToday onOpenCompletedSession={onOpenCompletedSession} onStartWorkout={onStartWorkout} sessions={doneToday} />;
  }

  // No planned routine exists in the product yet (no "Hoy toca" until Programs).
  if (workoutStartRoutines.status === 'ok' && workoutStartRoutines.data.length === 0) {
    return (
      <Hero
        actions={<><Capsule label="Crear rutina" onPress={onCreateRoutine} /><Capsule label="Entrenar libre" onPress={onStartWorkout} tone="heroSoft" /></>}
        label="Primer paso"
        subtitle="O entrená libre y la guardamos después."
        testID="home-hero-first-step"
        title="Armá tu primera rutina"
      />
    );
  }

  return (
    <Hero
      actions={<Capsule label="Elegir rutina" onPress={onStartWorkout} />}
      label="Día libre"
      subtitle="No tenés nada planificado."
      testID="home-hero-free"
      title="¿Entrenás hoy?"
    />
  );
}

function OfflineNotice({ confirmedAt, now, onRetry }: { confirmedAt: number; now: () => number; onRetry: () => void }) {
  const { colors } = useOwnlevelTheme();
  return (
    <HomeCard accessibilityRole="alert" style={styles.notice} testID="home-offline">
      <AppIcon color={colors.textMuted} name="warning" size={20} />
      <View style={styles.flex}>
        <AppText variant="headline">Uy, no pudimos actualizar</AppText>
        <AppText muted variant="footnote">
          Te mostramos lo último que cargó, de {readAge(confirmedAt, now())}. Tus datos están guardados.
        </AppText>
      </View>
      <Capsule label="Reintentar" onPress={onRetry} tone="neutral" />
    </HomeCard>
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
        <HomeNutrition home={home} onConfigure={props.onConfigureNutrition} onMealEntry={props.onMealEntry} onQuickMeal={props.onQuickMeal}
          quick={quick} today={today} />
        <HomeWeek calories={calories} onOpenDay={props.onOpenDay} onProgress={() => onNavigate('progress')} today={date}
          training={training} week={data?.training.week} weekStart={weekStart} />
        <HomeRegister date={day.today} onRegister={props.onRegister} today={today} />
        <HomeProgress body={props.progressBody} date={day.today} onAll={() => onNavigate('progress')}
          onOpen={props.onOpenProgress} onRetry={onRefresh} records={props.progressRecords} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  again: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 4, marginBottom: spacing.sm, marginHorizontal: spacing.lg, minHeight: 36 },
  avatar: { alignItems: 'center', borderRadius: radius.full, borderWidth: StyleSheet.hairlineWidth, height: 36, justifyContent: 'center', overflow: 'hidden', width: 36 },
  avatarButton: { marginBottom: 4 },
  avatarInitial: { fontSize: 15, fontWeight: '700' },
  avatarPhoto: { height: 36, width: 36 },
  blocks: { gap: spacing.md },
  capsule: { alignItems: 'center', borderRadius: radius.full, justifyContent: 'center', minHeight: 34, paddingHorizontal: 14 },
  capsuleLabel: { fontSize: 14, fontWeight: '600' },
  cardSkeleton: { borderRadius: radius.card },
  dashboard: { gap: spacing.md },
  date: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, lineHeight: 18 },
  doneHeader: { alignItems: 'center', flexDirection: 'row', gap: 6, paddingHorizontal: spacing.lg, paddingTop: 14 },
  doneLabel: { fontSize: 13, fontWeight: '600' },
  doneName: { fontSize: 17, fontWeight: '700', lineHeight: 22 },
  doneRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.lg, paddingVertical: 8 },
  flex: { flex: 1, minWidth: 0 },
  header: { alignItems: 'flex-end', flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  hero: { alignItems: 'center', borderRadius: radius.card, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, overflow: 'hidden', paddingHorizontal: spacing.lg, paddingVertical: 14 },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  heroLabel: { fontSize: 13, fontWeight: '600', opacity: 0.7 },
  heroSubtitle: { fontSize: 13, opacity: 0.75 },
  heroTitle: { fontSize: 20, fontWeight: '700', lineHeight: 25, marginTop: 1 },
  notice: { alignItems: 'flex-start', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stale: { opacity: 0.6 },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: -0.7, lineHeight: 41 },
});
