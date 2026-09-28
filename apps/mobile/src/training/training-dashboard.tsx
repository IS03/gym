import { StyleSheet, View } from 'react-native';

import type {
  MobileTrainingCalendarDay,
  MobileTrainingResponse,
} from '@/api/training';
import {
  AppIcon,
  AppText,
  Button,
  Heading,
  IconCircle,
  InlineUnavailable,
  PressableSurface,
  Surface,
  radius,
  sizes,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';

import {
  buildTrainingMonth,
  formatTrainingDate,
  formatTrainingMonth,
} from './calendar';
import {
  trainingRoutineColor,
  trainingRoutineColorLabel,
} from './routine-colors';

export type TrainingDeferredAction =
  | 'continueSession'
  | 'exercises'
  | 'history'
  | 'newSession'
  | 'routines';

type TrainingDashboardProps = {
  data: MobileTrainingResponse;
  isStale: boolean;
  notice: string | null;
  onDeferredAction: (action: TrainingDeferredAction) => void;
  onRefresh: () => void;
  requestedMonth: string;
  today: string;
};

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;
const WEEKDAY_NAMES = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const;

function TrainingHeader() {
  return (
    <View style={styles.header}>
      <Heading>Entrenar</Heading>
      <AppText muted>Entrená, organizá tus rutinas y revisá tu actividad.</AppText>
    </View>
  );
}

function SessionSection({
  activeSession,
  onAction,
  onRefresh,
}: {
  activeSession: MobileTrainingResponse['activeSession'];
  onAction: (action: TrainingDeferredAction) => void;
  onRefresh: () => void;
}) {
  const { colors } = useOwnlevelTheme();
  if (activeSession.status === 'unavailable') {
    return (
      <Surface elevated testID="training-session-unavailable">
        <AppText variant="label">Sesión en curso</AppText>
        <InlineUnavailable
          actionLabel="Reintentar"
          message="No pudimos verificar si tenés una sesión en curso."
          onAction={onRefresh}
        />
      </Surface>
    );
  }
  if (!activeSession.data) {
    return (
      <Button
        accessibilityHint="Muestra información sobre la disponibilidad del inicio de sesión"
        label="+ Nueva sesión"
        onPress={() => onAction('newSession')}
      />
    );
  }
  return (
    <Surface
      elevated
      style={styles.activeSession}
      testID="training-active-session"
    >
      <View style={styles.activeSessionLead}>
        <IconCircle icon="dumbbell" />
        <View style={styles.flex}>
          <AppText style={{ color: colors.primary }} variant="caption">
            Sesión en curso
          </AppText>
          <AppText numberOfLines={2} style={styles.activeSessionName} variant="heading">
            {activeSession.data.name}
          </AppText>
          <AppText muted variant="caption">
            Iniciada {formatTrainingDate(activeSession.data.logDate)}
          </AppText>
        </View>
      </View>
      <Button
        accessibilityHint="Muestra información sobre la disponibilidad del entrenamiento activo"
        label="Continuar entrenamiento →"
        onPress={() => onAction('continueSession')}
      />
    </Surface>
  );
}

function calendarDayLabel(
  day: MobileTrainingCalendarDay | undefined,
  date: string,
  weekdayIndex: number,
  today: string,
): string {
  const parts = [`${WEEKDAY_NAMES[weekdayIndex]} ${formatTrainingDate(date)}`];
  if (date === today) parts.push('hoy');
  if (!day || day.colors.length === 0) {
    parts.push('sin entrenamiento');
  } else {
    parts.push(
      `entrenamiento: ${day.colors.map(trainingRoutineColorLabel).join(', ')}`,
    );
  }
  return parts.join(', ');
}

function CalendarCard({
  calendar,
  onRefresh,
  requestedMonth,
  today,
}: {
  calendar: MobileTrainingResponse['calendar'];
  onRefresh: () => void;
  requestedMonth: string;
  today: string;
}) {
  const { colors, isDark } = useOwnlevelTheme();
  const month = calendar.status === 'ok' ? calendar.data.month : requestedMonth;
  const weeks = buildTrainingMonth(month);
  const trainedDays = calendar.status === 'ok' ? calendar.data.days : [];
  const daysByDate = new Map(trainedDays.map((day) => [day.date, day]));
  const activeDayCount = trainedDays.filter(
    (day) => day.date.startsWith(`${month}-`) && day.date <= today,
  ).length;
  const activityLabel = activeDayCount === 1
    ? '1 día con entrenamiento'
    : `${activeDayCount} días con entrenamiento`;

  return (
    <Surface
      accessibilityLabel="Calendario de entrenamiento de este mes"
      elevated
      style={styles.calendarCard}
      testID="training-calendar"
    >
      <View style={styles.calendarTitleRow}>
        <View style={styles.flex}>
          <AppText style={styles.calendarTitle} variant="label">
            {formatTrainingMonth(month)}
          </AppText>
          {calendar.status === 'ok' ? (
            <AppText muted variant="caption">
              {activityLabel}
            </AppText>
          ) : null}
        </View>
      </View>

      {calendar.status === 'unavailable' ? (
        <InlineUnavailable
          actionLabel="Reintentar"
          message="No pudimos cargar el calendario de este mes."
          onAction={onRefresh}
        />
      ) : (
        <View>
          <View style={styles.weekRow}>
            {WEEKDAYS.map((weekday) => (
              <View key={weekday} style={styles.calendarCell}>
                <AppText muted style={styles.weekday} variant="caption">
                  {weekday}
                </AppText>
              </View>
            ))}
          </View>
          {weeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={styles.weekRow}>
              {week.map((cell, weekdayIndex) => {
                if (!cell) {
                  return (
                    <View
                      accessibilityElementsHidden
                      key={`empty-${weekIndex}-${weekdayIndex}`}
                      style={styles.calendarCell}
                    />
                  );
                }
                const day = daysByDate.get(cell.date);
                const isToday = cell.date === today;
                return (
                  <View
                    accessibilityLabel={calendarDayLabel(
                      day,
                      cell.date,
                      weekdayIndex,
                      today,
                    )}
                    accessible
                    key={cell.date}
                    style={styles.calendarCell}
                    testID={isToday ? 'training-calendar-today' : undefined}
                  >
                    <View
                      style={[
                        styles.dayNumber,
                        isToday && {
                          backgroundColor: colors.brandSubtle,
                          borderColor: colors.primary,
                        },
                      ]}
                    >
                      <AppText
                        style={isToday ? { color: colors.primary } : undefined}
                        variant="caption"
                      >
                        {cell.day}
                      </AppText>
                    </View>
                    <View accessibilityElementsHidden style={styles.indicatorRow}>
                      {day?.colors.map((color) => (
                        <View
                          key={color}
                          style={[
                            styles.indicator,
                            {
                              backgroundColor: trainingRoutineColor(color, isDark),
                              borderColor: colors.surface,
                            },
                          ]}
                          testID={`training-color-${cell.date}-${color}`}
                        />
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </Surface>
  );
}

function HubCard({
  action,
  description,
  icon,
  onAction,
  title,
}: {
  action: TrainingDeferredAction;
  description: string;
  icon: 'activity' | 'dumbbell' | 'routines';
  onAction: (action: TrainingDeferredAction) => void;
  title: string;
}) {
  const { colors } = useOwnlevelTheme();
  return (
    <PressableSurface
      accessibilityHint="Muestra cuándo estará disponible esta sección"
      accessibilityLabel={`Abrir ${title}`}
      onPress={() => onAction(action)}
      style={styles.hubCard}
    >
      <IconCircle icon={icon} />
      <View style={styles.flex}>
        <AppText variant="label">{title}</AppText>
        <AppText muted style={styles.hubSubtitle} variant="caption">
          {description}
        </AppText>
      </View>
      <AppIcon color={colors.textMuted} name="chevronRight" size={16} />
    </PressableSurface>
  );
}

function SectionIntro({ description, title }: { description: string; title: string }) {
  return (
    <View style={styles.sectionIntro}>
      <AppText variant="overline">{title}</AppText>
      <AppText muted>{description}</AppText>
    </View>
  );
}

export function TrainingDashboard({
  data,
  isStale,
  notice,
  onDeferredAction,
  onRefresh,
  requestedMonth,
  today,
}: TrainingDashboardProps) {
  const { colors } = useOwnlevelTheme();
  return (
    <View style={styles.dashboard} testID="training-dashboard">
      <TrainingHeader />
      {isStale ? (
        <Surface style={styles.noticeSurface} testID="training-stale">
          <InlineUnavailable
            actionLabel="Reintentar"
            message="No se pudo actualizar. Mostramos la última lectura confirmada."
            onAction={onRefresh}
          />
        </Surface>
      ) : null}
      <SessionSection
        activeSession={data.activeSession}
        onAction={onDeferredAction}
        onRefresh={onRefresh}
      />
      {notice ? (
        <Surface accessibilityRole="alert" style={styles.noticeSurface} testID="training-notice">
          <View style={styles.noticeRow}>
            <AppIcon color={colors.primary} name="clock" size={18} />
            <AppText style={styles.flex} variant="caption">
              {notice}
            </AppText>
          </View>
        </Surface>
      ) : null}
      <CalendarCard
        calendar={data.calendar}
        onRefresh={onRefresh}
        requestedMonth={requestedMonth}
        today={today}
      />

      <View style={[styles.section, styles.sectionSpaced]}>
        <SectionIntro description="Prepará tu entrenamiento." title="PLANIFICAR" />
        <HubCard
          action="routines"
          description="Organizá ejercicios, series y objetivos."
          icon="routines"
          onAction={onDeferredAction}
          title="Rutinas"
        />
        <HubCard
          action="exercises"
          description="Administrá tu biblioteca de ejercicios."
          icon="dumbbell"
          onAction={onDeferredAction}
          title="Ejercicios"
        />
      </View>

      <View style={[styles.section, styles.sectionSpaced]}>
        <SectionIntro description="Consultá lo que ya registraste." title="REVISAR" />
        <HubCard
          action="history"
          description="Revisá tus sesiones anteriores."
          icon="activity"
          onAction={onDeferredAction}
          title="Historial"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  activeSession: {
    gap: spacing.lg,
  },
  activeSessionLead: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  activeSessionName: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: 1,
  },
  calendarCard: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  calendarCell: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    minHeight: 48,
    paddingTop: spacing.xs,
    width: `${100 / 7}%`,
  },
  calendarTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  calendarTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dashboard: {
    gap: spacing.xl,
  },
  dayNumber: {
    alignItems: 'center',
    borderColor: 'transparent',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  header: {
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  hubCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
  },
  hubSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  indicator: {
    borderRadius: radius.pill,
    borderWidth: 0.5,
    height: 6,
    width: 6,
  },
  indicatorRow: {
    alignContent: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    justifyContent: 'center',
    minHeight: 8,
    width: 30,
  },
  noticeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: sizes.touchTarget,
  },
  noticeSurface: {
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  sectionSpaced: {
    marginTop: spacing.sm,
  },
  sectionIntro: {
    gap: spacing.xs,
  },
  weekday: {
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    width: '100%',
  },
});
