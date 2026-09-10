import { addMonths, buildMonthGrid, formatMonthLabel, isoMonth, type CalendarMonth, type CalendarMonthDay } from "../calendar/month";
import { resolveRoutineColor, type RoutineColorKey } from "./routine-colors";

export type TrainingMonthDay = CalendarMonthDay;
export type TrainingDayRecord = { date: string; color: unknown };
export { addMonths, buildMonthGrid, formatMonthLabel, isoMonth };

export function groupTrainingDays(records: TrainingDayRecord[]) {
  const grouped = new Map<string, Set<RoutineColorKey>>();

  for (const record of records) {
    const colors = grouped.get(record.date) ?? new Set<RoutineColorKey>();
    colors.add(resolveRoutineColor(record.color));
    grouped.set(record.date, colors);
  }

  return new Map(
    [...grouped.entries()].map(([date, colors]) => [date, [...colors]]),
  );
}

export function trainingCalendarHref(month: CalendarMonth, routineId?: string | null) {
  const params = new URLSearchParams({ month });
  if (routineId) params.set("routine_id", routineId);
  return `/train/calendar?${params.toString()}`;
}

export function trainingDayHref(
  date: string,
  options?: { routineId?: string | null; source?: "train" },
) {
  const params = new URLSearchParams({ date });
  if (options?.routineId) params.set("routine_id", options.routineId);
  if (options?.source) params.set("from", options.source);
  return `/train/day?${params.toString()}`;
}

export function trainingDayReturnTarget(
  date: string,
  routineId: string | null,
  source?: string,
) {
  if (source === "train") {
    return { href: "/train", label: "Entrenar" } as const;
  }

  return {
    href: trainingCalendarHref(date.slice(0, 7) as CalendarMonth, routineId),
    label: "Calendario",
  } as const;
}
