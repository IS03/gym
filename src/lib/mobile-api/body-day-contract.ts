import { bodyRecord, parseBodyMeasurement, parseBodyWeightEntry, type BodyMeasurement, type BodyWeightEntry } from './body-contract';
import { isNutritionDate, type NutritionReadResult } from './nutrition-day-contract';

export type BodyDay = {
  date: string; today: string;
  weight: NutritionReadResult<BodyWeightEntry | null>;
  measurement: NutritionReadResult<BodyMeasurement | null>;
};
export function parseSection<T>(v: unknown, parse: (v: unknown) => T | undefined): NutritionReadResult<T> | undefined {
  if (!bodyRecord(v)) return;
  if (v.status === 'unavailable') return { status: 'unavailable' };
  if (v.status !== 'ok') return;
  const data = parse(v.data);
  return data === undefined ? undefined : { status: 'ok', data };
}
export function parseBodyDay(v: unknown): BodyDay | undefined {
  if (!bodyRecord(v) || !isNutritionDate(v.date) || !isNutritionDate(v.today) || v.date > v.today) return;
  const weight = parseSection(v.weight, x => x === null ? null : parseBodyWeightEntry(x));
  const measurement = parseSection(v.measurement, x => x === null ? null : parseBodyMeasurement(x));
  if (!weight || !measurement || (weight.status === 'ok' && weight.data && weight.data.date !== v.date)
    || (measurement.status === 'ok' && measurement.data && measurement.data.measuredOn !== v.date)) return;
  return { date: v.date, today: v.today, weight, measurement };
}
