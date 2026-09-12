"use client";

import Link from "next/link";
import {
  type TrainingAnalysis,
} from "@/lib/phase2/training-analysis";
import {
  trainingAnalysisWorkspacePath,
  type TrainingAnalysisNavigationState,
  type TrainingAnalysisView,
} from "@/lib/phase2/training-analysis-navigation";
import { type TrainingComparison } from "@/lib/phase2/training-comparison";
import { TrainingComparisonWorkspace } from "@/components/training/training-comparison-workspace";
import { TrainingGeneralV2 } from "@/components/training/training-general-v2";
import { TrainingProgressPeriodSelector } from "@/components/training/training-progress-period-selector";
import { TrainingRoutinesV2 } from "@/components/training/training-routines-v2";
import { TrainingMusclesV2 } from "@/components/training/training-muscles-v2";
import type { ProgressComparisonQuery, ProgressTemporalComparisonReference } from "@/lib/progress/comparisons";
import type { TrainingGeneralAnalytics } from "@/lib/progress/training-performance";
import type { TrainingRoutinesAnalytics } from "@/lib/progress/training-routines";
import type { TrainingMusclesAnalytics } from "@/lib/progress/training-muscles";
import type { TrainingExercisesAnalytics } from "@/lib/progress/training-exercises";
import { TrainingExercisesV2 } from "@/components/training/training-exercises-v2";
import { cn } from "@/lib/utils";

type WorkspaceState = TrainingAnalysisNavigationState;


function ContextTabs({ state }: { state: WorkspaceState }) {
  const contexts: Array<{ value: TrainingAnalysisView; label: string }> = [
    { value: "general", label: "General" },
    { value: "routines", label: "Rutinas" },
    { value: "muscles", label: "Músculos" },
    { value: "exercises", label: "Ejercicios" },
  ];
  return <nav className="grid grid-cols-4 rounded-xl border bg-muted/35 p-1" aria-label="Contexto de análisis">{contexts.map((context) => {
    const selected = state.view === context.value;
    return <Link key={context.value} href={trainingAnalysisWorkspacePath({ view: context.value, period: state.period, customFrom: state.customFrom, customTo: state.customTo, routineId: null, muscleKey: null })} className={cn("flex h-10 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-medium transition-colors sm:text-sm", selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={selected ? "page" : undefined}>{context.label}</Link>;
  })}</nav>;
}

export function TrainingAnalysisWorkspace({ analysis, view, routineId, muscleKey, muscleZoneKey, exerciseQuery, exerciseRoutineId, exerciseMuscleKey, comparison, generalV2, routinesV2, musclesV2, exercisesV2 }: { analysis: TrainingAnalysis; view: TrainingAnalysisView; routineId: string | null; muscleKey: string | null; muscleZoneKey?: string | null; exerciseQuery?: string; exerciseRoutineId?: string | "all"; exerciseMuscleKey?: string | "all"; comparison?: TrainingComparison | null; generalV2?: { analytics: TrainingGeneralAnalytics; reference: ProgressTemporalComparisonReference; comparisonQuery: ProgressComparisonQuery; today: string; comparisonError?: string | null } | null; routinesV2?: { analytics: TrainingRoutinesAnalytics; reference: ProgressTemporalComparisonReference; comparisonQuery: ProgressComparisonQuery; today: string; comparisonError?: string | null } | null; musclesV2?: { analytics: TrainingMusclesAnalytics; reference: ProgressTemporalComparisonReference; comparisonQuery: ProgressComparisonQuery; today: string; comparisonError?: string | null } | null; exercisesV2?: { analytics: TrainingExercisesAnalytics; reference: ProgressTemporalComparisonReference; today: string } | null }) {
  const state: WorkspaceState = { view, period: analysis.period, customFrom: analysis.period === "custom" ? analysis.range.start : null, customTo: analysis.period === "custom" ? analysis.range.end : null, routineId, muscleKey, muscleZoneKey, exerciseQuery, exerciseRoutineId, exerciseMuscleKey, comparison: comparison?.kind, comparisonA: comparison?.mode === "cross" ? comparison.a?.id : null, comparisonB: comparison?.mode === "cross" ? comparison.b?.id : null, comparisonSubjectType: comparison?.mode === "self" ? comparison.subjectType : null, comparisonSubject: comparison?.mode === "self" ? comparison.subjectId : null };
  const selectedRoutine = routineId ? analysis.routines.find((routine) => routine.id === routineId) ?? null : null;
  const selectedMuscle = muscleKey ? analysis.muscles.find((muscle) => muscle.key === muscleKey) ?? null : null;
  const comparisonBackLabel = view === "routines" ? selectedRoutine?.name ?? "Rutinas" : view === "muscles" ? selectedMuscle?.label ?? "Músculos" : view === "exercises" ? "Ejercicios" : "Entrenamiento";
  const crossComparison = comparison?.mode === "cross" ? comparison : null;
  return <div className="space-y-6"><div className="space-y-3"><ContextTabs state={state} />{view === "routines" && routinesV2 ? <TrainingProgressPeriodSelector analysis={analysis} reference={routinesV2.reference} today={routinesV2.today} view="routines" /> : view === "muscles" && musclesV2 ? <TrainingProgressPeriodSelector analysis={analysis} reference={musclesV2.reference} today={musclesV2.today} view="muscles" /> : view === "exercises" && exercisesV2 ? <TrainingProgressPeriodSelector analysis={analysis} reference={exercisesV2.reference} today={exercisesV2.today} view="exercises" /> : null}</div>{crossComparison ? <TrainingComparisonWorkspace comparison={crossComparison} state={state} backLabel={comparisonBackLabel} /> : <>{view === "general" && generalV2 ? <TrainingGeneralV2 analysis={analysis} analytics={generalV2.analytics} state={state} reference={generalV2.reference} comparisonQuery={generalV2.comparisonQuery} today={generalV2.today} comparisonError={generalV2.comparisonError} /> : null}{view === "routines" && routinesV2 ? <TrainingRoutinesV2 analysis={analysis} analytics={routinesV2.analytics} state={state} reference={routinesV2.reference} comparisonQuery={routinesV2.comparisonQuery} today={routinesV2.today} comparisonError={routinesV2.comparisonError} /> : null}{view === "muscles" && musclesV2 ? <TrainingMusclesV2 analysis={analysis} analytics={musclesV2.analytics} state={state} reference={musclesV2.reference} comparisonQuery={musclesV2.comparisonQuery} today={musclesV2.today} comparisonError={musclesV2.comparisonError} /> : null}{view === "exercises" && exercisesV2 ? <TrainingExercisesV2 analysis={analysis} analytics={exercisesV2.analytics} state={state} /> : null}</>}</div>;
}
