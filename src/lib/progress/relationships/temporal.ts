import {
  addProgressIsoDays,
  bucketProgressRange,
  progressRangeDays,
  type ProgressMetricSample,
  type ProgressPeriodRange,
} from "../analytics";
import type {
  RelationshipSample,
  RelationshipSampleSet,
  RelationshipTemporalProfile,
} from "./types";
import { RELATIONSHIP_THRESHOLDS } from "./thresholds";

function known(samples: readonly ProgressMetricSample[], period: ProgressPeriodRange, inProgressDate?: string | null) {
  return samples
    .filter((sample): sample is ProgressMetricSample & { value: number } => (
      sample.value !== null && Number.isFinite(sample.value) &&
      sample.date >= period.start && sample.date <= period.end &&
      sample.date !== inProgressDate
    ))
    .sort((left, right) => left.date.localeCompare(right.date) || String(left.entityId ?? "").localeCompare(String(right.entityId ?? "")));
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle]! : (ordered[middle - 1]! + ordered[middle]!) / 2;
}

function average(values: readonly number[]): number | null {
  return values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
}

function aggregate(values: readonly number[], mode: "average" | "sum" | "median"): number | null {
  if (!values.length) return null;
  if (mode === "sum") return values.reduce((total, value) => total + value, 0);
  return mode === "median" ? median(values) : average(values);
}

function valuesByDate(samples: readonly (ProgressMetricSample & { value: number })[]) {
  const result = new Map<string, number[]>();
  for (const sample of samples) {
    const values = result.get(sample.date) ?? [];
    values.push(sample.value);
    result.set(sample.date, values);
  }
  return result;
}

function sameDaySamples(input: AlignmentInput, lagDays = 0): RelationshipSampleSet {
  const a = valuesByDate(known(input.a, input.period, input.inProgressDate));
  const b = valuesByDate(known(input.b, input.period, input.inProgressDate));
  const samples: RelationshipSample[] = [];
  for (const [bDate, bValues] of b) {
    const aDate = addProgressIsoDays(bDate, -lagDays);
    if (aDate < input.period.start) continue;
    const aValue = median(a.get(aDate) ?? []);
    const bValue = median(bValues);
    if (aValue === null || bValue === null) continue;
    samples.push({ id: `${aDate}:${bDate}`, date: bDate, a: aValue, b: bValue });
  }
  const eligibleCount = Math.max(0, progressRangeDays(input.period) - (input.inProgressDate ? 1 : 0) - lagDays);
  return { samples, eligibleCount, observationUnit: "días", omittedMissing: Math.max(0, eligibleCount - samples.length) };
}

function nextSessionSamples(input: AlignmentInput, maximumLagDays: number): RelationshipSampleSet {
  const a = known(input.a, input.period, input.inProgressDate);
  const b = known(input.b, input.period, input.inProgressDate);
  const byDate = valuesByDate(a);
  const usedDates = new Set<string>();
  const samples: RelationshipSample[] = [];

  for (const outcome of b) {
    const candidates = Array.from({ length: maximumLagDays + 1 }, (_, offset) => addProgressIsoDays(outcome.date, -offset));
    const exposureDate = candidates.find((date) => date >= input.period.start && !usedDates.has(date) && (byDate.get(date)?.length ?? 0) > 0);
    if (!exposureDate) continue;
    const aValue = median(byDate.get(exposureDate) ?? []);
    if (aValue === null) continue;
    usedDates.add(exposureDate);
    samples.push({
      id: `${exposureDate}:${outcome.entityId ?? outcome.date}`,
      date: outcome.date,
      a: aValue,
      b: outcome.value,
      context: { exposureDate, outcomeId: outcome.entityId ?? null, ...(outcome.context ?? {}) },
    });
  }
  return { samples, eligibleCount: b.length, observationUnit: "sesiones", omittedMissing: Math.max(0, b.length - samples.length) };
}

function trailingMeasurementSamples(input: AlignmentInput, profile: Extract<RelationshipTemporalProfile, { kind: "trailing_window" }>): RelationshipSampleSet {
  const a = known(input.a, input.period, input.inProgressDate);
  const b = known(input.b, input.period, input.inProgressDate);
  const samples: RelationshipSample[] = [];
  for (let index = 1; index < b.length; index += 1) {
    const previous = b[index - 1]!;
    const current = b[index]!;
    const start = addProgressIsoDays(current.date, 1 - profile.windowDays);
    if (start < input.period.start || previous.date < input.period.start) continue;
    const exposureValues = a.filter((sample) => sample.date >= start && sample.date < current.date).map((sample) => sample.value);
    if (new Set(a.filter((sample) => sample.date >= start && sample.date < current.date).map((sample) => sample.date)).size < Math.ceil(profile.windowDays * RELATIONSHIP_THRESHOLDS.minimumCoverage)) continue;
    const exposure = aggregate(exposureValues, profile.exposureAggregation);
    if (exposure === null) continue;
    samples.push({
      id: `${previous.entityId ?? previous.date}:${current.entityId ?? current.date}`,
      date: current.date,
      a: exposure,
      b: current.value - previous.value,
      context: { exposureStart: start, exposureEnd: addProgressIsoDays(current.date, -1), previousMeasurementDate: previous.date },
    });
  }
  const eligibleCount = Math.max(0, b.length - 1);
  return { samples, eligibleCount, observationUnit: "mediciones", omittedMissing: Math.max(0, eligibleCount - samples.length) };
}

function trailingWeekSamples(input: AlignmentInput, profile: Extract<RelationshipTemporalProfile, { kind: "trailing_window" }>): RelationshipSampleSet {
  const a = known(input.a, input.period, input.inProgressDate);
  const b = known(input.b, input.period, input.inProgressDate);
  const buckets = bucketProgressRange(input.period, "week");
  const samples: RelationshipSample[] = [];
  let eligibleCount = 0;
  for (const bucket of buckets) {
    const outcomes = b.filter((sample) => sample.date >= bucket.start && sample.date <= bucket.end).map((sample) => sample.value);
    const outcome = aggregate(outcomes, profile.outcomeAggregation);
    if (outcome === null) continue;
    eligibleCount += 1;
    const exposureStart = addProgressIsoDays(bucket.start, -profile.windowDays);
    const exposureEnd = addProgressIsoDays(bucket.start, -1);
    // The selected period is the full analytic boundary. We never pull an
    // invisible pre-period window just to manufacture an early observation.
    if (exposureStart < input.period.start) continue;
    const exposureSamples = a.filter((sample) => sample.date >= exposureStart && sample.date <= exposureEnd);
    if (new Set(exposureSamples.map((sample) => sample.date)).size < Math.ceil(profile.windowDays * RELATIONSHIP_THRESHOLDS.minimumCoverage)) continue;
    const exposure = aggregate(exposureSamples.map((sample) => sample.value), profile.exposureAggregation);
    if (exposure === null) continue;
    samples.push({
      id: bucket.start,
      date: bucket.end,
      a: exposure,
      b: outcome,
      context: { exposureStart, exposureEnd, outcomeStart: bucket.start, outcomeEnd: bucket.end, outcomeCount: outcomes.length },
    });
  }
  return { samples, eligibleCount, observationUnit: "semanas", omittedMissing: Math.max(0, eligibleCount - samples.length) };
}

type AlignmentInput = {
  a: readonly ProgressMetricSample[];
  b: readonly ProgressMetricSample[];
  period: ProgressPeriodRange;
  profile: RelationshipTemporalProfile;
  inProgressDate?: string | null;
};

export function alignRelationshipSamples(input: AlignmentInput): RelationshipSampleSet {
  if (input.profile.kind === "same_day") return sameDaySamples(input);
  if (input.profile.kind === "previous_day") return sameDaySamples(input, input.profile.lagDays);
  if (input.profile.kind === "same_day_or_next_session") return nextSessionSamples(input, input.profile.maximumLagDays);
  return input.profile.unit === "measurement"
    ? trailingMeasurementSamples(input, input.profile)
    : trailingWeekSamples(input, input.profile);
}
