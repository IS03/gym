"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MUSCLE_GROUP_OPTIONS, type MuscleGroupFilter } from "@/lib/phase2/muscle-groups";
import type { ExerciseProgressSummary, MuscleGroup } from "@/lib/phase2/types";

type HistoryExercise = {
  id: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  muscle_group_label: string | null;
  progress: ExerciseProgressSummary | null;
};

function lastSetLabel(progress: ExerciseProgressSummary | null) {
  if (!progress?.lastSets.length) return null;
  const set = progress.lastSets.find((item) => item.actual_reps !== null || item.actual_weight_kg !== null);
  if (!set) return null;
  return `${set.actual_weight_kg ?? "—"} kg × ${set.actual_reps ?? "—"}`;
}

export function HistoryExerciseList({ exercises }: { exercises: HistoryExercise[] }) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<MuscleGroupFilter>("all");
  const normalizedQuery = query.trim().toLocaleLowerCase("es");
  const visibleExercises = exercises.filter(
    (exercise) =>
      (group === "all" || exercise.grupo_muscular === group) &&
      exercise.nombre.toLocaleLowerCase("es").includes(normalizedQuery),
  );

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
        <Button type="button" size="sm" variant={group === "all" ? "default" : "outline"} onClick={() => setGroup("all")}>Todos</Button>
        {MUSCLE_GROUP_OPTIONS.map((option) => (
          <Button key={option.value} type="button" size="sm" variant={group === option.value ? "default" : "outline"} onClick={() => setGroup(option.value)}>{option.label}</Button>
        ))}
      </div>
      {visibleExercises.length === 0 ? (
        <p className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">No hay ejercicios con ese filtro.</p>
      ) : (
        <div className="space-y-2">
          {visibleExercises.map((exercise) => {
            const last = lastSetLabel(exercise.progress);
            return (
              <Link key={exercise.id} href={`/train/history/${exercise.id}`} className="surface-elevated block rounded-2xl border bg-card px-4 py-3 transition-[transform,background-color] duration-150 hover:bg-muted/50 active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{exercise.nombre}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{exercise.muscle_group_label ?? exercise.grupo_muscular ?? "Sin grupo"}</p>
                  </div>
                  {last ? <span className="metric-number shrink-0 text-right text-xs font-medium text-primary">{last}</span> : <span className="shrink-0 text-xs text-muted-foreground">Sin registros</span>}
                </div>
                {exercise.progress ? <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground"><span>Última: {exercise.progress.lastDate}</span><span>Mejor: {exercise.progress.bestWeightKg ?? "—"} kg</span></div> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
