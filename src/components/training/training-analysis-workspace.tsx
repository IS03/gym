"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  TRAINING_ANALYSIS_PERIODS,
  TRAINING_ANALYSIS_RECENT_EXERCISE_LIMIT,
  filterTrainingAnalysisExercises,
  type TrainingAnalysis,
} from "@/lib/phase2/training-analysis";
import {
  trainingAnalysisExercisePath,
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
import { cn } from "@/lib/utils";

type WorkspaceState = TrainingAnalysisNavigationState;

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(value);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Cordoba" })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function EmptyState({ children }: { children: import("react").ReactNode }) {
  return <div className="rounded-xl border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">{children}</div>;
}

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

function PeriodSelector({ state }: { state: WorkspaceState }) {
  return <div className="grid grid-cols-4 gap-1 rounded-xl border bg-muted/25 p-1" aria-label="Período de análisis">{TRAINING_ANALYSIS_PERIODS.map((period) => {
    const selected = period.value === state.period;
    const compact = period.value.endsWith("w") ? `${period.value.slice(0, -1)} sem` : period.label;
    return <Link key={period.value} href={trainingAnalysisWorkspacePath({ ...state, period: period.value })} className={cn("flex h-10 min-w-0 items-center justify-center rounded-lg px-1 text-center text-[11px] font-medium whitespace-nowrap transition-colors sm:text-xs", selected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={selected ? "page" : undefined}>{compact}</Link>;
  })}</div>;
}

function AnalysisRow({ href, title, description, value }: { href: string; title: string; description: string; value: string }) {
  return <Link href={href} className="group flex min-h-14 items-center gap-3 border-b border-border/70 py-3 outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span></span><span className="metric-number shrink-0 text-right text-sm font-medium">{value}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden /></Link>;
}

function ExercisesView({ analysis, state }: { analysis: TrainingAnalysis; state: WorkspaceState }) {
  const [query, setQuery] = useState(state.exerciseQuery ?? "");
  const [routineId, setRoutineId] = useState<string | "all">(state.exerciseRoutineId ?? "all");
  const [muscleKey, setMuscleKey] = useState<string | "all">(state.exerciseMuscleKey ?? "all");
  const [showAll, setShowAll] = useState(false);
  const visible = useMemo(() => filterTrainingAnalysisExercises(analysis.exercises, { query, routineId, muscleKey }), [analysis.exercises, muscleKey, query, routineId]);
  const isCompact = !showAll && !query && routineId === "all" && muscleKey === "all";
  const rendered = isCompact ? visible.slice(0, TRAINING_ANALYSIS_RECENT_EXERCISE_LIMIT) : visible;
  const exerciseState: WorkspaceState = { ...state, exerciseQuery: query || undefined, exerciseRoutineId: routineId, exerciseMuscleKey: muscleKey };
  const activeRoutines = analysis.routines.filter((routine) => analysis.activeRoutineIds.includes(routine.id));
  return <section className="space-y-4"><div><h2 className="text-lg font-semibold tracking-tight">Encontrá un ejercicio</h2><p className="mt-1 text-sm text-muted-foreground">Abrí su reporte completo de peso, reps, volumen y sesiones.</p></div><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(true); }} placeholder="Buscar ejercicio" className="h-11 pl-9" aria-label="Buscar ejercicio" /></label><div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium text-muted-foreground">Rutina<select value={routineId} onChange={(event) => { setRoutineId(event.target.value); setShowAll(true); }} className="h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todas las rutinas</option>{activeRoutines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Músculo<select value={muscleKey} onChange={(event) => { setMuscleKey(event.target.value); setShowAll(true); }} className="h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todos los músculos</option>{analysis.muscles.map((muscle) => <option key={muscle.key} value={muscle.key}>{muscle.label}</option>)}</select></label></div><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{isCompact ? `${rendered.length} ejercicios recientes` : `${visible.length} ${visible.length === 1 ? "ejercicio" : "ejercicios"}`}</span>{isCompact && visible.length > rendered.length && <button type="button" onClick={() => setShowAll(true)} className="min-h-9 text-sm font-medium text-primary hover:underline">Ver todos</button>}</div>{rendered.length === 0 ? <EmptyState>No encontramos ejercicios con esos filtros.</EmptyState> : <div>{rendered.map((exercise) => <AnalysisRow key={exercise.id} href={trainingAnalysisExercisePath(exercise.id, exerciseState)} title={exercise.name} description={`${exercise.muscleLabel} · última sesión ${shortDate(exercise.lastDate)} · ${exercise.sessions} ${exercise.sessions === 1 ? "sesión" : "sesiones"}`} value={exercise.bestWeightKg === null ? `${exercise.sets} series` : `${formatNumber(exercise.bestWeightKg, 1)} kg`} />)}</div>}</section>;
}

export function TrainingAnalysisWorkspace({ analysis, view, routineId, muscleKey, muscleZoneKey, exerciseQuery, exerciseRoutineId, exerciseMuscleKey, comparison, generalV2, routinesV2, musclesV2 }: { analysis: TrainingAnalysis; view: TrainingAnalysisView; routineId: string | null; muscleKey: string | null; muscleZoneKey?: string | null; exerciseQuery?: string; exerciseRoutineId?: string | "all"; exerciseMuscleKey?: string | "all"; comparison?: TrainingComparison | null; generalV2?: { analytics: TrainingGeneralAnalytics; reference: ProgressTemporalComparisonReference; comparisonQuery: ProgressComparisonQuery; today: string; comparisonError?: string | null } | null; routinesV2?: { analytics: TrainingRoutinesAnalytics; reference: ProgressTemporalComparisonReference; comparisonQuery: ProgressComparisonQuery; today: string; comparisonError?: string | null } | null; musclesV2?: { analytics: TrainingMusclesAnalytics; reference: ProgressTemporalComparisonReference; comparisonQuery: ProgressComparisonQuery; today: string; comparisonError?: string | null } | null }) {
  const state: WorkspaceState = { view, period: analysis.period, customFrom: analysis.period === "custom" ? analysis.range.start : null, customTo: analysis.period === "custom" ? analysis.range.end : null, routineId, muscleKey, muscleZoneKey, exerciseQuery, exerciseRoutineId, exerciseMuscleKey, comparison: comparison?.kind, comparisonA: comparison?.mode === "cross" ? comparison.a?.id : null, comparisonB: comparison?.mode === "cross" ? comparison.b?.id : null, comparisonSubjectType: comparison?.mode === "self" ? comparison.subjectType : null, comparisonSubject: comparison?.mode === "self" ? comparison.subjectId : null };
  const selectedRoutine = routineId ? analysis.routines.find((routine) => routine.id === routineId) ?? null : null;
  const selectedMuscle = muscleKey ? analysis.muscles.find((muscle) => muscle.key === muscleKey) ?? null : null;
  const comparisonBackLabel = view === "routines" ? selectedRoutine?.name ?? "Rutinas" : view === "muscles" ? selectedMuscle?.label ?? "Músculos" : view === "exercises" ? "Ejercicios" : "Entrenamiento";
  const crossComparison = comparison?.mode === "cross" ? comparison : null;
  return <div className="space-y-6"><div className="space-y-3"><ContextTabs state={state} />{view === "routines" && routinesV2 ? <TrainingProgressPeriodSelector analysis={analysis} reference={routinesV2.reference} today={routinesV2.today} view="routines" /> : view === "muscles" && musclesV2 ? <TrainingProgressPeriodSelector analysis={analysis} reference={musclesV2.reference} today={musclesV2.today} view="muscles" /> : view === "exercises" ? <PeriodSelector state={state} /> : null}</div>{crossComparison ? <TrainingComparisonWorkspace comparison={crossComparison} state={state} backLabel={comparisonBackLabel} /> : <>{view === "general" && generalV2 ? <TrainingGeneralV2 analysis={analysis} analytics={generalV2.analytics} state={state} reference={generalV2.reference} comparisonQuery={generalV2.comparisonQuery} today={generalV2.today} comparisonError={generalV2.comparisonError} /> : null}{view === "routines" && routinesV2 ? <TrainingRoutinesV2 analysis={analysis} analytics={routinesV2.analytics} state={state} reference={routinesV2.reference} comparisonQuery={routinesV2.comparisonQuery} today={routinesV2.today} comparisonError={routinesV2.comparisonError} /> : null}{view === "muscles" && musclesV2 ? <TrainingMusclesV2 analysis={analysis} analytics={musclesV2.analytics} state={state} reference={musclesV2.reference} comparisonQuery={musclesV2.comparisonQuery} today={musclesV2.today} comparisonError={musclesV2.comparisonError} /> : null}{view === "exercises" && <ExercisesView analysis={analysis} state={state} />}</>}</div>;
}
