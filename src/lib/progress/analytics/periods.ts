import type {
  ProgressBucketGranularity,
  ProgressPeriodRange,
  ProgressResolvedPeriod,
} from "./types";

export const PROGRESS_PERIOD_PRESETS = [
  { value: "1w", label: "1 semana", kind: "days", amount: 7 },
  { value: "2w", label: "2 semanas", kind: "days", amount: 14 },
  { value: "3w", label: "3 semanas", kind: "days", amount: 21 },
  { value: "4w", label: "4 semanas", kind: "days", amount: 28 },
  { value: "30d", label: "30 días", kind: "days", amount: 30 },
  { value: "8w", label: "8 semanas", kind: "days", amount: 56 },
  { value: "3m", label: "3 meses", kind: "months", amount: 3 },
  { value: "6m", label: "6 meses", kind: "months", amount: 6 },
  { value: "1y", label: "1 año", kind: "months", amount: 12 },
] as const;

export type ProgressPeriodPreset = (typeof PROGRESS_PERIOD_PRESETS)[number]["value"] | "custom";

export const PROGRESS_CUSTOM_RANGE_MAX_DAYS = 366;

export function isValidProgressIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function addProgressIsoDays(value: string, days: number): string {
  if (!isValidProgressIsoDate(value)) throw new Error("Fecha ISO inválida.");
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function subtractProgressCalendarMonths(value: string, months: number): string {
  if (!isValidProgressIsoDate(value) || !Number.isInteger(months) || months < 0) {
    throw new Error("Meses de calendario inválidos.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const targetIndex = year * 12 + month - 1 - months;
  const targetYear = Math.floor(targetIndex / 12);
  const targetMonth = ((targetIndex % 12) + 12) % 12 + 1;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate();
  return `${targetYear.toString().padStart(4, "0")}-${targetMonth.toString().padStart(2, "0")}-${Math.min(day, lastDay).toString().padStart(2, "0")}`;
}

export function progressRangeDays(range: ProgressPeriodRange): number {
  if (!isValidProgressIsoDate(range.start) || !isValidProgressIsoDate(range.end) || range.start > range.end) {
    throw new Error("Rango de Progreso inválido.");
  }
  return Math.floor(
    (new Date(`${range.end}T00:00:00Z`).getTime() - new Date(`${range.start}T00:00:00Z`).getTime()) / 86_400_000,
  ) + 1;
}

export function getPreviousProgressPeriod(range: ProgressPeriodRange): ProgressPeriodRange {
  const durationDays = progressRangeDays(range);
  const end = addProgressIsoDays(range.start, -1);
  return { start: addProgressIsoDays(end, 1 - durationDays), end };
}

export function progressBucketForDays(durationDays: number): ProgressBucketGranularity {
  if (durationDays <= 21) return "day";
  if (durationDays <= 183) return "week";
  return "month";
}

function fallback(today: string, error: string | null): ProgressResolvedPeriod {
  const current = { start: addProgressIsoDays(today, -6), end: today };
  return {
    preset: "1w",
    label: "1 semana",
    current,
    previous: getPreviousProgressPeriod(current),
    durationDays: 7,
    bucket: "day",
    includesInProgressDay: true,
    error,
  };
}

export function resolveProgressPeriod(
  input: { preset?: string; from?: string; to?: string },
  today: string,
): ProgressResolvedPeriod {
  if (!isValidProgressIsoDate(today)) throw new Error("Fecha lógica inválida.");
  const preset = input.preset ?? "1w";

  if (preset === "custom") {
    if (!isValidProgressIsoDate(input.from) || !isValidProgressIsoDate(input.to)) {
      return fallback(today, "Elegí fechas válidas para el período personalizado.");
    }
    if (input.from > input.to) return fallback(today, "La fecha desde no puede ser posterior a la fecha hasta.");
    if (input.from > today) return fallback(today, "El período todavía no contiene días transcurridos.");
    const current = { start: input.from, end: input.to > today ? today : input.to };
    const durationDays = progressRangeDays(current);
    if (durationDays > PROGRESS_CUSTOM_RANGE_MAX_DAYS) {
      return fallback(today, `El período personalizado admite hasta ${PROGRESS_CUSTOM_RANGE_MAX_DAYS} días.`);
    }
    return {
      preset,
      label: "Personalizado",
      current,
      previous: getPreviousProgressPeriod(current),
      durationDays,
      bucket: progressBucketForDays(durationDays),
      includesInProgressDay: current.end === today,
      error: null,
    };
  }

  const definition = PROGRESS_PERIOD_PRESETS.find((item) => item.value === preset);
  if (!definition) return fallback(today, null);
  const start = definition.kind === "days"
    ? addProgressIsoDays(today, 1 - definition.amount)
    : addProgressIsoDays(subtractProgressCalendarMonths(today, definition.amount), 1);
  const current = { start, end: today };
  const durationDays = progressRangeDays(current);
  return {
    preset,
    label: definition.label,
    current,
    previous: getPreviousProgressPeriod(current),
    durationDays,
    bucket: progressBucketForDays(durationDays),
    includesInProgressDay: true,
    error: null,
  };
}

function endOfMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function firstOfNextMonth(value: string): string {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
}

export function bucketProgressRange(
  range: ProgressPeriodRange,
  granularity: ProgressBucketGranularity,
): ProgressPeriodRange[] {
  progressRangeDays(range);
  const buckets: ProgressPeriodRange[] = [];
  let start = range.start;
  while (start <= range.end) {
    const candidateEnd = granularity === "day"
      ? start
      : granularity === "week"
        ? addProgressIsoDays(start, 6)
        : endOfMonth(start);
    const end = candidateEnd < range.end ? candidateEnd : range.end;
    buckets.push({ start, end });
    start = granularity === "month" ? firstOfNextMonth(start) : addProgressIsoDays(end, 1);
  }
  return buckets;
}
