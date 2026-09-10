import type { CalendarMonthDay } from "./month";

export type GlobalCalendarDay = CalendarMonthDay & {
  hasNutrition: boolean;
  hasTraining: boolean;
  hasMetrics: boolean;
  hasBody: boolean;
};

export type GlobalCalendarDayLogFact = {
  id: string;
  log_date: string;
  weight_kg: number | null;
};

export type GlobalCalendarMetricFact = {
  metric_date: string;
  value: number;
};

export type GlobalCalendarMealFact = {
  day_log_id: string;
  entry_kind: string;
  deleted_at: string | null;
};

export type GlobalCalendarWorkoutFact = {
  day_log_id: string;
  status: string;
};

export function buildGlobalCalendarDays(input: {
  grid: CalendarMonthDay[];
  dayLogs: GlobalCalendarDayLogFact[];
  meals: GlobalCalendarMealFact[];
  workouts: GlobalCalendarWorkoutFact[];
  metrics: GlobalCalendarMetricFact[];
  bodyMeasurementDates: string[];
}): GlobalCalendarDay[] {
  const dayLogsById = new Map(input.dayLogs.map((day) => [day.id, day]));
  const dayLogsByDate = new Map(input.dayLogs.map((day) => [day.log_date, day]));
  const nutritionIds = new Set(
    input.meals
      .filter((meal) => meal.deleted_at === null && (meal.entry_kind === "meal" || meal.entry_kind === "legacy_daily_summary"))
      .map((meal) => meal.day_log_id),
  );
  const trainingIds = new Set(input.workouts.filter((workout) => workout.status === "completed").map((workout) => workout.day_log_id));
  const nutritionDates = new Set([...nutritionIds].flatMap((id) => dayLogsById.get(id)?.log_date ?? []));
  const trainingDates = new Set([...trainingIds].flatMap((id) => dayLogsById.get(id)?.log_date ?? []));
  const metricDates = new Set(input.metrics.map((metric) => metric.metric_date));
  const bodyDates = new Set(input.bodyMeasurementDates);

  return input.grid.map((day) => {
    const dayLog = dayLogsByDate.get(day.date);
    return {
      ...day,
      hasNutrition: nutritionDates.has(day.date),
      hasTraining: trainingDates.has(day.date),
      hasMetrics: metricDates.has(day.date),
      hasBody: Boolean(dayLog?.weight_kg !== null && dayLog?.weight_kg !== undefined) || bodyDates.has(day.date),
    };
  });
}
