import type { TrainingAnalysisPeriod } from "./training-analysis";

export const TRAINING_ANALYSIS_VIEWS = ["general", "routines", "muscles", "exercises"] as const;
export type TrainingAnalysisView = (typeof TRAINING_ANALYSIS_VIEWS)[number];

export type TrainingAnalysisNavigationState = {
  view: TrainingAnalysisView;
  period: TrainingAnalysisPeriod;
  routineId: string | null;
  muscleKey: string | null;
  exerciseQuery?: string;
  exerciseRoutineId?: string | "all";
  exerciseMuscleKey?: string | "all";
};

export function isTrainingAnalysisView(value: string | null | undefined): value is TrainingAnalysisView {
  return TRAINING_ANALYSIS_VIEWS.some((view) => view === value);
}

export function trainingAnalysisWorkspacePath(state: TrainingAnalysisNavigationState): string {
  const params = new URLSearchParams({ view: state.view, period: state.period });
  if (state.routineId) params.set("routine", state.routineId);
  if (state.muscleKey) params.set("muscle", state.muscleKey);
  if (state.view === "exercises") {
    if (state.exerciseQuery) params.set("query", state.exerciseQuery);
    if (state.exerciseRoutineId && state.exerciseRoutineId !== "all") params.set("routine_filter", state.exerciseRoutineId);
    if (state.exerciseMuscleKey && state.exerciseMuscleKey !== "all") params.set("muscle_filter", state.exerciseMuscleKey);
  }
  return `/train/progress?${params.toString()}`;
}

export function trainingAnalysisExercisePath(exerciseId: string, state: TrainingAnalysisNavigationState): string {
  const params = new URLSearchParams({ from: "progress", period: state.period, view: state.view });
  if (state.routineId) {
    params.set("routine", state.routineId);
    if (state.routineId !== "__free__") params.set("routine_id", state.routineId);
  }
  if (state.muscleKey) params.set("muscle", state.muscleKey);
  if (state.view === "exercises") {
    if (state.exerciseQuery) params.set("query", state.exerciseQuery);
    if (state.exerciseRoutineId && state.exerciseRoutineId !== "all") params.set("routine_filter", state.exerciseRoutineId);
    if (state.exerciseMuscleKey && state.exerciseMuscleKey !== "all") params.set("muscle_filter", state.exerciseMuscleKey);
  }
  return `/train/history/${exerciseId}?${params.toString()}`;
}
