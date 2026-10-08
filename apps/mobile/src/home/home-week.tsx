import { Pressable, StyleSheet, View } from 'react-native';

import type { MobileHomeResponse } from '@/api/home';
import type { NutritionReport } from '@/api/nutrition-report';
import { AppText, ExampleFrame, InlineUnavailable, SkeletonBlock, brandTokens, spacing, useOwnlevelTheme } from '@/design-system';

import { formatInteger, formatTrainingMinutes, plural } from './format';
import { HomeCarousel } from './home-carousel';
import type { HomeTrainingWeek } from './home-data';
import { WEEKDAY_LETTERS, weekDates } from './home-day';
import type { HomeResource } from './home-resource';
import { HomeBar, HomeRow, HomeRowSeparator, HomeSection } from './home-ui';

const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const CAPSULE_HEIGHT = 8;
const LETTER_LINE = 18;
const DAY_GAP = 6;

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
            <AppText style={[styles.letter, isToday ? { color: colors.primary, fontWeight: '600' } : { color: colors.textMuted }]}
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
  const history = training.data?.weekStart === dates[0] ? training.data : undefined;
  const fromHistory = history ? new Set(weekStrip(history, dates).filter(day => day.count > 0).map(day => day.date)) : null;
  const trained = fromHistory ?? new Set(s.trainingDays);
  const detail = `${plural(s.sets, 'serie')} · ${formatTrainingMinutes(s.minutes)}`;
  return (
    <View style={styles.summary} testID="home-week-training">
      <View accessible accessibilityLabel={`${plural(s.sessions, 'entreno')} esta semana, ${detail}`} testID="home-week-summary">
        <BigNumber unit={s.sessions === 1 ? 'entreno' : 'entrenos'} value={formatInteger(s.sessions)} />
        <AppText muted numeric variant="subheadline">{detail}</AppText>
      </View>
      <Days dates={dates} onOpenDay={onOpenDay} today={today} trained={trained} />
      {!history && training.status === 'unavailable' ? <AppText muted variant="footnote">No pudimos cargar el detalle por día.</AppText> : null}
    </View>
  );
}

function NutritionSummary({ calories, onOpen, today, weekStart }: {
  calories: HomeResource<NutritionReport>; onOpen: () => void; today: string; weekStart: string;
}) {
  const data = calories.data?.range.start === weekStart && calories.data.today === today ? calories.data : undefined;
  if (!data) return calories.status === 'loading'
    ? <View style={styles.summary}><SkeletonBlock height={34} /><SkeletonBlock height={34} /><SkeletonBlock height={34} /></View>
    : <InlineUnavailable message="No pudimos cargar Nutrición de esta semana." />;
  return <View testID="home-week-nutrition">
    <AppText muted variant="footnote">Promedios diarios · Días terminados con datos</AppText>
    {([['calories', 'Calorías', 'kcal'], ['protein', 'Proteína', 'g'], ['carbs', 'Carbohidratos', 'g'], ['fat', 'Grasas', 'g']] as const).map(([key, title, unit], index) => {
      const stat = data.summary.metrics[key];
      const value = stat.value === null ? '—' : formatInteger(Math.round(stat.value));
      const coverage = `Promedio · ${stat.denominator} de 7 días con datos${stat.partialDays > 0 ? ` · ${plural(stat.partialDays, 'día parcial', 'días parciales')}` : ''}`;
      return <View key={key}>
        {index > 0 ? <HomeRowSeparator /> : null}
        <HomeRow accessibilityHint="Abre el reporte de nutrición de esta semana" accessibilityLabel={`${title}: ${value} ${unit}. ${coverage}`}
          chevron onPress={onOpen} subtitle={coverage} testID={`home-week-${key}`} title={title}
          trailing={<View style={styles.nutrientValue}><AppText numeric variant="title2">{value}</AppText><AppText muted variant="caption">{unit}</AppText></View>} />
      </View>;
    })}
    {calories.status === 'unavailable' ? <AppText muted variant="footnote">Sin actualizar · Última lectura disponible</AppText> : null}
  </View>;
}

function TrainingDays({ dates, onOpenDay, today, training, weekStart }: {
  dates: string[]; onOpenDay: (date: string) => void; today: string; training: HomeResource<HomeTrainingWeek>; weekStart: string;
}) {
  const data = training.data?.weekStart === weekStart ? training.data : undefined;
  if (!data) return training.status === 'loading' ? <SkeletonBlock height={160} /> : <InlineUnavailable message="No pudimos cargar el detalle por día." />;
  return <View testID="home-week-training-days">
    {dates.map((date, index) => {
      const sessions = data.sessions.filter(session => session.logDate === date);
      const subtitle = date > today ? 'Por venir' : sessions.length === 0 ? 'Sin entrenamientos registrados'
        : sessions.map(session => `${session.routineName ?? 'Sesión libre'} · ${session.durationMilliseconds === null ? 'Duración no disponible' : formatTrainingMinutes(Math.round(session.durationMilliseconds / 60_000))}`).join(' / ');
      const title = `${WEEKDAY_NAMES[index]} ${Number(date.slice(8))}${date === today ? ' · Hoy' : ''}`;
      return <View key={date}>
        {index > 0 ? <HomeRowSeparator /> : null}
        <HomeRow accessibilityLabel={`${title}. ${subtitle}`} chevron={date <= today} onPress={date <= today ? () => onOpenDay(date) : undefined}
          subtitle={subtitle} testID={`home-week-detail-${date}`} title={title} />
      </View>;
    })}
    {training.status === 'unavailable' ? <AppText muted variant="footnote">Sin actualizar · Última lectura disponible</AppText> : null}
  </View>;
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
      <HomeCarousel pages={[
        { label: 'Entrenos', content: firstTime ? (
          <>
            <ExampleWeek dates={dates} today={today} />
            <AppText muted variant="footnote">Con tu primer entrenamiento, esto pasa a ser tuyo.</AppText>
          </>
        ) : <TrainingSummary dates={dates} onOpenDay={onOpenDay} today={today} training={training} week={week} /> },
        { label: 'Nutrición', content: <NutritionSummary calories={calories} onOpen={onOpenCalories} today={today} weekStart={weekStart} /> },
        { label: 'Por día', content: <TrainingDays dates={dates} onOpenDay={onOpenDay} today={today} training={training} weekStart={weekStart} /> },
      ]} />
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  bigLine: { lineHeight: 41 },
  day: { flex: 1, gap: DAY_GAP, justifyContent: 'center', minHeight: brandTokens.layout.minTouch },
  days: { flexDirection: 'row', gap: 6 },
  nutrientValue: { alignItems: 'flex-end' },
  letter: { fontSize: 13, lineHeight: LETTER_LINE, textAlign: 'center' },
  summary: { gap: spacing.md },
});
