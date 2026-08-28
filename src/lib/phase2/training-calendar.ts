import { addMonths, buildMonthGrid, formatMonthLabel, isoMonth, type CalendarMonth, type CalendarMonthDay } from "../calendar/month";

export type TrainingMonthDay = CalendarMonthDay;
export { addMonths, buildMonthGrid, formatMonthLabel, isoMonth };

export function trainingCalendarHref(month: CalendarMonth, routineId?: string | null) {
  const params = new URLSearchParams({ month });
  if (routineId) params.set("routine_id", routineId);
  return `/train/calendar?${params.toString()}`;
}
