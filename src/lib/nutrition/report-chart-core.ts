export type ChartDomain = { min: number; max: number };

export type ChartCoordinate = { index: number; x: number; y: number };

export function chartDomain(values: Array<number | null | undefined>, includeZero = false): ChartDomain {
  const finite = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finite.length === 0) return { min: 0, max: 1 };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (includeZero) {
    min = Math.min(min, 0);
    max = Math.max(max, 0);
  }
  if (min === max) {
    const padding = Math.max(Math.abs(min) * 0.1, 1);
    return { min: min - padding, max: max + padding };
  }
  const padding = (max - min) * 0.08;
  return { min: min - padding, max: max + padding };
}

export function chartX(index: number, count: number, width: number, padding = 18) {
  if (count <= 1) return width / 2;
  return padding + (index / (count - 1)) * (width - padding * 2);
}

export function chartY(value: number, domain: ChartDomain, height: number, padding = 16) {
  const ratio = (value - domain.min) / (domain.max - domain.min);
  return height - padding - ratio * (height - padding * 2);
}

export function lineSegments(values: Array<number | null | undefined>, domain: ChartDomain, width: number, height: number) {
  const segments: ChartCoordinate[][] = [];
  let active: ChartCoordinate[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      if (active.length > 0) segments.push(active);
      active = [];
      continue;
    }
    active.push({ index, x: chartX(index, values.length, width), y: chartY(value, domain, height) });
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
