import "server-only";

import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import { buildMonthGrid, type CalendarMonth } from "./month";
import {
  buildGlobalCalendarDays,
  type GlobalCalendarDayLogFact,
  type GlobalCalendarMealFact,
  type GlobalCalendarWorkoutFact,
} from "./global-calendar-core";

export async function getGlobalCalendar(input: {
  month: CalendarMonth;
  today: string;
  context: AuthenticatedRequestContext;
}) {
  const grid = buildMonthGrid(input.month, { full: true });
  const start = grid[0]?.date;
  const gridEnd = grid.at(-1)?.date;
  if (!start || !gridEnd) return [];
  const end = gridEnd > input.today ? input.today : gridEnd;
  if (end < start) return buildGlobalCalendarDays({ grid, dayLogs: [], meals: [], workouts: [], bodyMeasurementDates: [] });

  const { supabase, userId } = input.context;
  const { data: rawDayLogs, error: dayLogsError } = await supabase
    .from("day_logs")
    .select("id,log_date,steps,water_l,mate_l,weight_kg")
    .eq("user_id", userId)
    .gte("log_date", start)
    .lte("log_date", end);
  if (dayLogsError) throw new Error(`Leer días del calendario: ${dayLogsError.message}`);

  const dayLogs = (rawDayLogs ?? []) as GlobalCalendarDayLogFact[];
  const ids = dayLogs.map((day) => day.id);
  const [mealsResult, workoutsResult, bodyResult] = await Promise.all([
    ids.length
      ? supabase.from("meal_entries").select("day_log_id,entry_kind,deleted_at").eq("user_id", userId).in("day_log_id", ids).in("entry_kind", ["meal", "legacy_daily_summary"]).is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    ids.length
      ? supabase.from("workout_sessions").select("day_log_id,status").eq("user_id", userId).in("day_log_id", ids).eq("status", "completed")
      : Promise.resolve({ data: [], error: null }),
    supabase.from("body_measurements").select("measured_on").eq("user_id", userId).gte("measured_on", start).lte("measured_on", end),
  ]);
  if (mealsResult.error) throw new Error(`Leer nutrición del calendario: ${mealsResult.error.message}`);
  if (workoutsResult.error) throw new Error(`Leer entrenamientos del calendario: ${workoutsResult.error.message}`);
  if (bodyResult.error) throw new Error(`Leer medidas del calendario: ${bodyResult.error.message}`);

  return buildGlobalCalendarDays({
    grid,
    dayLogs,
    meals: (mealsResult.data ?? []) as GlobalCalendarMealFact[],
    workouts: (workoutsResult.data ?? []) as GlobalCalendarWorkoutFact[],
    bodyMeasurementDates: (bodyResult.data ?? []).map((row) => row.measured_on),
  });
}
