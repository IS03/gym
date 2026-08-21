import type { CalendarMonthDay } from "./month";

export type GlobalCalendarDay = CalendarMonthDay & {
  hasNutrition: boolean;
  hasTraining: boolean;
  hasActivity: boolean;
  hasBody: boolean;
};

export type GlobalCalendarDayLogFact = {
  id: string;
  log_date: string;
  steps: number | null;
  water_l: number | null;
  mate_l: number | null;
  weight_kg: number | null;
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
  const bodyDates = new Set(input.bodyMeasurementDates);

  return input.grid.map((day) => {
    const dayLog = dayLogsByDate.get(day.date);
    return {
      ...day,
      hasNutrition: nutritionDates.has(day.date),
      hasTraining: trainingDates.has(day.date),
      hasActivity: Boolean(dayLog && (dayLog.steps !== null || dayLog.water_l !== null || dayLog.mate_l !== null)),
      hasBody: Boolean(dayLog?.weight_kg !== null && dayLog?.weight_kg !== undefined) || bodyDates.has(day.date),
    };
  });
}
