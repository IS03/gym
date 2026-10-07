import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import type { NutritionReport } from '@/api/nutrition-report';
import {
  AppText,
  ExampleFrame,
  InlineUnavailable,
  SectionHeader,
  SkeletonBlock,
  Surface,
  radius,
  spacing,
  useOwnlevelTheme,
} from '@/design-system';

import { formatInteger, formatTrainingMinutes, plural } from './format';
import type { HomeTrainingWeek } from './home-data';
import { WEEKDAY_LETTERS, weekDates } from './home-day';
import type { HomeResource } from './home-resource';

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const BAR_HEIGHT = 34;

function Half({ children, testID }: { children: React.ReactNode; testID?: string }) {
  return <Surface style={styles.half} testID={testID}>{children}</Surface>;
}

function Dots({ dates, filled, today, example = false }: { dates: string[]; filled: Set<string>; today: string; example?: boolean }) {
  const { colors } = useOwnlevelTheme();
  const on = example ? colors.textMuted : colors.primary;
  return (
    <View style={styles.dots}>
      {dates.map(date => filled.has(date)
        ? <View key={date} style={[styles.dot, { backgroundColor: on }]} />
        : date === today
          ? <View key={date} style={[styles.dotToday, { borderColor: on }]} />
          : <View key={date} style={[styles.dot, { backgroundColor: colors.surfaceRaised }]} />)}
    </View>
  );
}

function TrainingHalf({ dates, today, week }: { dates: string[]; today: string; week: MobileHomeResponse['training']['week'] | undefined }) {
  if (!week) return <Half><SkeletonBlock height={16} width="70%" /><SkeletonBlock height={30} width={40} /><SkeletonBlock height={14} /></Half>;
  if (week.status === 'unavailable') {
    return <Half testID="home-week-training"><AppText muted variant="footnote">Entrenamientos</AppText><InlineUnavailable message="No pudimos cargar la semana." /></Half>;
  }
  const s = week.data.summary;
  const detail = `${plural(s.sets, 'serie')} · ${formatTrainingMinutes(s.minutes)}`;
  return (
    <Half testID="home-week-training">
      <AppText muted variant="footnote">Entrenamientos</AppText>
      <AppText accessibilityLabel={`${plural(s.sessions, 'entrenamiento')} esta semana`} numeric style={styles.big}>{formatInteger(s.sessions)}</AppText>
      <AppText muted numeric variant="caption">{detail}</AppText>
      <Dots dates={dates} filled={new Set(s.trainingDays)} today={today} />
    </Half>
  );
}

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

function CaloriesHalf({ calories, dates, today }: { calories: HomeResource<NutritionReport>; dates: string[]; today: string }) {
  const { colors } = useOwnlevelTheme();
  if (!calories.data) {
    if (calories.status === 'loading') return <Half><SkeletonBlock height={16} width="70%" /><SkeletonBlock height={30} width={70} /><SkeletonBlock height={14} /></Half>;
    return <Half testID="home-week-calories"><AppText muted variant="footnote">Calorías por día</AppText><InlineUnavailable message="No pudimos cargar las calorías de la semana." /></Half>;
  }
  // Same average and day count as Nutrition reports (finished days with a known value);
  // the bars also show today's partial value, dimmer.
  const stat = calories.data.summary.metrics.calories;
  const days = weekCalories(calories.data, dates);
  const withData = days.filter(day => day.value !== null);
  const max = Math.max(1, ...withData.map(day => day.value!));
  return (
    <Half testID="home-week-calories">
      <AppText muted variant="footnote">Calorías por día</AppText>
      <AppText numeric style={styles.big}>
        {stat.value === null ? '—' : formatInteger(Math.round(stat.value))}
        {stat.value === null ? null : <AppText muted variant="subheadline"> prom.</AppText>}
      </AppText>
      <AppText muted numeric variant="caption">{stat.denominator} de 7 días con datos</AppText>
      <View accessible accessibilityLabel={days.map((day, index) => `${WEEKDAY_NAMES[index]}: ${day.value === null ? 'sin datos' : `${formatInteger(Math.round(day.value))} kcal`}`).join(', ')}
        style={styles.bars} testID="home-week-calorie-bars">
        {days.map(day => {
          const reference = day.target !== null && day.target > 0 ? day.target : max;
          const height = day.value === null ? 0 : Math.round(Math.min(1, day.value / reference) * BAR_HEIGHT);
          return (
            <View key={day.date} style={[styles.barTrack, { backgroundColor: colors.surfaceRaised }]}>
              {height > 0 ? <View testID={`home-week-bar-${day.date}`}
                style={[styles.barFill, { backgroundColor: colors.primary, height, opacity: day.date === today ? 0.55 : 1 }]} /> : null}
            </View>
          );
        })}
      </View>
    </Half>
  );
}

/** Sets and minutes per trained day (summed when there were several sessions). */
export function weekStrip(week: HomeTrainingWeek, dates: string[]) {
  return dates.map(date => {
    const sessions = week.sessions.filter(session => session.logDate === date);
    const durations = sessions.map(session => session.durationMilliseconds).filter((ms): ms is number => ms !== null);
    return {
      date,
      minutes: durations.length ? Math.round(durations.reduce((sum, ms) => sum + ms, 0) / 60_000) : null,
      sets: sessions.reduce((sum, session) => sum + session.completedSets, 0),
      trained: sessions.length > 0,
    };
  });
}

function Strip({ dates, onOpenDay, today, training }: { dates: string[]; onOpenDay: (date: string) => void; today: string; training: HomeResource<HomeTrainingWeek> }) {
  const { colors } = useOwnlevelTheme();
  if (!training.data) {
    if (training.status === 'loading') return <Surface><SkeletonBlock height={64} /></Surface>;
    return <Surface testID="home-week-strip"><InlineUnavailable message="No pudimos cargar el detalle por día." /></Surface>;
  }
  return (
    <Surface style={styles.strip} testID="home-week-strip">
      <ScrollView contentContainerStyle={styles.stripContent} horizontal showsHorizontalScrollIndicator={false}>
      {weekStrip(training.data, dates).map((day, index) => {
        const isToday = day.date === today;
        const future = day.date > today;
        const label = `${WEEKDAY_NAMES[index]}${isToday ? ', hoy' : ''}: ${future ? 'día futuro' : day.trained ? 'entrenaste' : 'sin entrenamiento'}`;
        const content = (
          <>
            <AppText style={[styles.letter, { color: isToday ? colors.text : colors.textMuted }]}>{WEEKDAY_LETTERS[index]}</AppText>
            <View testID={`home-week-marker-${day.date}`} style={[styles.dayMarker, {
              backgroundColor: day.trained ? colors.primary : colors.surfaceRaised,
              borderColor: isToday ? colors.textMuted : 'transparent',
              borderWidth: isToday ? 1.5 : 0,
            }]} />
            {isToday ? <AppText muted style={styles.cellToday}>Hoy</AppText> : null}
          </>
        );
        const cellStyle = [styles.cell];
        return future
          ? <View accessible accessibilityLabel={label} key={day.date} style={cellStyle}>{content}</View>
          : (
            <Pressable accessibilityHint="Abre este día en el historial" accessibilityLabel={label} accessibilityRole="button" key={day.date}
              onPress={() => onOpenDay(day.date)} style={({ pressed }) => [...cellStyle, pressed && { opacity: 0.6 }]} testID={`home-week-day-${day.date}`}>
              {content}
            </Pressable>
          );
      })}
      </ScrollView>
    </Surface>
  );
}

function ExampleWeek({ dates, today }: { dates: string[]; today: string }) {
  return (
    <ExampleFrame>
      <View style={styles.halves}>
        <Half>
          <AppText muted variant="footnote">Entrenamientos</AppText>
          <AppText muted numeric style={styles.big}>3</AppText>
          <Dots dates={dates} example filled={new Set([dates[0], dates[1], dates[3]])} today={today} />
        </Half>
        <Half>
          <AppText muted variant="footnote">Calorías por día</AppText>
          <AppText muted numeric style={styles.big}>2.400<AppText muted variant="subheadline"> prom.</AppText></AppText>
        </Half>
      </View>
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
      <SectionHeader actionLabel="Ver progreso" onAction={onProgress} title="Tu semana" />
      {firstTime ? (
        <>
          <ExampleWeek dates={dates} today={today} />
          <AppText muted variant="footnote">Con tu primer entrenamiento, esto pasa a ser tuyo.</AppText>
        </>
      ) : (
        <>
          <View style={styles.halves}>
            <TrainingHalf dates={dates} today={today} week={week} />
            <CaloriesHalf calories={calories} dates={dates} today={today} />
          </View>
          <Strip dates={dates} onOpenDay={onOpenDay} today={today} training={training} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  barFill: { borderRadius: radius.full, width: '100%' },
  barTrack: { borderRadius: radius.full, height: BAR_HEIGHT, justifyContent: 'flex-end', overflow: 'hidden', width: 8 },
  bars: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  big: { fontSize: 26, fontWeight: '700', letterSpacing: -0.3, lineHeight: 32 },
  cell: { alignItems: 'center', borderRadius: radius.inner, flex: 1, gap: spacing.xs, minHeight: 64, minWidth: 44, paddingVertical: spacing.sm },
  cellToday: { fontSize: 12, fontWeight: '600' },
  dayMarker: { borderRadius: radius.full, height: 16, width: 16 },
  dot: { borderRadius: radius.full, height: 14, width: 14 },
  dotToday: { borderRadius: radius.full, borderWidth: 1.5, height: 12, width: 12 },
  dots: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  half: { flex: 1, gap: 6, minWidth: 150, padding: 14 },
  halves: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  letter: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  section: { gap: spacing.md },
  strip: { padding: spacing.sm },
  stripContent: { flexGrow: 1 },
});
