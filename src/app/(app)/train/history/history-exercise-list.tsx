"use client";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronRight, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filterExerciseDirectory,
  sortExerciseDirectory,
  summarizeLatestExercisePerformance,
  type ExerciseDirectoryEntry,
} from "@/lib/phase2/exercise-insights";
import { exerciseGroupLabel } from "@/lib/phase2/exercise-library";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import type { ExerciseProgressSummary, MuscleGroup } from "@/lib/phase2/types";

type HistoryExercise = {
  id: string;
  nombre: string;
  grupo_muscular: MuscleGroup | null;
  muscle_group_label: string | null;
  progress: ExerciseProgressSummary | null;
  routineIds: string[];
};

type RoutineOption = { id: string; nombre: string };
type GroupValue = MuscleGroup | "all";
type RoutineValue = string | "all";

function number(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function latestPerformanceLabel(item: ExerciseDirectoryEntry) {
  const summary = summarizeLatestExercisePerformance(item.lastSets);
  if (summary.completedSets === 0) return null;
  if (summary.singleSet) {
    if (summary.singleSet.reps !== null && summary.singleSet.weightKg !== null) {
      return `${summary.singleSet.reps} × ${number(summary.singleSet.weightKg)} kg`;
    }
    if (summary.singleSet.weightKg !== null) return `hasta ${number(summary.singleSet.weightKg)} kg`;
    if (summary.singleSet.reps !== null) return `${summary.singleSet.reps} reps`;
  }
  return `${summary.completedSets} ${summary.completedSets === 1 ? "serie" : "series"}${summary.maxWeightKg === null ? "" : ` · hasta ${number(summary.maxWeightKg)} kg`}`;
}

function chipClassName(selected: boolean) {
  return `min-h-9 rounded-full border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
    selected
      ? "border-primary bg-primary text-primary-foreground"
      : "border-border bg-background text-foreground hover:bg-muted"
  }`;
}

function FilterSheet({
  open,
  onOpenChange,
  group,
  routine,
  routines,
  onGroupChange,
  onRoutineChange,
  onClear,
  onApply,
  count,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: GroupValue;
  routine: RoutineValue;
  routines: RoutineOption[];
  onGroupChange: (value: GroupValue) => void;
  onRoutineChange: (value: RoutineValue) => void;
  onClear: () => void;
  onApply: () => void;
  count: number;
}) {
  const hasDraftFilters = group !== "all" || routine !== "all";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden lg:items-center lg:p-6">
          <Dialog.Popup className="flex max-h-[min(82dvh,42rem)] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none lg:max-w-lg lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            <header className="relative shrink-0 border-b border-border/70 px-4 pb-3 pt-3 sm:px-5 lg:pt-5">
              <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
              <Dialog.Title className="text-lg font-semibold">Filtrar ejercicios</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">Acotá el historial por rutina o grupo muscular.</Dialog.Description>
              <Dialog.Close
                type="button"
                className="absolute right-2 top-3 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:right-3 lg:top-3"
                aria-label="Cerrar filtros"
              >
                <X className="size-4" aria-hidden />
              </Dialog.Close>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
              <label className="block space-y-1.5 text-sm font-medium">
                Rutina
                <select
                  value={routine}
                  onChange={(event) => onRoutineChange(event.target.value)}
                  className="h-11 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="all">Todas las rutinas</option>
                  {routines.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
                </select>
              </label>
              <section className="mt-5" aria-labelledby="history-muscle-filter-title">
                <h3 id="history-muscle-filter-title" className="text-sm font-medium">Músculo</h3>
                <div className="mt-3 flex flex-wrap gap-2" aria-label="Filtrar por músculo">
                  <button type="button" aria-pressed={group === "all"} onClick={() => onGroupChange("all")} className={chipClassName(group === "all")}>Todos</button>
                  {MUSCLE_GROUP_OPTIONS.map((option) => (
                    <button key={option.value} type="button" aria-pressed={group === option.value} onClick={() => onGroupChange(option.value)} className={chipClassName(group === option.value)}>{option.label}</button>
                  ))}
                </div>
              </section>
            </div>
            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:pb-3">
              {hasDraftFilters ? <Button type="button" variant="ghost" onClick={onClear}>Limpiar</Button> : <span aria-hidden />}
              <Button type="button" onClick={onApply}>Ver {count} {count === 1 ? "ejercicio" : "ejercicios"}</Button>
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExerciseHistoryRows({ items }: { items: ExerciseDirectoryEntry[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {items.map((item) => {
        const latest = latestPerformanceLabel(item);
        const best = item.bestWeightKg === null ? "—" : `${number(item.bestWeightKg)} kg`;

        return (
          <Link
            key={item.id}
            href={`/train/history/${item.id}?from=history`}
            className="group flex min-h-[72px] items-center gap-3 border-b border-border/70 px-3 py-2.5 outline-none transition-[background-color,transform] duration-150 last:border-b-0 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.995] motion-reduce:transition-none"
            aria-label={`Abrir historial de ${item.name}`}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-5">{item.name}</span>
              <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">{exerciseGroupLabel({ grupo_muscular: item.muscleGroup, muscle_group_label: item.muscleLabel })}</span>
              <span className="mt-1 grid grid-cols-2 gap-3 text-xs leading-4">
                <span className="min-w-0 truncate text-muted-foreground">Último <span className="metric-number text-foreground">{latest ?? "Sin registros"}</span></span>
                <span className="min-w-0 truncate text-muted-foreground">Mejor <span className="metric-number text-foreground">{best}</span></span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}

export function HistoryExerciseList({ exercises, routines }: { exercises: HistoryExercise[]; routines: RoutineOption[] }) {
  const items = useMemo<ExerciseDirectoryEntry[]>(
    () => exercises.map((exercise) => ({
      id: exercise.id,
      name: exercise.nombre,
      muscleGroup: exercise.grupo_muscular,
      muscleLabel: exercise.muscle_group_label,
      lastDate: exercise.progress?.lastDate ?? null,
      sessions: exercise.progress?.sessions ?? 0,
      bestWeightKg: exercise.progress?.bestWeightKg ?? null,
      totalVolumeKg: exercise.progress?.totalVolumeKg ?? 0,
      lastDecision: exercise.progress?.lastDecision ?? null,
      lastSets: exercise.progress?.lastSets ?? [],
      routineIds: exercise.routineIds,
    })),
    [exercises],
  );
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupValue>("all");
  const [routine, setRoutine] = useState<RoutineValue>("all");
  const [draftGroup, setDraftGroup] = useState<GroupValue>("all");
  const [draftRoutine, setDraftRoutine] = useState<RoutineValue>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleItems = useMemo(
    () => sortExerciseDirectory(filterExerciseDirectory(items, { query, muscleGroup: group, routineId: routine }), "alpha"),
    [group, items, query, routine],
  );
  const filterPreviewCount = useMemo(
    () => filterExerciseDirectory(items, { query, muscleGroup: draftGroup, routineId: draftRoutine }).length,
    [draftGroup, draftRoutine, items, query],
  );
  const selectedRoutine = routines.find((item) => item.id === routine) ?? null;
  const selectedGroup = MUSCLE_GROUP_OPTIONS.find((item) => item.value === group) ?? null;
  const hasActiveFilters = group !== "all" || routine !== "all";

  function clearAppliedFilters() {
    setGroup("all");
    setRoutine("all");
    setDraftGroup("all");
    setDraftRoutine("all");
  }

  function clearSearchAndFilters() {
    setQuery("");
    clearAppliedFilters();
  }

  function handleFiltersOpenChange(open: boolean) {
    if (open) {
      setDraftGroup(group);
      setDraftRoutine(routine);
    }
    setFiltersOpen(open);
  }

  function applyFilters() {
    setGroup(draftGroup);
    setRoutine(draftRoutine);
    setFiltersOpen(false);
  }

  return (
    <section aria-labelledby="history-exercise-list-title" className="space-y-3 lg:mx-auto lg:max-w-4xl">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pr-10 pl-9" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" />
          {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Limpiar búsqueda"><X className="size-4" aria-hidden /></button> : null}
        </label>
        <button
          type="button"
          onClick={() => handleFiltersOpenChange(true)}
          className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label={hasActiveFilters ? "Filtrar ejercicios. Hay filtros activos" : "Filtrar ejercicios"}
          aria-haspopup="dialog"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {hasActiveFilters ? <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background" aria-hidden /> : null}
        </button>
        <div className="hidden items-center gap-2 lg:flex">
          <select value={routine} onChange={(event) => setRoutine(event.target.value)} className="h-11 min-w-40 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Filtrar por rutina">
            <option value="all">Todas las rutinas</option>
            {routines.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
          <select value={group} onChange={(event) => setGroup(event.target.value as GroupValue)} className="h-11 min-w-36 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Filtrar por músculo">
            <option value="all">Todos los músculos</option>
            {MUSCLE_GROUP_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      {hasActiveFilters ? <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
        {selectedRoutine ? <Button type="button" size="sm" variant="secondary" onClick={() => setRoutine("all")}>{selectedRoutine.nombre}<X className="size-3" aria-hidden /></Button> : null}
        {selectedGroup ? <Button type="button" size="sm" variant="secondary" onClick={() => setGroup("all")}>{selectedGroup.label}<X className="size-3" aria-hidden /></Button> : null}
        <Button type="button" size="sm" variant="ghost" onClick={clearAppliedFilters}>Limpiar filtros</Button>
      </div> : null}

      <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
        <h2 id="history-exercise-list-title" className="font-medium text-foreground">{query || hasActiveFilters ? "Resultados" : "Por ejercicio"}</h2>
        <span className="text-xs">{visibleItems.length} {visibleItems.length === 1 ? "ejercicio" : "ejercicios"}</span>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Todavía no hay ejercicios para revisar.</div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          <p>{query ? `No encontramos “${query.trim()}”.` : "No encontramos ejercicios con esos filtros."}</p>
          <Button type="button" variant="link" className="mt-1 h-auto px-0" onClick={clearSearchAndFilters}>Limpiar filtros</Button>
        </div>
      ) : <ExerciseHistoryRows items={visibleItems} />}

      <FilterSheet
        open={filtersOpen}
        onOpenChange={handleFiltersOpenChange}
        group={draftGroup}
        routine={draftRoutine}
        routines={routines}
        onGroupChange={setDraftGroup}
        onRoutineChange={setDraftRoutine}
        onClear={() => {
          setDraftGroup("all");
          setDraftRoutine("all");
        }}
        onApply={applyFilters}
        count={filterPreviewCount}
      />
    </section>
  );
}
