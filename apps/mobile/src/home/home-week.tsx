import { Pressable, StyleSheet, View } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import type { NutritionReport } from '@/api/nutrition-report';
import { AppText, ExampleFrame, InlineUnavailable, SkeletonBlock, brandTokens, spacing, useOwnlevelTheme } from '@/design-system';

import { formatInteger, formatTrainingMinutes, plural } from './format';
import type { HomeTrainingWeek } from './home-data';
import { WEEKDAY_LETTERS, weekDates } from './home-day';
import type { HomeResource } from './home-resource';
import { homeLayout } from './home-layout';
import { HomeBar, HomeRow, HomeRowSeparator, HomeSection } from './home-ui';

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CAPSULE_HEIGHT = 8;
const LETTER_LINE = 18;
const DAY_GAP = 6;
/** Each day is a 44 pt touch target around capsule + letter: this much is empty below the letter. */
const DAY_SLACK = (brandTokens.layout.minTouch - CAPSULE_HEIGHT - DAY_GAP - LETTER_LINE) / 2;
/** HomeRow's vertical padding above its text. */
const ROW_INSET = spacing.xs;

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

/** Accessible name of one day of the strip ("Lunes, entrenaste" / "Jueves, sin entreno"). */
export function dayLabel(index: number, done: boolean, isToday: boolean): string {
  return `${WEEKDAY_NAMES[index]}${isToday ? ', hoy' : ''}, ${done ? 'entrenaste' : 'sin entreno'}`;
}

/**
 * Linear week calendar: 7 equal capsules (Monday first). A day with at least one session
 * is filled with the accent (several sessions are still one capsule); a day without one,
 * or a future day, keeps the track color. Past days open that day in the history.
 */
function Days({ dates, onOpenDay, today, trained }: { dates: string[]; onOpenDay?: (date: string) => void; today: string; trained: Set<string> }) {
  const { colors } = useOwnlevelTheme();
  return (
    <View style={styles.days} testID="home-week-strip">
      {dates.map((date, index) => {
        const isToday = date === today;
        const done = trained.has(date);
        const content = (
          <>
            <HomeBar color={colors.primary} fraction={done ? 1 : 0} height={CAPSULE_HEIGHT} testID={`home-week-marker-${date}`} />
            <AppText style={[styles.letter, isToday ? { color: colors.text, fontWeight: '600' } : { color: colors.textMuted }]}
              testID={isToday ? 'home-week-today' : undefined}>
              {WEEKDAY_LETTERS[index]}
            </AppText>
          </>
        );
        const label = dayLabel(index, done, isToday);
        return onOpenDay && date <= today ? (
          <Pressable accessibilityHint="Abre este día en el historial" accessibilityLabel={label} accessibilityRole="button" key={date}
            onPress={() => onOpenDay(date)} style={({ pressed }) => [styles.day, pressed && { opacity: 0.55 }]} testID={`home-week-day-${date}`}>
            {content}
          </Pressable>
        ) : <View accessible accessibilityLabel={label} key={date} style={styles.day} testID={`home-week-day-${date}`}>{content}</View>;
      })}
    </View>
  );
}

/** Big number with its unit beside it ("5 entrenos", "1.105 / 2.100 kcal"). */
export function BigNumber({ mutedColor, unit, value }: { mutedColor?: string; unit?: string; value: string }) {
  return (
    <AppText numeric style={styles.bigLine}>
      <AppText numeric variant="largeTitle">{value}</AppText>
      {unit ? <AppText muted numeric style={mutedColor ? { color: mutedColor } : undefined} variant="body">{` ${unit}`}</AppText> : null}
    </AppText>
  );
}

function TrainingSummary({ dates, onOpenDay, today, training, week }: {
  dates: string[]; onOpenDay: (date: string) => void; today: string; training: HomeResource<HomeTrainingWeek>;
  week: MobileHomeResponse['training']['week'] | undefined;
}) {
  if (!week) {
    return <View style={styles.summary}><SkeletonBlock height={41} width={140} /><SkeletonBlock height={18} width={180} /><SkeletonBlock height={CAPSULE_HEIGHT} /></View>;
  }
  if (week.status === 'unavailable') {
    return <View style={styles.summary} testID="home-week-training"><InlineUnavailable message="No pudimos cargar la semana." /></View>;
  }
  const s = week.data.summary;
  const fromHistory = training.data ? new Set(weekStrip(training.data, dates).filter(day => day.count > 0).map(day => day.date)) : null;
  const trained = fromHistory ?? new Set(s.trainingDays);
  const detail = `${plural(s.sets, 'serie')} · ${formatTrainingMinutes(s.minutes)}`;
  return (
    <View style={styles.summary} testID="home-week-training">
      <View accessible accessibilityLabel={`${plural(s.sessions, 'entreno')} esta semana, ${detail}`} testID="home-week-summary">
        <BigNumber unit={s.sessions === 1 ? 'entreno' : 'entrenos'} value={formatInteger(s.sessions)} />
        <AppText muted numeric variant="subheadline">{detail}</AppText>
      </View>
      <Days dates={dates} onOpenDay={onOpenDay} today={today} trained={trained} />
      {!training.data && training.status === 'unavailable' ? <AppText muted variant="footnote">No pudimos cargar el detalle por día.</AppText> : null}
    </View>
  );
}

function CaloriesRow({ calories, onOpen }: { calories: HomeResource<NutritionReport>; onOpen: () => void }) {
  if (!calories.data) {
    return calories.status === 'loading'
      ? <HomeRow title="Calorías por día" trailing={<SkeletonBlock height={34} width={88} />} />
      : <HomeRow testID="home-week-calories" title="Calorías por día"><InlineUnavailable message="No pudimos cargar las calorías de la semana." /></HomeRow>;
  }
  // Same average and day count as Nutrition reports (finished days with a known value).
  const stat = calories.data.summary.metrics.calories;
  const average = stat.value === null ? '—' : formatInteger(Math.round(stat.value));
  return (
    <HomeRow accessibilityHint="Abre el reporte de nutrición de esta semana"
      accessibilityLabel={`Calorías por día: ${average === '—' ? 'sin promedio' : `${average} de promedio`}, ${stat.denominator} de 7 días con datos`}
      chevron onPress={onOpen} subtitle={`Promedio · ${stat.denominator} de 7 días con datos`} testID="home-week-calories" title="Calorías por día"
      trailing={<AppText numeric variant="largeTitle">{average}</AppText>} />
  );
}

function ExampleWeek({ dates, today }: { dates: string[]; today: string }) {
  return (
    <ExampleFrame>
      <View style={styles.summary}>
        <View>
          <BigNumber unit="entrenos" value="3" />
          <AppText muted variant="subheadline">48 series · 2 h 30 min</AppText>
        </View>
        <Days dates={dates} today={today} trained={new Set([dates[0], dates[1], dates[3]])} />
      </View>
    </ExampleFrame>
  );
}

export function HomeWeek({
  calories, onOpenCalories, onOpenDay, onProgress, today, training, week, weekStart,
}: {
  calories: HomeResource<NutritionReport>;
  onOpenCalories: () => void;
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
    <HomeSection accessibilityLabel="Progreso" action="Progreso →" onAction={onProgress} testID="home-week" title="Esta semana">
      {firstTime ? (
        <>
          <ExampleWeek dates={dates} today={today} />
          <AppText muted variant="footnote">Con tu primer entrenamiento, esto pasa a ser tuyo.</AppText>
        </>
      ) : (
        <>
          <TrainingSummary dates={dates} onOpenDay={onOpenDay} today={today} training={training} week={week} />
          <View style={styles.divider}><HomeRowSeparator /></View>
          <CaloriesRow calories={calories} onOpen={onOpenCalories} />
        </>
      )}
    </HomeSection>
  );
}

// Calendar → "Calorías por día": the visible gap is homeLayout.calendarToCalories, split
// around the hairline (minus the day's touch slack above and the row's padding below).
const HALF_GAP = homeLayout.calendarToCalories / 2;

const styles = StyleSheet.create({
  bigLine: { lineHeight: 41 },
  day: { flex: 1, gap: DAY_GAP, justifyContent: 'center', minHeight: brandTokens.layout.minTouch },
  days: { flexDirection: 'row', gap: 6 },
  divider: { marginBottom: HALF_GAP - ROW_INSET, marginTop: HALF_GAP - DAY_SLACK },
  letter: { fontSize: 13, lineHeight: LETTER_LINE, textAlign: 'center' },
  summary: { gap: spacing.md },
});
