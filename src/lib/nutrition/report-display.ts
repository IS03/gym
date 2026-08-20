import type { NutritionReportDay } from "./reports-core";

function formatRangeDate(date: string, includeYear: boolean) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    ...(includeYear ? { year: "numeric" as const } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

export function formatNutritionReportRange(start: string, end: string) {
  const includeYear = start.slice(0, 4) !== end.slice(0, 4);
  const formattedStart = formatRangeDate(start, includeYear);
  const formattedEnd = formatRangeDate(end, includeYear);
  return start === end ? formattedStart : `${formattedStart} — ${formattedEnd}`;
}

export function getVisibleNutritionReportDays<T extends Pick<NutritionReportDay, "date">>(
  days: readonly T[],
  expanded: boolean,
  limit = 7,
) {
  const newestFirst = [...days].sort((a, b) => b.date.localeCompare(a.date));
  const hasMore = newestFirst.length > limit;
  return {
    days: expanded || !hasMore ? newestFirst : newestFirst.slice(0, limit),
    hasMore,
    total: newestFirst.length,
  };
}
