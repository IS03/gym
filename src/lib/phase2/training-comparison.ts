import {
  trainingAnalysisMetricValue,
  type TrainingAnalysis,
  type TrainingAnalysisExercise,
  type TrainingAnalysisExerciseTimelinePoint,
  type TrainingAnalysisMetric,
  type TrainingAnalysisSummary,
  type TrainingAnalysisTimelinePoint,
} from "./training-analysis";

export const TRAINING_COMPARISON_KINDS = ["periods", "routines", "muscles", "exercises"] as const;
export type TrainingComparisonKind = (typeof TRAINING_COMPARISON_KINDS)[number];
export type TrainingComparisonMetric = TrainingAnalysisMetric | "averageSets" | "exerciseCount" | "bestWeight" | "bestReps";

export type TrainingComparisonDelta = {
  absolute: number | null;
  percentage: number | null;
  hasComparableBaseline: boolean;
};

export type TrainingComparisonSubject = {
  id: string;
  label: string;
  summary: TrainingAnalysisSummary;
  timeline: Array<TrainingAnalysisTimelinePoint | TrainingAnalysisExerciseTimelinePoint>;
  bestWeightKg?: number | null;
  bestReps?: number | null;
};

export type TrainingComparisonTimelinePoint = {
  id: string;
  label: string;
  rangeA: { start: string; end: string };
  rangeB: { start: string; end: string };
  a: Record<TrainingComparisonMetric, number | null>;
  b: Record<TrainingComparisonMetric, number | null>;
};

export type TrainingComparison = {
  kind: TrainingComparisonKind;
  title: string;
  metrics: TrainingComparisonMetric[];
  chartMetrics: TrainingComparisonMetric[];
  a: TrainingComparisonSubject | null;
  b: TrainingComparisonSubject | null;
  options: TrainingComparisonSubject[];
  timeline: TrainingComparisonTimelinePoint[];
  rangeA: { start: string; end: string };
  rangeB: { start: string; end: string } | null;
};

export function isTrainingComparisonKind(value: string | null | undefined): value is TrainingComparisonKind {
  return TRAINING_COMPARISON_KINDS.some((kind) => kind === value);
}

export function trainingComparisonKindForView(view: "general" | "routines" | "muscles" | "exercises"): TrainingComparisonKind {
  if (view === "general") return "periods";
  if (view === "routines") return "routines";
  if (view === "muscles") return "muscles";
  return "exercises";
}

export function comparisonDelta(a: number | null | undefined, b: number | null | undefined): TrainingComparisonDelta {
  if (typeof a !== "number" || !Number.isFinite(a) || typeof b !== "number" || !Number.isFinite(b)) {
    return { absolute: null, percentage: null, hasComparableBaseline: false };
  }
  const absolute = a - b;
  if (b === 0) return { absolute, percentage: null, hasComparableBaseline: false };
  return { absolute, percentage: (absolute / Math.abs(b)) * 100, hasComparableBaseline: true };
}

export function trainingComparisonMetricValue(
  subject: Pick<TrainingComparisonSubject, "summary" | "bestWeightKg" | "bestReps">,
  metric: TrainingComparisonMetric,
): number | null {
  if (metric === "averageSets") return subject.summary.sessions > 0 ? subject.summary.sets / subject.summary.sessions : null;
  if (metric === "exerciseCount") return subject.summary.hasData ? subject.summary.exerciseCount : null;
  if (metric === "bestWeight") return subject.bestWeightKg ?? null;
  if (metric === "bestReps") return subject.bestReps ?? null;
  return trainingAnalysisMetricValue(subject.summary, metric);
}

function timelineMetricValue(
  point: TrainingAnalysisTimelinePoint | TrainingAnalysisExerciseTimelinePoint | undefined,
  metric: TrainingComparisonMetric,
): number | null {
  if (!point) return metric === "bestWeight" || metric === "bestReps" || metric === "averageSets" || metric === "exerciseCount" ? null : 0;
  if (metric === "averageSets") return point.sessions > 0 ? point.sets / point.sessions : null;
  if (metric === "exerciseCount") return point.hasData ? point.exerciseCount : null;
  if (metric === "bestWeight") return "bestWeightKg" in point ? point.bestWeightKg : null;
  if (metric === "bestReps") return "bestReps" in point ? point.bestReps : null;
  return trainingAnalysisMetricValue(point, metric);
}

function subjectForRoutine(analysis: TrainingAnalysis, routineId: string): TrainingComparisonSubject | null {
  const routine = analysis.routines.find((item) => item.id === routineId);
  return routine ? { id: routine.id, label: routine.name, summary: routine.summary, timeline: routine.timeline } : null;
}

function subjectForMuscle(analysis: TrainingAnalysis, muscleKey: string): TrainingComparisonSubject | null {
  const muscle = analysis.muscles.find((item) => item.key === muscleKey);
  return muscle ? { id: muscle.key, label: muscle.label, summary: muscle.summary, timeline: muscle.timeline } : null;
}

function exerciseSummary(exercise: TrainingAnalysisExercise): TrainingAnalysisSummary {
  return {
    sessions: exercise.sessions,
    sets: exercise.sets,
    minutes: 0,
    volumeKg: exercise.volumeKg,
    exerciseCount: exercise.sessions > 0 ? 1 : 0,
    hasData: exercise.sessions > 0,
  };
}

function subjectForExercise(analysis: TrainingAnalysis, exerciseId: string): TrainingComparisonSubject | null {
  const exercise = analysis.exercises.find((item) => item.id === exerciseId);
  return exercise
    ? { id: exercise.id, label: exercise.name, summary: exerciseSummary(exercise), timeline: exercise.timeline, bestWeightKg: exercise.bestWeightKg, bestReps: exercise.bestReps }
    : null;
}

function uniqueSubjects(subjects: Array<TrainingComparisonSubject | null>): TrainingComparisonSubject[] {
  const seen = new Set<string>();
  const unique: TrainingComparisonSubject[] = [];
  for (const subject of subjects) {
    if (!subject || seen.has(subject.id)) continue;
    seen.add(subject.id);
    unique.push(subject);
  }
  return unique;
}

function selectPair(
  options: TrainingComparisonSubject[],
  requestedA?: string | null,
  requestedB?: string | null,
): { a: TrainingComparisonSubject | null; b: TrainingComparisonSubject | null } {
  const a = options.find((option) => option.id === requestedA) ?? options[0] ?? null;
  const b = options.find((option) => option.id === requestedB && option.id !== a?.id)
    ?? options.find((option) => option.id !== a?.id)
    ?? null;
  return { a, b };
}

function comparisonTimeline(
  a: TrainingComparisonSubject | null,
  b: TrainingComparisonSubject | null,
  metrics: TrainingComparisonMetric[],
): TrainingComparisonTimelinePoint[] {
  if (!a || !b) return [];
  const count = Math.max(a.timeline.length, b.timeline.length);
  return Array.from({ length: count }, (_, index) => {
    const aPoint = a.timeline[index];
    const bPoint = b.timeline[index];
    return {
      id: `${aPoint?.id ?? "a"}-${bPoint?.id ?? "b"}-${index}`,
      label: `Tramo ${index + 1}`,
      rangeA: { start: aPoint?.start ?? "", end: aPoint?.end ?? "" },
      rangeB: { start: bPoint?.start ?? "", end: bPoint?.end ?? "" },
      a: Object.fromEntries(metrics.map((metric) => [metric, timelineMetricValue(aPoint, metric)])) as Record<TrainingComparisonMetric, number | null>,
      b: Object.fromEntries(metrics.map((metric) => [metric, timelineMetricValue(bPoint, metric)])) as Record<TrainingComparisonMetric, number | null>,
    };
  });
}

function comparisonFromSubjects(input: {
  kind: Exclude<TrainingComparisonKind, "periods">;
  title: string;
  metrics: TrainingComparisonMetric[];
  subjects: TrainingComparisonSubject[];
  requestedA?: string | null;
  requestedB?: string | null;
  range: { start: string; end: string };
}): TrainingComparison {
  const { a, b } = selectPair(input.subjects, input.requestedA, input.requestedB);
  return {
    kind: input.kind,
    title: input.title,
    metrics: input.metrics,
    chartMetrics: input.metrics.filter((metric) => metric !== "sessions" && metric !== "averageSets" && metric !== "exerciseCount"),
    a,
    b,
    options: input.subjects,
    timeline: comparisonTimeline(a, b, input.metrics),
    rangeA: input.range,
    rangeB: b ? input.range : null,
  };
}

export function buildTrainingComparison(input: {
  kind: TrainingComparisonKind;
  analysis: TrainingAnalysis;
  previousAnalysis?: TrainingAnalysis;
  requestedA?: string | null;
  requestedB?: string | null;
  exerciseIds?: string[];
}): TrainingComparison {
  if (input.kind === "periods") {
    const a: TrainingComparisonSubject = { id: "current", label: "Actual", summary: input.analysis.summary, timeline: input.analysis.timeline };
    const b: TrainingComparisonSubject | null = input.previousAnalysis
      ? { id: "previous", label: "Anterior", summary: input.previousAnalysis.summary, timeline: input.previousAnalysis.timeline }
      : null;
    const metrics: TrainingComparisonMetric[] = ["sessions", "sets", "minutes", "volume"];
    return { kind: "periods", title: "Comparar períodos", metrics, chartMetrics: ["volume", "sets", "sessions", "minutes"], a, b, options: b ? [a, b] : [a], timeline: comparisonTimeline(a, b, metrics), rangeA: input.analysis.range, rangeB: input.previousAnalysis?.range ?? null };
  }

  if (input.kind === "routines") {
    const subjects = uniqueSubjects(input.analysis.activeRoutineIds.map((id) => subjectForRoutine(input.analysis, id)));
    return comparisonFromSubjects({ kind: "routines", title: "Comparar rutinas", metrics: ["sessions", "sets", "minutes", "volume"], subjects, requestedA: input.requestedA, requestedB: input.requestedB, range: input.analysis.range });
  }

  if (input.kind === "muscles") {
    const subjects = uniqueSubjects(input.analysis.muscles.map((muscle) => subjectForMuscle(input.analysis, muscle.key)));
    return comparisonFromSubjects({ kind: "muscles", title: "Comparar músculos", metrics: ["sets", "sessions", "averageSets", "exerciseCount"], subjects, requestedA: input.requestedA, requestedB: input.requestedB, range: input.analysis.range });
  }

  const exerciseIds = input.exerciseIds ?? input.analysis.exercises.map((exercise) => exercise.id);
  const subjects = uniqueSubjects(exerciseIds.map((id) => subjectForExercise(input.analysis, id)));
  return comparisonFromSubjects({ kind: "exercises", title: "Comparar ejercicios", metrics: ["sessions", "bestWeight", "bestReps", "volume"], subjects, requestedA: input.requestedA, requestedB: input.requestedB, range: input.analysis.range });
}
