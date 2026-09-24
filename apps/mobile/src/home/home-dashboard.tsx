import { Pressable, StyleSheet, View } from 'react-native';

import type {
  MobileHomeResponse,
  MobileHomeTodaySession,
} from '@/api/home';
import {
  AppIcon,
  AppText,
  IconCircle,
  InlineUnavailable,
  PressableSurface,
  ProgressBar,
  SectionHeader,
  Separator,
  Surface,
  radius,
  sizes,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';

import {
  addIsoDays,
  entriesByCount,
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

export type HomeNavigationTarget =
  | 'nutrition'
  | 'progress'
  | 'settings'
  | 'train';

type HomeDashboardProps = {
  data: MobileHomeResponse;
  isStale: boolean;
  onNavigate: (target: HomeNavigationTarget) => void;
  onRefresh: () => void;
};

function BrandButton({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors } = useOwnlevelTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.brandButton,
        {
          backgroundColor: colors.onBrand,
          opacity: pressed ? 0.82 : 1,
        },
      ]}
    >
      <AppText style={{ color: colors.brandSurface }} variant="label">
        {label}
      </AppText>
      <AppIcon color={colors.brandSurface} name="chevronRight" size={16} />
    </Pressable>
  );
}

function HomeHeader({
  data,
  onSettings,
}: {
  data: MobileHomeResponse['profile'];
  onSettings: () => void;
}) {
  const { colors } = useOwnlevelTheme();
  const displayName = data.status === 'ok' ? data.data.displayName : null;
  const label = firstName(displayName);
  const initial = profileInitial(displayName);

  return (
    <View style={styles.header}>
      <View accessibilityLabel="OWNLEVEL" style={styles.brandLockup}>
        <View style={[styles.brandMark, { backgroundColor: colors.brandSurface }]}>
          <AppIcon color={colors.onBrand} name="brand" size={19} />
        </View>
        <AppText style={styles.brandWordmark} variant="overline">
          OWNLEVEL
        </AppText>
      </View>
      <Pressable
        accessibilityLabel="Abrir perfil y ajustes"
        accessibilityRole="button"
        onPress={onSettings}
        style={({ pressed }) => [
          styles.profileButton,
          {
            backgroundColor: pressed ? colors.surfaceRaised : colors.surface,
            borderColor: colors.border,
          },
        ]}
      >
        <View style={[styles.avatar, { backgroundColor: colors.brandSubtle }]}>
          {initial ? (
            <AppText style={{ color: colors.primary }} variant="caption">
              {initial}
            </AppText>
          ) : (
            <AppIcon color={colors.primary} name="profile" size={15} />
          )}
        </View>
        <AppText numberOfLines={1} style={styles.profileLabel} variant="caption">
          {label}
        </AppText>
        <AppIcon color={colors.textMuted} name="chevronRight" size={13} />
      </Pressable>
    </View>
  );
}

function PrimaryTrainingCard({
  activeSession,
  date,
  onRefresh,
  onTrain,
  workoutStartRoutines,
}: {
  activeSession: MobileHomeResponse['training']['activeSession'];
  date: string;
  onRefresh: () => void;
  onTrain: () => void;
  workoutStartRoutines: MobileHomeResponse['training']['workoutStartRoutines'];
}) {
  const { colors } = useOwnlevelTheme();
  const session = activeSession.status === 'ok' ? activeSession.data : null;
  const routineCount =
    workoutStartRoutines.status === 'ok'
      ? workoutStartRoutines.data.length
      : null;

  return (
    <Surface
      accessibilityLabel="Entrenamiento"
      elevated
      style={[
        styles.trainingCard,
        {
          backgroundColor: colors.brandSurface,
          borderColor: colors.brandSurface,
        },
      ]}
    >
      <View
        accessibilityElementsHidden
        style={[
          styles.trainingOrbLarge,
          { backgroundColor: colors.onBrand },
        ]}
      />
      <View
        accessibilityElementsHidden
        style={[
          styles.trainingOrbSmall,
          { backgroundColor: colors.onBrand },
        ]}
      />

      {activeSession.status === 'unavailable' ? (
        <View style={styles.trainingContent}>
          <AppText style={[styles.brandEyebrow, { color: colors.onBrand }]}>
            ENTRENAMIENTO
          </AppText>
          <AppText
            accessibilityRole="header"
            style={[styles.trainingTitle, { color: colors.onBrand }]}
          >
            Estado no disponible
          </AppText>
          <AppText style={{ color: colors.onBrand }}>
            No pudimos verificar si tenés una sesión en curso.
          </AppText>
          <BrandButton label="Reintentar" onPress={onRefresh} />
        </View>
      ) : session ? (
        <View style={styles.trainingContent}>
          <View
            style={[
              styles.sessionBadge,
              { backgroundColor: colors.onBrand },
            ]}
          >
            <AppText style={{ color: colors.brandSurface }} variant="caption">
              Sesión en curso
            </AppText>
          </View>
          <View>
            <AppText
              accessibilityRole="header"
              numberOfLines={1}
              style={[styles.trainingTitle, { color: colors.onBrand }]}
            >
              {session.name}
            </AppText>
            <AppText style={[styles.brandSecondary, { color: colors.onBrand }]}>
              {session.logDate === date ? 'Hoy' : session.logDate} · iniciada{' '}
              {formatClockTime(session.startedAt)}
            </AppText>
          </View>
          <View style={styles.trainingProgress}>
            <View style={styles.trainingProgressLabels}>
              <AppText
                style={[styles.brandSecondary, { color: colors.onBrand }]}
                variant="caption"
              >
                {session.exercisesCompleted}/{session.totalExercises}{' '}
                {session.totalExercises === 1 ? 'ejercicio' : 'ejercicios'} ·{' '}
                {session.completedSets}/{session.totalSets}{' '}
                {session.totalSets === 1 ? 'serie' : 'series'}
              </AppText>
              <AppText style={{ color: colors.onBrand }} variant="label">
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
          <BrandButton label="Ir a Entrenar" onPress={onTrain} />
        </View>
      ) : (
        <View style={styles.trainingContent}>
          <AppText style={[styles.brandEyebrow, { color: colors.onBrand }]}>
            ENTRENAMIENTO
          </AppText>
          <AppText
            accessibilityRole="header"
            style={[styles.trainingTitle, { color: colors.onBrand }]}
          >
            Listo para entrenar
          </AppText>
          <AppText style={[styles.brandSecondary, { color: colors.onBrand }]}>
            {routineCount === null
              ? 'Abrí Entrenar para organizar tu próxima sesión.'
              : routineCount > 0
                ? `${plural(routineCount, 'rutina')} disponibles para tu próxima sesión.`
                : 'Abrí Entrenar para organizar tu próxima sesión.'}
          </AppText>
          <BrandButton label="Ir a Entrenar" onPress={onTrain} />
        </View>
      )}
    </Surface>
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
              <AppText style={styles.heroMetric}>
                {formatInteger(summary.calories)}{' '}
                <AppText muted variant="caption">
                  kcal
                </AppText>
              </AppText>
              <AppText muted variant="caption">
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
            <AppText style={styles.smallMetric}>
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
            <AppText style={styles.smallMetric}>
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
            <AppText style={styles.smallMetric}>
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
            <AppText variant="label">
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
  const { colors } = useOwnlevelTheme();
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
  const routines = entriesByCount(summary.routines);
  const muscles = entriesByCount(summary.muscleGroups);
  const visibleMuscles = muscles.slice(0, 3);
  const routineSummary = routines.length
    ? routines.map(([name, count]) => `${name} ×${count}`).join(' · ')
    : 'Sin rutinas completadas';
  const muscleSummary = visibleMuscles.length
    ? `${visibleMuscles.map(([name, sets]) => `${name} ${sets}`).join(' · ')}${muscles.length > visibleMuscles.length ? ` · +${muscles.length - visibleMuscles.length}` : ''}`
    : 'Sin series registradas';

  return (
    <View>
      <SectionHeader
        actionLabel="Ver Progreso"
        onAction={onProgress}
        title="Progreso de la semana"
      />
      <PressableSurface
        accessibilityHint="Abre el tab Progreso"
        accessibilityLabel="Ver progreso semanal"
        onPress={onProgress}
      >
        <View style={styles.weekLead}>
          <IconCircle icon="calendar" />
          <View style={styles.flex}>
            <AppText muted variant="overline">
              ESTA SEMANA
            </AppText>
            <AppText style={styles.weekHeadline}>
              {activeThisWeek
                ? `${plural(summary.sessions, 'completado', 'completados')} · 1 en curso`
                : summary.sessions > 0
                  ? `${plural(summary.sessions, 'entrenamiento')} · ${formatTrainingMinutes(summary.minutes)}`
                  : '0 entrenamientos'}
            </AppText>
          </View>
        </View>

        <View style={styles.weekStats}>
          <View style={styles.weekStat}>
            <AppText style={styles.smallMetric}>{formatInteger(summary.sessions)}</AppText>
            <AppText muted variant="caption">Entrenos</AppText>
          </View>
          <View style={styles.weekStat}>
            <AppText style={styles.smallMetric}>{formatInteger(summary.sets)}</AppText>
            <AppText muted variant="caption">Series</AppText>
          </View>
          <View style={styles.weekStat}>
            <AppText style={styles.smallMetric}>{formatTrainingMinutes(summary.minutes)}</AppText>
            <AppText muted variant="caption">Tiempo</AppText>
          </View>
        </View>

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

        <Separator />
        <View style={styles.summaryRow}>
          <IconCircle icon="routines" size="small" />
          <View style={styles.flex}>
            <AppText muted variant="caption">Rutinas</AppText>
            <AppText numberOfLines={2} variant="label">{routineSummary}</AppText>
          </View>
        </View>
        <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
        <View style={styles.summaryRow}>
          <IconCircle icon="dumbbell" size="small" />
          <View style={styles.flex}>
            <AppText muted variant="caption">Músculos principales</AppText>
            <AppText numberOfLines={2} variant="label">{muscleSummary}</AppText>
          </View>
          <AppIcon color={colors.textMuted} name="chevronRight" size={15} />
        </View>
      </PressableSurface>
    </View>
  );
}

function SessionRow({
  badge,
  meta,
  name,
  onPress,
  summary,
}: {
  badge?: string;
  meta: string;
  name: string;
  onPress: () => void;
  summary: string;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <Pressable
      accessibilityHint="Abre el tab Entrenar"
      accessibilityLabel={`${name}. ${badge ? `${badge}. ` : ''}${meta}. ${summary}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.sessionRow,
        { backgroundColor: pressed ? colors.surfaceRaised : colors.surface },
      ]}
    >
      <IconCircle icon="dumbbell" size="small" />
      <View style={styles.flex}>
        <View style={styles.sessionTitleRow}>
          <AppText numberOfLines={1} style={styles.sessionName} variant="label">
            {name}
          </AppText>
          {badge ? (
            <View style={[styles.activeBadge, { backgroundColor: colors.brandSubtle }]}>
              <AppText style={{ color: colors.primary }} variant="caption">
                {badge}
              </AppText>
            </View>
          ) : null}
        </View>
        <AppText muted variant="caption">{meta}</AppText>
        <AppText muted variant="caption">{summary}</AppText>
      </View>
      <AppIcon color={colors.textMuted} name="chevronRight" size={15} />
    </Pressable>
  );
}

function completedSessionMeta(session: MobileHomeTodaySession): string {
  const duration = formatDuration(session.durationMilliseconds);
  return [formatTimeRange(session.startedAt, session.endedAt), duration]
    .filter(Boolean)
    .join(' · ');
}

function TodaySessions({
  activeSession,
  date,
  onTrain,
  week,
}: {
  activeSession: MobileHomeResponse['training']['activeSession'];
  date: string;
  onTrain: () => void;
  week: MobileHomeResponse['training']['week'];
}) {
  if (week.status === 'unavailable') {
    return null;
  }
  const active =
    activeSession.status === 'ok' && activeSession.data?.logDate === date
      ? activeSession.data
      : null;
  const sessions = week.data.todaySessions;
  if (!active && sessions.length === 0) {
    return null;
  }

  return (
    <View>
      <SectionHeader title="Sesiones de hoy" />
      <Surface elevated style={styles.sessionsSurface}>
        {active ? (
          <SessionRow
            badge="En curso"
            meta={`${formatClockTime(active.startedAt)} · En curso`}
            name={active.name}
            onPress={onTrain}
            summary={`${active.exercisesCompleted}/${active.totalExercises} ejercicios · ${active.completedSets}/${active.totalSets} series`}
          />
        ) : null}
        {active && sessions.length > 0 ? <Separator /> : null}
        {sessions.map((session, index) => (
          <View key={session.id}>
            {index > 0 ? <Separator /> : null}
            <SessionRow
              meta={completedSessionMeta(session)}
              name={session.name}
              onPress={onTrain}
              summary={`${plural(session.exercisesCompleted, 'ejercicio')} · ${plural(session.completedSets, 'serie')}`}
            />
          </View>
        ))}
      </Surface>
    </View>
  );
}

const quickActions: {
  icon: 'dumbbell' | 'nutrition' | 'progress' | 'settings';
  label: string;
  target: HomeNavigationTarget;
}[] = [
  { icon: 'dumbbell', label: 'Entrenar', target: 'train' },
  { icon: 'nutrition', label: 'Nutrición', target: 'nutrition' },
  { icon: 'progress', label: 'Progreso', target: 'progress' },
  { icon: 'settings', label: 'Ajustes', target: 'settings' },
];

function QuickAccess({
  onNavigate,
}: {
  onNavigate: (target: HomeNavigationTarget) => void;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <View>
      <SectionHeader title="Accesos rápidos" />
      <View style={styles.quickGrid}>
        {quickActions.map((action) => (
          <PressableSurface
            accessibilityLabel={`Abrir ${action.label}`}
            key={action.target}
            onPress={() => onNavigate(action.target)}
            style={styles.quickAction}
          >
            <IconCircle icon={action.icon} size="small" />
            <AppText style={styles.quickLabel} variant="label">
              {action.label}
            </AppText>
            <AppIcon color={colors.textMuted} name="chevronRight" size={14} />
          </PressableSurface>
        ))}
      </View>
    </View>
  );
}

export function HomeDashboard({
  data,
  isStale,
  onNavigate,
  onRefresh,
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
      <PrimaryTrainingCard
        activeSession={data.training.activeSession}
        date={data.date}
        onRefresh={onRefresh}
        onTrain={() => onNavigate('train')}
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
        activeSession={data.training.activeSession}
        date={data.date}
        onTrain={() => onNavigate('train')}
        week={data.training.week}
      />
      <QuickAccess onNavigate={onNavigate} />
    </View>
  );
}

const styles = StyleSheet.create({
  activeBadge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  avatar: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
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
    borderRadius: radius.md,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.lg,
  },
  brandEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    lineHeight: 16,
    opacity: 0.78,
  },
  brandLockup: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  brandMark: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  brandSecondary: {
    marginTop: spacing.xs,
    opacity: 0.8,
  },
  brandWordmark: {
    letterSpacing: 1.8,
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
    justifyContent: 'space-between',
    minHeight: sizes.touchTarget,
  },
  heroMetric: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 33,
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
  profileButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    maxWidth: '55%',
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing.sm,
  },
  profileLabel: {
    flexShrink: 1,
  },
  quickAction: {
    alignItems: 'center',
    flexBasis: '48%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickLabel: {
    flex: 1,
  },
  sessionBadge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    opacity: 0.92,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sessionName: {
    flex: 1,
    minWidth: 0,
  },
  sessionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sessionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sessionsSurface: {
    gap: 0,
    overflow: 'hidden',
    padding: 0,
  },
  smallMetric: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 24,
  },
  summaryDivider: {
    height: 1,
    marginLeft: 46,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
  },
  trainingCard: {
    borderRadius: radius.xl,
    minHeight: 232,
    overflow: 'hidden',
    padding: spacing.xl,
  },
  trainingContent: {
    flex: 1,
    gap: spacing.md,
    justifyContent: 'space-between',
    zIndex: 1,
  },
  trainingOrbLarge: {
    borderRadius: radius.pill,
    height: 132,
    opacity: 0.07,
    position: 'absolute',
    right: -38,
    top: -52,
    width: 132,
  },
  trainingOrbSmall: {
    borderRadius: radius.pill,
    height: 74,
    opacity: 0.06,
    position: 'absolute',
    right: 42,
    top: 38,
    width: 74,
  },
  trainingProgress: {
    gap: spacing.sm,
  },
  trainingProgressLabels: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  trainingTitle: {
    fontSize: 27,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 33,
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
    borderRadius: radius.pill,
    height: 14,
    justifyContent: 'center',
    width: 14,
  },
  weekDotInner: {
    borderRadius: radius.pill,
    height: 5,
    width: 5,
  },
  weekHeadline: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 23,
  },
  weekLead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  weekStat: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  weekStats: {
    flexDirection: 'row',
  },
});
