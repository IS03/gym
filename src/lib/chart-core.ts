export type ChartDomain = { min: number; max: number };
export type ChartCoordinate = { index: number; x: number; y: number };
export type ChartUnit = "kcal" | "g" | "L" | "pasos" | "kg" | "series" | "sesiones" | "min" | "cm" | "reps";

export function chartDomain(values: Array<number | null | undefined>, includeZero = false): ChartDomain {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (includeZero) { min = Math.min(min, 0); max = Math.max(max, 0); }
  if (min === max) { const pad = Math.max(Math.abs(min) * 0.1, 1); return { min: min - pad, max: max + pad }; }
  const pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

export function chartX(index: number, count: number, width: number, left = 18, right = left): number {
  const usable = width - left - right;
  return left + (count <= 1 ? usable / 2 : (index / (count - 1)) * usable);
}

export function chartY(value: number, domain: ChartDomain, height: number, top = 16, bottom = top): number {
  const usable = height - top - bottom;
  return top + ((domain.max - value) / (domain.max - domain.min)) * usable;
}

export function lineSegments(values: Array<number | null | undefined>, domain: ChartDomain, width: number, height: number, left = 18, right = left, top = 16, bottom = top): ChartCoordinate[][] {
  const segments: ChartCoordinate[][] = []; let current: ChartCoordinate[] = [];
  values.forEach((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) { if (current.length) segments.push(current); current = []; return; }
    current.push({ index, x: chartX(index, values.length, width, left, right), y: chartY(value, domain, height, top, bottom) });
  });
  if (current.length) segments.push(current);
  return segments;
}

export function chartTickIndexes(count: number, maxLabels = 5): number[] {
  if (count <= 0) return [];
  if (count <= maxLabels) return Array.from({ length: count }, (_, index) => index);
  const indexes = new Set<number>();
  for (let step = 0; step < maxLabels; step += 1) indexes.add(Math.round((step * (count - 1)) / (maxLabels - 1)));
  return [...indexes];
}

export function chartYAxisTicks(domain: ChartDomain, count = 4): number[] {
  if (count <= 1) return [domain.max];
  return Array.from({ length: count }, (_, index) => domain.max - ((domain.max - domain.min) * index) / (count - 1));
}

export function formatChartValue(value: number, unit: ChartUnit): string {
  const decimals = unit === "L" || unit === "kg" || unit === "cm" ? 2 : 0;
  const normalized = Object.is(value, -0) || Math.abs(value) < 1e-9 ? 0 : value;
  const formatted = new Intl.NumberFormat("es-AR", { maximumFractionDigits: decimals }).format(normalized);
  if (unit === "pasos" || unit === "reps") return `${formatted} ${unit === "reps" ? "reps" : "pasos"}`;
  if (unit === "sesiones") return `${formatted} sesiones`;
  if (unit === "min") return `${formatted} min`;
  return `${formatted} ${unit}`;
}
