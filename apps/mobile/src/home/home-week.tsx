import { Pressable, StyleSheet, View } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import type { NutritionReport } from '@/api/nutrition-report';
import {
  AppText,
  ExampleFrame,
  InlineUnavailable,
  SkeletonBlock,
  radius,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';

import { formatInteger, formatTrainingMinutes, plural } from './format';
import type { HomeTrainingWeek } from './home-data';
import { WEEKDAY_LETTERS, weekDates } from './home-day';
import type { HomeResource } from './home-resource';
import { HomeCard, HomeRow, HomeRowSeparator, HomeSectionHeader } from './home-ui';

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

type DayCalories = { date: string; value: number | null; target: number | null };

/** Calories per day of the week from the nutrition report; a day without data stays null (never 0). */
export function weekCalories(report: NutritionReport, dates: string[]): DayCalories[] {
  return dates.map(date => {
    const row = report.days.find(day => day.date === date);
    const calories = row?.nutrients.calories;
    const known = !!row && row.hasNutrition && !!calories && calories.value !== null && calories.status !== 'none' && calories.status !== 'unknown';
    return { date, target: row?.targetCalories ?? null, value: known ? calories!.value : null };
  });
}

/** Sessions per day of the week (completed sessions from the training history). */
export function weekStrip(week: HomeTrainingWeek, dates: string[]) {
  return dates.map(date => ({ date, count: week.sessions.filter(session => session.logDate === date).length }));
}

/**
 * The week's days as small dots: filled when trained. Only today is marked differently
 * (its letter in the primary text color). Each past day opens that day in the history.
 */
function Days({ dates, onOpenDay, today, trained }: { dates: string[]; onOpenDay?: (date: string) => void; today: string; trained: Set<string> }) {
  const { colors } = useOwnlevelTheme();
  return (
    <View style={styles.days} testID="home-week-strip">
      {dates.map((date, index) => {
        const isToday = date === today;
        const done = trained.has(date);
        const label = `${WEEKDAY_NAMES[index]}${isToday ? ', hoy' : ''}: ${date > today ? 'día futuro' : done ? 'entrenaste' : 'sin entrenamiento'}`;
        const content = (
          <>
            <View style={[styles.dot, { backgroundColor: done ? colors.primary : colors.surfaceRaised }]} testID={`home-week-marker-${date}`} />
            <AppText style={[styles.letter, { color: isToday ? colors.text : colors.textMuted, fontWeight: isToday ? '700' : '600' }]}
              testID={isToday ? 'home-week-today' : undefined}>
              {WEEKDAY_LETTERS[index]}
            </AppText>
          </>
        );
        return onOpenDay && date <= today ? (
          <Pressable accessibilityHint="Abre este día en el historial" accessibilityLabel={label} accessibilityRole="button" hitSlop={{ bottom: 10, left: 4, right: 4, top: 10 }}
            key={date} onPress={() => onOpenDay(date)} style={({ pressed }) => [styles.day, pressed && { opacity: 0.5 }]} testID={`home-week-day-${date}`}>
            {content}
          </Pressable>
        ) : <View accessible accessibilityLabel={label} key={date} style={styles.day}>{content}</View>;
      })}
    </View>
  );
}

function TrainingRow({ dates, onOpenDay, today, training, week }: {
  dates: string[]; onOpenDay: (date: string) => void; today: string; training: HomeResource<HomeTrainingWeek>;
  week: MobileHomeResponse['training']['week'] | undefined;
}) {
  const { colors } = useOwnlevelTheme();
  const daysFromHistory = training.data ? new Set(weekStrip(training.data, dates).filter(day => day.count > 0).map(day => day.date)) : null;
  if (!week) {
    return <HomeRow icon="dumbbell" title="Entrenamientos" trailing={<SkeletonBlock height={16} width={24} />}><View style={styles.indent}><SkeletonBlock height={24} width={140} /></View></HomeRow>;
  }
  if (week.status === 'unavailable') {
    return <HomeRow icon="dumbbell" testID="home-week-training" title="Entrenamientos"><View style={styles.indent}><InlineUnavailable message="No pudimos cargar la semana." /></View></HomeRow>;
  }
  const s = week.data.summary;
  const trained = daysFromHistory ?? new Set(s.trainingDays);
  return (
    <HomeRow accessibilityLabel={`Entrenamientos: ${plural(s.sessions, 'entrenamiento')} esta semana, ${plural(s.sets, 'serie')}, ${formatTrainingMinutes(s.minutes)}`}
      icon="dumbbell" subtitle={`${plural(s.sets, 'serie')} · ${formatTrainingMinutes(s.minutes)}`} testID="home-week-training" title="Entrenamientos"
      trailing={<AppText numeric style={[styles.value, { color: colors.textMuted }]}>{formatInteger(s.sessions)}</AppText>}>
      <View style={styles.indent}>
        <Days dates={dates} onOpenDay={onOpenDay} today={today} trained={trained} />
        {!training.data && training.status === 'unavailable' ? <AppText muted variant="caption">No pudimos cargar el detalle por día.</AppText> : null}
      </View>
    </HomeRow>
  );
}

function CaloriesRow({ calories }: { calories: HomeResource<NutritionReport> }) {
  const { colors } = useOwnlevelTheme();
  if (!calories.data) {
    return calories.status === 'loading'
      ? <HomeRow icon="flame" title="Calorías por día" trailing={<SkeletonBlock height={16} width={48} />} />
      : <HomeRow icon="flame" testID="home-week-calories" title="Calorías por día"><View style={styles.indent}><InlineUnavailable message="No pudimos cargar las calorías de la semana." /></View></HomeRow>;
  }
  // Same average and day count as Nutrition reports (finished days with a known value).
  const stat = calories.data.summary.metrics.calories;
  const average = stat.value === null ? '—' : formatInteger(Math.round(stat.value));
  return (
    <HomeRow accessibilityLabel={`Calorías por día: ${average === '—' ? 'sin promedio' : `${average} de promedio`}, ${stat.denominator} de 7 días con datos`}
      icon="flame" subtitle={`Promedio · ${stat.denominator} de 7 días con datos`} testID="home-week-calories" title="Calorías por día"
      trailing={<AppText numeric style={[styles.value, { color: colors.textMuted }]}>{average}</AppText>} />
  );
}

function ExampleWeek({ dates, today }: { dates: string[]; today: string }) {
  return (
    <ExampleFrame>
      <HomeCard padded={false}>
        <HomeRow icon="dumbbell" subtitle="48 series · 2 h 30 min" title="Entrenamientos" trailing={<AppText muted style={styles.value}>3</AppText>}>
          <View style={styles.indent}><Days dates={dates} today={today} trained={new Set([dates[0], dates[1], dates[3]])} /></View>
        </HomeRow>
      </HomeCard>
    </ExampleFrame>
  );
}

export function HomeWeek({
  calories, onOpenDay, onProgress, today, training, week, weekStart,
}: {
  calories: HomeResource<NutritionReport>;
  onOpenDay: (date: string) => void;
  onProgress: () => void;
  today: string;
  training: HomeResource<HomeTrainingWeek>;
  week: MobileHomeResponse['training']['week'] | undefined;
  weekStart: string;
}) {
  const dates = weekDates(weekStart);
  const firstTime = training.data !== undefined && !training.data.everTrained;
  return (
    <View style={styles.section} testID="home-week">
      <HomeSectionHeader action="Progreso" onAction={onProgress} title="Esta semana" />
      {firstTime ? (
        <>
          <ExampleWeek dates={dates} today={today} />
          <AppText muted style={styles.note} variant="footnote">Con tu primer entrenamiento, esto pasa a ser tuyo.</AppText>
        </>
      ) : (
        <HomeCard padded={false}>
          <TrainingRow dates={dates} onOpenDay={onOpenDay} today={today} training={training} week={week} />
          <HomeRowSeparator />
          <CaloriesRow calories={calories} />
        </HomeCard>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { alignItems: 'center', gap: 5, minWidth: 18 },
  days: { flexDirection: 'row', gap: 9 },
  dot: { borderRadius: radius.full, height: 10, width: 10 },
  indent: { gap: spacing.xs, paddingLeft: 40, paddingTop: 2 },
  letter: { fontSize: 10, lineHeight: 12 },
  note: { paddingHorizontal: spacing.lg },
  section: { gap: spacing.sm },
  value: { fontSize: 17 },
});
