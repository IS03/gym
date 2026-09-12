"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import type { TrainingAnalysis } from "@/lib/phase2/training-analysis";
import { normalizeExerciseSearch } from "@/lib/phase2/exercise-library";
import { trainingAnalysisExercisePath, type TrainingAnalysisNavigationState } from "@/lib/phase2/training-analysis-navigation";
import type { TrainingExerciseListItem, TrainingExercisesAnalytics } from "@/lib/progress/training-exercises";
import type { TrainingPerformanceStatus } from "@/lib/progress/training-performance";
import { cn } from "@/lib/utils";

type StatusFilter = "all" | Exclude<TrainingPerformanceStatus, "insufficient_data">;

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "improved", label: "Mejoraron" },
  { value: "stable", label: "Estables" },
  { value: "declined", label: "Bajaron" },
];

const STATUS_LABELS: Record<TrainingPerformanceStatus, string> = {
  improved: "Mejoró",
  stable: "Sin cambio claro",
  declined: "Bajó",
  insufficient_data: "Sin datos suficientes",
};

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Cordoba" })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function matches(item: TrainingExerciseListItem, input: { query: string; routineId: string; muscleKey: string; status: StatusFilter }) {
  if (input.routineId !== "all" && !item.routineIds.includes(input.routineId)) return false;
  if (input.muscleKey !== "all" && item.muscleKey !== input.muscleKey) return false;
  if (input.status !== "all" && item.performance.status !== input.status) return false;
  return normalizeExerciseSearch([item.name, item.muscleLabel, item.routineNames.join(" ")].join(" ")).includes(normalizeExerciseSearch(input.query));
}

export function TrainingExercisesV2({
  analysis,
  analytics,
  state,
}: {
  analysis: TrainingAnalysis;
  analytics: TrainingExercisesAnalytics;
  state: TrainingAnalysisNavigationState;
}) {
  const [query, setQuery] = useState(state.exerciseQuery ?? "");
  const deferredQuery = useDeferredValue(query);
  const [routineId, setRoutineId] = useState(state.exerciseRoutineId ?? "all");
  const [muscleKey, setMuscleKey] = useState(state.exerciseMuscleKey ?? "all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const visible = useMemo(() => analytics.exercises.filter((item) => matches(item, { query: deferredQuery, routineId, muscleKey, status })), [analytics.exercises, deferredQuery, muscleKey, routineId, status]);
  const exerciseState = { ...state, exerciseQuery: query || undefined, exerciseRoutineId: routineId, exerciseMuscleKey: muscleKey };
  const routines = analysis.routines.filter((routine) => analytics.exercises.some((exercise) => exercise.routineIds.includes(routine.id)));
  const muscles = analysis.muscles.filter((muscle) => analytics.exercises.some((exercise) => exercise.muscleKey === muscle.key));

  return <section className="space-y-4" aria-labelledby="training-exercises-title">
    <div><h2 id="training-exercises-title" className="text-lg font-semibold tracking-tight">Encontrá un ejercicio</h2><p className="mt-1 text-sm text-muted-foreground">Descubrí qué movimiento cambió y abrí la evidencia sesión por sesión.</p></div>
    <label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar ejercicio" className="h-11 pl-9" aria-label="Buscar ejercicio" /></label>
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Rutina<select value={routineId} onChange={(event) => setRoutineId(event.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todas las rutinas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label>
      <label className="space-y-1 text-xs font-medium text-muted-foreground">Músculo<select value={muscleKey} onChange={(event) => setMuscleKey(event.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todos los músculos</option>{muscles.map((muscle) => <option key={muscle.key} value={muscle.key}>{muscle.label}</option>)}</select></label>
    </div>
    <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Estado de rendimiento">{STATUS_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setStatus(option.value)} aria-pressed={status === option.value} className={cn("min-h-11 shrink-0 rounded-full border px-4 text-sm font-medium", status === option.value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground")}>{option.label}</button>)}</div>
    <p className="text-xs text-muted-foreground">{visible.length} {visible.length === 1 ? "ejercicio" : "ejercicios"} · los históricos siguen disponibles aunque ya no estén en una rutina activa.</p>
    {visible.length === 0 ? <div className="rounded-xl border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">No encontramos ejercicios con esos filtros.</div> : <div className="divide-y rounded-xl border bg-card px-3">{visible.map((exercise) => {
      const signal = exercise.performance.signal?.description;
      const statusLabel = STATUS_LABELS[exercise.performance.status];
      const context = [exercise.muscleLabel, exercise.routineNames[0], exercise.lastDate ? `última ${shortDate(exercise.lastDate)}` : null].filter(Boolean).join(" · ");
      return <Link key={exercise.id} href={trainingAnalysisExercisePath(exercise.id, exerciseState)} className="group flex min-h-16 items-center gap-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{exercise.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{context}</span><span className={cn("mt-1 block text-xs font-medium", exercise.performance.status === "improved" ? "text-primary" : "text-muted-foreground")}>{statusLabel}{signal && signal !== "Sin cambio claro" ? ` · ${signal}` : ""}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden /></Link>;
    })}</div>}
  </section>;
}
