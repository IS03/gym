import type { TrainingAnalysis, TrainingAnalysisRoutine, TrainingAnalysisSource } from "../phase2/training-analysis";
import type { ProgressComparisonReport, ProgressTemporalComparisonReference } from "./comparisons";
import {
  buildTrainingLoadComparison,
  buildTrainingPerformanceComparison,
  type TrainingGeneralAnalytics,
} from "./training-performance";

export type TrainingRoutinePerformance = TrainingGeneralAnalytics["performance"];

export type TrainingRoutineListItem = {
  id: string;
  name: string;
  isActive: boolean;
  sessions: number;
  exerciseCount: number;
  performance: TrainingRoutinePerformance;
};

export type TrainingRoutineMuscleDistribution = {
  key: string;
  label: string;
  sets: number;
  ratio: number;
};

export type TrainingRoutineDetailAnalytics = {
  routine: TrainingAnalysisRoutine;
  referenceRoutine: TrainingAnalysisRoutine | null;
  isActive: boolean;
  performance: TrainingRoutinePerformance;
  loadComparison: ProgressComparisonReport;
  muscleDistribution: TrainingRoutineMuscleDistribution[];
  confidenceNote: string | null;
};

export type TrainingRoutinesAnalytics = {
  routines: TrainingRoutineListItem[];
  selected: TrainingRoutineDetailAnalytics | null;
};

/**
 * Cross-routine comparison describes composition and training load only. It is
 * deliberately separate from the per-exercise performance state.
 */
export const TRAINING_CROSS_ROUTINE_METRICS = ["sessions", "sets", "minutes", "volume"] as const;

function muscleDistribution(routine: TrainingAnalysisRoutine): TrainingRoutineMuscleDistribution[] {
  // `TrainingAnalysisRoutine.muscles` assigns every completed set to the real
  // primary muscle snapshot once, avoiding primary/secondary double counting.
  const total = routine.muscles.reduce((sum, muscle) => sum + muscle.sets, 0);
  return routine.muscles
    .filter((muscle) => muscle.sets > 0)
    .map((muscle) => ({
      ...muscle,
      ratio: total > 0 ? muscle.sets / total : 0,
    }))
    .sort((left, right) => right.sets - left.sets || left.label.localeCompare(right.label, "es-AR"));
}

function confidenceNote(primarySessions: number, referenceSessions: number): string | null {
  if (referenceSessions === 0) return "No hay suficiente historial de esta rutina para comparar este período.";
  if (primarySessions < 2 || referenceSessions < 2) {
    return "La comparación se apoya en pocas sesiones; tomala como evidencia puntual, no como una tendencia consolidada.";
  }
  return null;
}

export function buildTrainingRoutinesAnalytics(input: {
  source: TrainingAnalysisSource;
  primary: TrainingAnalysis;
  reference: TrainingAnalysis;
  referenceDefinition: ProgressTemporalComparisonReference;
  selectedRoutineId?: string | null;
  selectedMetricKeys?: readonly string[];
  activeMetricKey?: string | null;
}): TrainingRoutinesAnalytics {
  const activeIds = new Set(input.primary.activeRoutineIds);
  const relevant = input.primary.routines.filter((routine) => routine.summary.hasData);
  const performanceByRoutine = new Map(relevant.map((routine) => [
    routine.id,
    buildTrainingPerformanceComparison({
      source: input.source,
      primaryPeriod: input.primary.range,
      referencePeriod: input.reference.range,
      routineId: routine.id,
    }),
  ]));
  const routines = relevant.map((routine) => ({
    id: routine.id,
    name: routine.name,
    isActive: activeIds.has(routine.id),
    sessions: routine.summary.sessions,
    exerciseCount: routine.summary.exerciseCount,
    performance: performanceByRoutine.get(routine.id)!,
  }));

  const selectedRoutine = input.selectedRoutineId
    ? input.primary.routines.find((routine) => routine.id === input.selectedRoutineId) ?? null
    : null;
  if (!selectedRoutine) return { routines, selected: null };
  const referenceRoutine = input.reference.routines.find((routine) => routine.id === selectedRoutine.id) ?? null;
  const performance = performanceByRoutine.get(selectedRoutine.id) ?? buildTrainingPerformanceComparison({
    source: input.source,
    primaryPeriod: input.primary.range,
    referencePeriod: input.reference.range,
    routineId: selectedRoutine.id,
  });
  return {
    routines,
    selected: {
      routine: selectedRoutine,
      referenceRoutine,
      isActive: activeIds.has(selectedRoutine.id),
      performance,
      loadComparison: buildTrainingLoadComparison({
        source: input.source,
        primary: input.primary,
        reference: input.reference,
        referenceDefinition: input.referenceDefinition,
        selectedMetricKeys: input.selectedMetricKeys,
        activeMetricKey: input.activeMetricKey,
        routineId: selectedRoutine.id,
      }),
      muscleDistribution: muscleDistribution(selectedRoutine),
      confidenceNote: confidenceNote(selectedRoutine.summary.sessions, referenceRoutine?.summary.sessions ?? 0),
    },
  };
}
