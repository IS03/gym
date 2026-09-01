import type { TrainingAnalysisPeriod } from "./training-analysis";
import type { TrainingComparisonKind, TrainingComparisonSubjectType } from "./training-comparison";

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
  comparison?: TrainingComparisonKind;
  comparisonA?: string | null;
  comparisonB?: string | null;
  comparisonSubjectType?: TrainingComparisonSubjectType | null;
  comparisonSubject?: string | null;
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
  if (state.comparison) {
    params.set("compare", state.comparison);
    if (state.comparisonA) params.set("a", state.comparisonA);
    if (state.comparisonB) params.set("b", state.comparisonB);
    if (state.comparisonSubjectType) params.set("subject_type", state.comparisonSubjectType);
    if (state.comparisonSubject) params.set("subject", state.comparisonSubject);
  }
  return `/train/progress?${params.toString()}`;
}

export function trainingAnalysisComparisonPath(
  state: TrainingAnalysisNavigationState,
  comparison: Exclude<TrainingComparisonKind, "previous">,
  input?: { a?: string | null; b?: string | null },
): string {
  return trainingAnalysisWorkspacePath({ ...state, comparison, comparisonA: input?.a ?? null, comparisonB: input?.b ?? null, comparisonSubjectType: null, comparisonSubject: null });
}

export function trainingAnalysisSelfComparisonPath(
  state: TrainingAnalysisNavigationState,
  input: { subjectType: TrainingComparisonSubjectType; subject?: string | null },
): string {
  return trainingAnalysisWorkspacePath({
    ...state,
    comparison: "previous",
    comparisonA: null,
    comparisonB: null,
    comparisonSubjectType: input.subjectType,
    comparisonSubject: input.subject ?? null,
  });
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
