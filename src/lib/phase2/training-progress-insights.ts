import { formatTrainingMinutes } from "./training-progress-summary";
import type { WeeklyTrainingSummary } from "./types";

export type WeeklyChartMetric = "volume" | "sets" | "sessions" | "minutes";

export type ProgressEntry = readonly [string, number];

export const WEEKLY_CHART_METRICS: Array<{ value: WeeklyChartMetric; label: string }> = [
  { value: "volume", label: "Volumen" },
  { value: "sets", label: "Series" },
  { value: "sessions", label: "Entrenamientos" },
  { value: "minutes", label: "Duración" },
];

export function weeklyMetricValue(week: WeeklyTrainingSummary, metric: WeeklyChartMetric): number {
  if (metric === "volume") return week.volumeKg;
  if (metric === "sets") return week.sets;
  if (metric === "sessions") return week.sessions;
  return week.minutes;
}

export function weeklyMetricTitle(metric: WeeklyChartMetric): string {
  if (metric === "volume") return "Volumen por semana";
  if (metric === "sets") return "Series por semana";
  if (metric === "sessions") return "Entrenamientos por semana";
  return "Duración por semana";
}

export function formatWeeklyMetric(value: number, metric: WeeklyChartMetric): string {
  if (metric === "minutes") return formatTrainingMinutes(value);
  if (metric === "volume") {
    return `${new Intl.NumberFormat("es-AR", {
      notation: value >= 10_000 ? "compact" : "standard",
      maximumFractionDigits: value >= 1_000 ? 1 : 0,
    }).format(value)} kg`;
  }
  return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value)} ${metric === "sets" ? "series" : "sesiones"}`;
}

export function weeklyBarScale(value: number, maximum: number): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maximum) || maximum <= 0) return 0;
  return Math.min(100, (value / maximum) * 100);
}

/** The last visible week is the current in-progress calendar week. */
export function completedWeeklyAverage(weeks: readonly WeeklyTrainingSummary[], metric: WeeklyChartMetric): { value: number; weeks: number } | null {
  const completed = weeks.slice(0, -1);
  if (completed.length === 0) return null;
  const values = completed.map((week) => weeklyMetricValue(week, metric)).filter(Number.isFinite);
  if (values.length === 0) return null;
  return { value: values.reduce((total, value) => total + value, 0) / values.length, weeks: values.length };
}

export function sortedProgressEntries(values: Record<string, number>): ProgressEntry[] {
  return Object.entries(values).sort(
    ([leftName, leftValue], [rightName, rightValue]) =>
      rightValue - leftValue || leftName.localeCompare(rightName, "es"),
  );
}

export function visibleProgressEntries(entries: readonly ProgressEntry[], expanded: boolean, limit = 4): ProgressEntry[] {
  return expanded ? [...entries] : entries.slice(0, limit);
}
