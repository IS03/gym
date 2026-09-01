export type ChartDomain = { min: number; max: number };

export type ChartCoordinate = { index: number; x: number; y: number };

export type NutritionChartBucket<T> = {
  start: string;
  end: string;
  values: readonly T[];
  includesToday: boolean;
};

type ChartDomainOptions = {
  includeZero?: boolean;
  nonNegative?: boolean;
};

function average(values: Array<number | null | undefined>) {
  const known = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (known.length === 0) return null;
  return known.reduce((sum, value) => sum + value, 0) / known.length;
}

export function chartDomain(
  values: Array<number | null | undefined>,
  options: boolean | ChartDomainOptions = false,
): ChartDomain {
  const { includeZero = false, nonNegative = false } = typeof options === "boolean"
    ? { includeZero: options, nonNegative: false }
    : options;
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (includeZero || nonNegative) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 1);
    return nonNegative
      ? { min: 0, max: Math.max(max + padding, 1) }
      : { min: min - padding, max: max + padding };
  }
  const padding = (max - min) * 0.08;
  return {
    min: nonNegative ? 0 : min - padding,
    max: max + padding,
  };
}

export function chartX(index: number, count: number, width: number, padding = 18, right = padding) {
  const usable = width - padding - right;
  if (count <= 1) return padding + usable / 2;
  return padding + (index / (count - 1)) * usable;
}

export function chartY(value: number, domain: ChartDomain, height: number, padding = 16, bottom = padding) {
  const ratio = (value - domain.min) / (domain.max - domain.min);
  return height - bottom - ratio * (height - padding - bottom);
}

export function lineSegments(values: Array<number | null | undefined>, domain: ChartDomain, width: number, height: number, left = 18, right = left, top = 16, bottom = top) {
  const segments: ChartCoordinate[][] = [];
  let active: ChartCoordinate[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      if (active.length > 0) segments.push(active);
      active = [];
      continue;
    }
    active.push({ index, x: chartX(index, values.length, width, left, right), y: chartY(value, domain, height, top, bottom) });
  }
  if (active.length > 0) segments.push(active);
  return segments;
}

export function chartTickIndexes(count: number, maxLabels = 5) {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, index) => index);
  const last = count - 1;
  const indexes = new Set<number>();
  for (let point = 0; point < maxLabels; point += 1) {
    indexes.add(Math.round((point / (maxLabels - 1)) * last));
  }
  return [...indexes].sort((left, right) => left - right);
}

/**
 * Keeps short report ranges daily, then reduces only the chart read model.
 * The daily report data remains untouched for the breakdown below the chart.
 */
export function bucketNutritionChartDays<T extends { date: string; isToday: boolean }>(
  days: readonly T[],
): NutritionChartBucket<T>[] {
  const bucketSize = days.length <= 31 ? 1 : days.length <= 100 ? 7 : 31;
  const result: NutritionChartBucket<T>[] = [];

  for (let index = 0; index < days.length; index += bucketSize) {
    const values = days.slice(index, index + bucketSize);
    if (values.length === 0) continue;
    result.push({
      start: values[0]!.date,
      end: values.at(-1)!.date,
      values,
      includesToday: values.some((day) => day.isToday),
    });
  }

  return result;
}

export function averageBucketValue<T>(
  bucket: NutritionChartBucket<T>,
  value: (item: T) => number | null | undefined,
) {
  return average(bucket.values.map(value));
}
