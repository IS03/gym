import { isCalendarMonth, type CalendarMonth } from "../calendar/month";

export type DailyHistoryOrigin =
  | { source: "history" }
  | { source: "calendar"; month: CalendarMonth };

type HistorySearchParams = Record<string, string | string[] | undefined>;

export function isHistoryDate(value: string | null | undefined): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function adjacentHistoryDate(date: string, amount: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

/**
 * History accepts a closed origin vocabulary instead of an arbitrary return URL.
 * That keeps Back predictable and makes open redirects impossible.
 */
export function parseDailyHistoryOrigin(params: HistorySearchParams): DailyHistoryOrigin | null {
  const source = typeof params.from === "string" ? params.from : null;
  if (source === "history") return { source: "history" };
  const month = typeof params.month === "string" ? params.month : null;
  if (source === "calendar" && isCalendarMonth(month)) return { source: "calendar", month };
  return null;
}

export function dailyHistoryDetailHref(date: string, origin: DailyHistoryOrigin | null = null) {
  const params = new URLSearchParams({ date });
  if (origin?.source === "history") params.set("from", "history");
  if (origin?.source === "calendar") {
    params.set("from", "calendar");
    params.set("month", origin.month);
  }
  return `/history?${params.toString()}`;
}

export function dailyHistoryReturnTarget(origin: DailyHistoryOrigin | null) {
  if (origin?.source === "calendar") {
    return { href: `/calendar?month=${origin.month}`, label: "Calendario" };
  }
  return { href: "/history", label: "Historial" };
}
