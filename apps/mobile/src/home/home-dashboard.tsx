import { Image, Pressable, StyleSheet, View } from 'react-native';

import type {
  MobileHomeResponse,
  MobileHomeTodaySession,
} from '@/api/home';
import {
  AppIcon,
  AppText,
  Button,
  IconCircle,
  InlineUnavailable,
  ListGroup,
  ListRow,
  PressableSurface,
  ProgressBar,
  SectionHeader,
  Separator,
  Surface,
  appIconSize,
  brandTokens,
  pressedStyle,
  radius,
  sizes,
  spacing,
  useOwnlevelTheme,
  useReduceMotion,
} from '@/design-system';

import {
  addIsoDays,
  firstName,
  formatClockTime,
  formatDecimal,
  formatDuration,
  formatEnergyBalance,
  formatInteger,
  formatTimeRange,
  formatTrainingMinutes,
  plural,
  profileInitial,
} from './format';

export type HomeNavigationTarget = 'nutrition' | 'progress' | 'settings';

type HomeDashboardProps = {
  data: MobileHomeResponse;
  isStale: boolean;
  onNavigate: (target: HomeNavigationTarget) => void;
  /** Completed session detail (`/(tabs)/train/history/{id}`). */
  onOpenCompletedSession: (sessionId: string) => void;
  /** Active session (`/(tabs)/train/session/{id}`), never the Training hub first. */
  onOpenSession: (sessionId: string) => void;
  onRefresh: () => void;
  /** Opens the shared StartWorkoutModal (Home never starts a session itself). */
  onStartWorkout: () => void;
};

// Real brand isotype (LEEME.md § logo): `claro` for light backgrounds, `oscuro` for dark.
const isotypes = {
  dark: require('../../assets/brand/logo/isotipo-oscuro.png'),
  light: require('../../assets/brand/logo/isotipo-claro.png'),
};

// Hero gradient as the brand defines it (theme.css `bg-hero`), with the solid start
// color as fallback. Core RN style: no extra dependency or dev client rebuild.
function heroGradient(scheme: { heroFrom: string; heroTo: string }) {
  return `linear-gradient(150deg, ${scheme.heroFrom} 0%, ${scheme.heroTo} 100%)`;
}

function BrandButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useOwnlevelTheme();
  const reduceMotion = useReduceMotion();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.brandButton,
        { backgroundColor: colors.onBrand },
        pressedStyle(pressed, reduceMotion),
      ]}
    >
      <AppText style={{ color: colors.brandSurface }} variant="headline">
        {label}
      </AppText>
      <AppIcon color={colors.brandSurface} name="chevronRight" size={appIconSize.inline} />
    </Pressable>
  );
}

function Avatar({ initial }: { initial: string | null }) {
  const { colors } = useOwnlevelTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.avatar,
        { backgroundColor: initial ? colors.brandSubtle : colors.surfaceRaised, borderColor: colors.border },
      ]}
      testID="home-avatar"
    >
      {initial ? (
        <AppText style={[styles.avatarInitial, { color: colors.primary }]}>{initial}</AppText>
      ) : (
        <AppIcon color={colors.textMuted} name="profile" size={appIconSize.row} />
      )}
    </View>
  );
}

function HomeHeader({
  data,
  onSettings,
}: {
  data: MobileHomeResponse['profile'];
  onSettings: () => void;
}) {
  const { isDark } = useOwnlevelTheme();
  const displayName = data.status === 'ok' ? data.data.displayName : null;
  const initial = profileInitial(displayName);
  const name = initial ? firstName(displayName) : null;

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityLabel="Abrir perfil y ajustes"
        accessibilityRole="button"
        onPress={onSettings}
        style={({ pressed }) => [styles.profile, { opacity: pressed ? 0.7 : 1 }]}
      >
        <Avatar initial={initial} />
        <View style={styles.flex}>
          {name ? (
            <>
              <AppText muted variant="subheadline">Hola,</AppText>
              <AppText numberOfLines={1} variant="title2">{name}</AppText>
            </>
          ) : (
            <AppText numberOfLines={1} variant="title2">Hola</AppText>
          )}
        </View>
      </Pressable>
      <Pressable
        accessibilityLabel="Abrir ajustes"
        accessibilityRole="button"
        hitSlop={6}
        onPress={onSettings}
        style={({ pressed }) => [styles.isotypeButton, { opacity: pressed ? 0.6 : 1 }]}
        testID="home-isotype"
      >
        <Image
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          source={isDark ? isotypes.dark : isotypes.light}
          style={styles.isotype}
        />
      </Pressable>
    </View>
  );
}

function TrainingStatusCard({
  onRefresh,
  onStartWorkout,
  unavailable,
  workoutStartRoutines,
}: {
  onRefresh: () => void;
  onStartWorkout: () => void;
  unavailable: boolean;
  workoutStartRoutines: MobileHomeResponse['training']['workoutStartRoutines'];
}) {
  const { colors } = useOwnlevelTheme();
  if (unavailable) {
    return (
      <Surface accessibilityLabel="Entrenamiento" elevated style={styles.compactCard}>
        <View style={styles.compactText}>
          <AppText muted variant="footnote">Entrenamiento</AppText>
          <AppText accessibilityRole="header" variant="headline">Estado no disponible</AppText>
          <AppText muted variant="subheadline">
            No pudimos verificar si tenés una sesión en curso.
          </AppText>
        </View>
        <Button label="Reintentar" onPress={onRefresh} variant="secondary" />
      </Surface>
    );
  }

  const routineCount =
    workoutStartRoutines.status === 'ok' ? workoutStartRoutines.data.length : null;
  const routineCopy =
    routineCount === null
      ? 'No pudimos cargar tus rutinas.'
      : routineCount > 0
        ? `${plural(routineCount, 'rutina')} ${routineCount === 1 ? 'disponible' : 'disponibles'}`
        : 'Podés empezar una sesión libre.';

  return (
    <View accessibilityLabel="Entrenamiento">
      <PressableSurface
        accessibilityHint="Abre el selector para empezar una sesión"
        accessibilityLabel="Nueva sesión"
        onPress={onStartWorkout}
        style={styles.compactRow}
      >
        <IconCircle icon="dumbbell" />
        <View style={styles.compactText}>
          <AppText muted variant="footnote">Entrenamiento</AppText>
          <AppText accessibilityRole="header" variant="headline">Listo para entrenar</AppText>
          <AppText muted numeric numberOfLines={2} variant="subheadline">{routineCopy}</AppText>
        </View>
        <View style={styles.compactAction}>
          <AppText style={{ color: colors.primary }} variant="subheadline">Nueva sesión</AppText>
          <AppIcon color={colors.primary} name="chevronRight" size={appIconSize.inline} />
        </View>
      </PressableSurface>
    </View>
  );
}

function ActiveSessionHero({
  date,
  onContinue,
  session,
}: {
  date: string;
  onContinue: () => void;
  session: NonNullable<Extract<MobileHomeResponse['training']['activeSession'], { status: 'ok' }>['data']>;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const scheme = brandTokens.palette[isDark ? 'dark' : 'light'];
  return (
    <View
      accessibilityLabel="Entrenamiento"
      style={[
        styles.hero,
        { backgroundColor: colors.brandSurface, experimental_backgroundImage: heroGradient(scheme) },
      ]}
      testID="home-active-hero"
    >
      <View style={[styles.sessionBadge, { backgroundColor: colors.onBrand }]}>
        <AppText style={{ color: colors.brandSurface }} variant="caption">
          Sesión en curso
        </AppText>
      </View>
      <View>
        <AppText
          accessibilityRole="header"
          numberOfLines={1}
          style={{ color: colors.onBrand }}
          variant="title1"
        >
          {session.name}
        </AppText>
        <AppText numeric style={[styles.heroSecondary, { color: colors.onBrand }]} variant="subheadline">
          {session.logDate === date ? 'Hoy' : session.logDate} · iniciada{' '}
          {formatClockTime(session.startedAt)}
        </AppText>
      </View>
      <View style={styles.heroProgress}>
        <View style={styles.heroProgressLabels}>
          <AppText numeric style={[styles.flex, styles.heroSecondary, { color: colors.onBrand }]} variant="footnote">
            {session.exercisesCompleted}/{session.totalExercises}{' '}
            {session.totalExercises === 1 ? 'ejercicio' : 'ejercicios'} ·{' '}
            {session.completedSets}/{session.totalSets}{' '}
            {session.totalSets === 1 ? 'serie' : 'series'}
          </AppText>
          <AppText numeric style={{ color: colors.onBrand }} variant="headline">
            {session.progressPercent}%
          </AppText>
        </View>
        <ProgressBar
          accessibilityLabel={`Progreso de la sesión: ${session.progressPercent}%`}
          color={colors.onBrand}
          trackColor={colors.brandSubtle}
          value={session.progressPercent}
        />
      </View>
      <BrandButton label="Continuar entrenamiento" onPress={onContinue} />
    </View>
  );
}

function TrainingSection({
  activeSession,
  date,
  onOpenSession,
  onRefresh,
  onStartWorkout,
  workoutStartRoutines,
}: {
  activeSession: MobileHomeResponse['training']['activeSession'];
  date: string;
  onOpenSession: (sessionId: string) => void;
  onRefresh: () => void;
  onStartWorkout: () => void;
  workoutStartRoutines: MobileHomeResponse['training']['workoutStartRoutines'];
}) {
  const session = activeSession.status === 'ok' ? activeSession.data : null;
  if (session) {
    return <ActiveSessionHero date={date} onContinue={() => onOpenSession(session.id)} session={session} />;
  }
  return (
    <TrainingStatusCard
      onRefresh={onRefresh}
      onStartWorkout={onStartWorkout}
      unavailable={activeSession.status === 'unavailable'}
      workoutStartRoutines={workoutStartRoutines}
    />
  );
}

function NutritionSummary({
  nutrition,
  onNutrition,
}: {
  nutrition: MobileHomeResponse['nutrition'];
  onNutrition: () => void;
}) {
  const { colors } = useOwnlevelTheme();
  if (nutrition.status === 'unavailable') {
    return (
      <View>
        <SectionHeader
          actionLabel="Ver Nutrición"
          onAction={onNutrition}
          title="Resumen de hoy"
        />
        <Surface elevated>
          <InlineUnavailable message="No pudimos cargar Nutrición." />
        </Surface>
      </View>
    );
  }

  const summary = nutrition.data;

  return (
    <View>
      <SectionHeader
        actionLabel="Ver Nutrición"
        onAction={onNutrition}
        title="Resumen de hoy"
      />
      <PressableSurface
        accessibilityHint="Abre el tab Nutrición"
        accessibilityLabel="Ver resumen de Nutrición"
        onPress={onNutrition}
      >
        <View style={styles.nutritionLead}>
          <IconCircle icon="flame" />
          <View style={styles.flex}>
            <AppText muted variant="caption">
              Calorías consumidas
            </AppText>
            <View style={styles.metricBetween}>
              <AppText numeric style={styles.heroMetric}>
                {formatInteger(summary.calories)}{' '}
                <AppText muted variant="caption">
                  kcal
                </AppText>
              </AppText>
              <AppText muted numeric variant="caption">
                {summary.calorieTarget !== null
                  ? `de ${formatInteger(summary.calorieTarget)} kcal`
                  : 'Sin objetivo'}
              </AppText>
            </View>
          </View>
        </View>
        {summary.calorieTarget && summary.calorieTarget > 0 ? (
          <ProgressBar
            accessibilityLabel={`${formatInteger(summary.calories)} de ${formatInteger(summary.calorieTarget)} calorías`}
            maximumValue={summary.calorieTarget}
            value={summary.calories}
          />
        ) : null}
        <View style={[styles.metricGrid, { borderColor: colors.border }]}>
          <View style={styles.metricCell}>
            <AppText numeric style={styles.smallMetric}>
              {formatDecimal(summary.proteinG)} g
            </AppText>
            <AppText muted variant="caption">
              Proteína
            </AppText>
            <AppText muted numberOfLines={1} variant="caption">
              {summary.proteinTargetG === null
                ? 'Sin objetivo'
                : `de ${formatDecimal(summary.proteinTargetG)} g`}
            </AppText>
            {summary.proteinTargetG && summary.proteinTargetG > 0 ? (
              <ProgressBar
                accessibilityLabel={`${formatDecimal(summary.proteinG)} de ${formatDecimal(summary.proteinTargetG)} gramos de proteína`}
                maximumValue={summary.proteinTargetG}
                value={summary.proteinG}
              />
            ) : null}
          </View>
          <View
            style={[
              styles.metricCell,
              styles.metricCellBorder,
              { borderColor: colors.border },
            ]}
          >
            <AppText numeric style={styles.smallMetric}>
              {formatInteger(summary.mealCount)}
            </AppText>
            <AppText muted variant="caption">
              {summary.mealCount === 1 ? 'Comida' : 'Comidas'}
            </AppText>
            <AppText muted variant="caption">
              cargadas
            </AppText>
          </View>
          <View
            style={[
              styles.metricCell,
              styles.metricCellBorder,
              { borderColor: colors.border },
            ]}
          >
            <AppText numeric style={styles.smallMetric}>
              {summary.waterL === null ? '—' : formatDecimal(summary.waterL)} L
            </AppText>
            <AppText muted variant="caption">
              Agua
            </AppText>
            <AppText muted numberOfLines={1} variant="caption">
              {summary.waterTargetL === null
                ? 'Sin objetivo'
                : `de ${formatDecimal(summary.waterTargetL)} L`}
            </AppText>
          </View>
        </View>
        <Separator />
        <View style={styles.balanceRow}>
          <IconCircle icon="activity" size="small" />
          <View style={styles.flex}>
            <AppText muted variant="caption">
              Balance estimado
            </AppText>
            <AppText numeric variant="label">
              {formatEnergyBalance(summary.energyBalanceKcal)}
            </AppText>
          </View>
          <AppIcon color={colors.textMuted} name="chevronRight" size={15} />
        </View>
      </PressableSurface>
    </View>
  );
}

function WeekDay({
  active,
  completed,
  date,
  label,
  today,
}: {
  active: boolean;
  completed: boolean;
  date: string;
  label: string;
  today: boolean;
}) {
  const { colors } = useOwnlevelTheme();
  const state = active && completed
    ? 'entrenamiento completado y sesión en curso'
    : active
      ? 'sesión en curso'
      : completed
        ? 'entrenamiento completado'
        : 'sin entrenamiento';
  return (
    <View
      accessibilityLabel={`${label}, ${date}: ${state}${today ? ', hoy' : ''}`}
      accessible
      style={styles.weekDay}
    >
      <AppText muted variant="caption">
        {label}
      </AppText>
      <View
        style={[
          styles.weekDot,
          {
            backgroundColor: completed ? colors.primary : colors.surfaceRaised,
            borderColor: active ? colors.primary : 'transparent',
            borderWidth: active ? 2 : 0,
          },
        ]}
      >
        {active && completed ? (
          <View style={[styles.weekDotInner, { backgroundColor: colors.surface }]} />
        ) : null}
      </View>
      <AppText
        style={{ color: today ? colors.primary : colors.textMuted }}
        variant="caption"
      >
        {today ? 'Hoy' : ' '}
      </AppText>
    </View>
  );
}

function WeeklyProgress({
  activeSession,
  date,
  onProgress,
  week,
}: {
  activeSession: MobileHomeResponse['training']['activeSession'];
  date: string;
  onProgress: () => void;
  week: MobileHomeResponse['training']['week'];
}) {
  if (week.status === 'unavailable') {
    return (
      <View>
        <SectionHeader
          actionLabel="Ver Progreso"
          onAction={onProgress}
          title="Progreso de la semana"
        />
        <Surface elevated>
          <InlineUnavailable message="No pudimos cargar el resumen semanal." />
        </Surface>
      </View>
    );
  }

  const summary = week.data.summary;
  const completedDays = new Set(summary.trainingDays);
  const session =
    activeSession.status === 'ok' ? activeSession.data : null;
  const activeThisWeek =
    session &&
    session.logDate >= summary.weekStart &&
    session.logDate <= summary.weekEnd
      ? session
      : null;
  const headline = [
    activeThisWeek
      ? `${plural(summary.sessions, 'completado', 'completados')} · 1 en curso`
      : plural(summary.sessions, 'entrenamiento'),
    plural(summary.sets, 'serie'),
    formatTrainingMinutes(summary.minutes),
  ].join(' · ');

  return (
    <View>
      <SectionHeader
        actionLabel="Ver Progreso"
        onAction={onProgress}
        title="Progreso de la semana"
      />
      <PressableSurface
        accessibilityHint="Abre el tab Progreso"
        accessibilityLabel={`Ver progreso semanal: ${headline}`}
        onPress={onProgress}
      >
        <AppText numeric variant="headline">{headline}</AppText>
        <View accessibilityLabel="Actividad de esta semana" style={styles.weekDays}>
          {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((label, index) => {
            const day = addIsoDays(summary.weekStart, index);
            return (
              <WeekDay
                active={activeThisWeek?.logDate === day}
                completed={completedDays.has(day)}
                date={day}
                key={day}
                label={label}
                today={day === date}
              />
            );
          })}
        </View>
      </PressableSurface>
    </View>
  );
}

function completedSessionMeta(session: MobileHomeTodaySession): string {
  const duration = formatDuration(session.durationMilliseconds);
  return [formatTimeRange(session.startedAt, session.endedAt), duration]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Completed sessions of today only: the active session already leads Home in the hero,
 * so it is never repeated here.
 */
function TodaySessions({
  onOpenCompletedSession,
  week,
}: {
  onOpenCompletedSession: (sessionId: string) => void;
  week: MobileHomeResponse['training']['week'];
}) {
  if (week.status === 'unavailable' || week.data.todaySessions.length === 0) {
    return null;
  }

  return (
    <View>
      <SectionHeader title="Sesiones de hoy" />
      <ListGroup>
        {week.data.todaySessions.map((session) => {
          const meta = completedSessionMeta(session);
          const summary = `${plural(session.exercisesCompleted, 'ejercicio')} · ${plural(session.completedSets, 'serie')}`;
          return (
            <ListRow
              accessibilityHint="Abre el detalle de la sesión"
              accessibilityLabel={`${session.name}. ${meta}. ${summary}`}
              icon="dumbbell"
              key={session.id}
              onPress={() => onOpenCompletedSession(session.id)}
              subtitle={`${meta}\n${summary}`}
              title={session.name}
            />
          );
        })}
      </ListGroup>
    </View>
  );
}

export function HomeDashboard({
  data,
  isStale,
  onNavigate,
  onOpenCompletedSession,
  onOpenSession,
  onRefresh,
  onStartWorkout,
}: HomeDashboardProps) {
  return (
    <View style={styles.dashboard} testID="real-home-dashboard">
      <HomeHeader data={data.profile} onSettings={() => onNavigate('settings')} />
      {isStale ? (
        <InlineUnavailable
          actionLabel="Reintentar"
          message="No se pudo actualizar. Mostramos la última lectura confirmada."
          onAction={onRefresh}
        />
      ) : null}
      <TrainingSection
        activeSession={data.training.activeSession}
        date={data.date}
        onOpenSession={onOpenSession}
        onRefresh={onRefresh}
        onStartWorkout={onStartWorkout}
        workoutStartRoutines={data.training.workoutStartRoutines}
      />
      <NutritionSummary
        nutrition={data.nutrition}
        onNutrition={() => onNavigate('nutrition')}
      />
      <WeeklyProgress
        activeSession={data.training.activeSession}
        date={data.date}
        onProgress={() => onNavigate('progress')}
        week={data.training.week}
      />
      <TodaySessions
        onOpenCompletedSession={onOpenCompletedSession}
        week={data.training.week}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  avatarInitial: {
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 24,
  },
  balanceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
  },
  brandButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: radius.button,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: brandTokens.layout.buttonHeight,
    paddingHorizontal: spacing.lg,
  },
  compactAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  compactCard: {
    gap: spacing.md,
  },
  compactRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  compactText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  dashboard: {
    gap: spacing.xl,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: sizes.touchTarget,
  },
  hero: {
    borderRadius: radius.card,
    gap: spacing.lg,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  heroMetric: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 33,
  },
  heroProgress: {
    gap: spacing.sm,
  },
  heroProgressLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  heroSecondary: {
    marginTop: spacing.xs,
    opacity: 0.8,
  },
  isotype: {
    height: 29,
    width: 36,
  },
  isotypeButton: {
    alignItems: 'center',
    height: sizes.touchTarget,
    justifyContent: 'center',
    width: sizes.touchTarget,
  },
  metricBetween: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  metricCell: {
    flex: 1,
    gap: 2,
    minHeight: 76,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  metricCellBorder: {
    borderLeftWidth: 1,
  },
  metricGrid: {
    borderTopWidth: 1,
    flexDirection: 'row',
    paddingTop: spacing.md,
  },
  nutritionLead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  profile: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: sizes.touchTarget,
    minWidth: 0,
  },
  sessionBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    opacity: 0.92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  smallMetric: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 24,
  },
  weekDay: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  weekDays: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  weekDot: {
    alignItems: 'center',
    borderRadius: radius.full,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  weekDotInner: {
    borderRadius: radius.full,
    height: 5,
    width: 5,
  },
});
