"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Check, ChevronDown, ChevronRight, Dumbbell, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exerciseIdentityLabel } from "@/lib/phase2/exercise-library";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import {
  DEFAULT_TRAINING_HISTORY_FILTERS,
  filterTrainingHistoryExercises,
  formatTrainingHistoryMark,
  selectTrainingHistoryExercises,
  toggleTrainingHistoryFilter,
  trainingHistoryFilterCount,
  trainingHistoryListPath,
  type TrainingHistoryExercise,
  type TrainingHistoryFilters,
  type TrainingHistoryOrder,
  type TrainingHistoryRoutine,
} from "@/lib/phase2/training-history";
import type { MuscleGroup } from "@/lib/phase2/types";

const ORDER_OPTIONS: ReadonlyArray<{ value: TrainingHistoryOrder; label: string }> = [
  { value: "recent", label: "Más recientes" },
  { value: "used", label: "Más usados" },
  { value: "alpha", label: "Nombre A–Z" },
  { value: "stale", label: "Más tiempo sin realizar" },
];

function FilterSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 border-b border-border/70 pb-5 last:border-b-0 last:pb-0">
      <legend className="font-semibold">{title}</legend>
      <p className="-mt-2 text-xs text-muted-foreground">{description}</p>
      {children}
    </fieldset>
  );
}

function SelectableRow({ selected, onClick, children, leading }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary/35 bg-primary/10" : "border-border bg-background hover:bg-muted/55"}`}
    >
      {leading}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`} aria-hidden>
        {selected ? <Check className="size-3.5" /> : null}
      </span>
    </button>
  );
}

function ActivitySegmented({ value, onChange }: {
  value: TrainingHistoryFilters["activity"];
  onChange: (value: TrainingHistoryFilters["activity"]) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-muted/45 p-1" role="radiogroup" aria-label="Actividad del ejercicio">
      {([{ value: "recorded", label: "Con registros" }, { value: "all", label: "Todos" }] as const).map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-10 rounded-lg px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-background text-primary shadow-sm ring-1 ring-primary/15" : "text-muted-foreground hover:text-foreground"}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterSheet({
  open,
  onOpenChange,
  filters,
  routines,
  count,
  onChange,
  onClear,
  onApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: TrainingHistoryFilters;
  routines: TrainingHistoryRoutine[];
  count: number;
  onChange: (filters: TrainingHistoryFilters) => void;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden lg:items-center lg:p-6">
          <Dialog.Popup className="flex max-h-[min(86svh,46rem)] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none lg:max-w-lg lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[starting-style]:translate-y-2">
            <header className="shrink-0 border-b border-border/70 px-4 pb-4 pt-3 sm:px-5 lg:pt-5">
              <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
              <div className="flex items-center gap-2">
                <Dialog.Title className="min-w-0 flex-1 text-xl font-semibold tracking-tight">Filtrar ejercicios</Dialog.Title>
                <div className="flex shrink-0 items-center gap-1">
                  <button type="button" onClick={onClear} aria-label="Limpiar filtros" className="flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-primary outline-none transition-colors hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">Limpiar</button>
                  <Dialog.Close type="button" className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Cerrar filtros">
                    <X className="size-5" aria-hidden />
                  </Dialog.Close>
                </div>
              </div>
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">Elegí varios filtros y combinalos.</Dialog.Description>
            </header>

            <div data-testid="history-filter-sheet-content" className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              <FilterSection title="Rutinas" description="No seleccionar ninguna muestra todas las rutinas.">
                {routines.length ? (
                  <div className="grid grid-cols-2 gap-2" aria-label="Filtrar por rutinas">
                    {routines.map((routine) => {
                      const selected = filters.routineIds.includes(routine.id);
                      return (
                        <SelectableRow
                          key={routine.id}
                          selected={selected}
                          onClick={() => onChange({ ...filters, routineIds: toggleTrainingHistoryFilter(filters.routineIds, routine.id) })}
                          leading={<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: routineColorCssVariable(routine.color) }} aria-hidden />}
                        >
                          {routine.name}
                        </SelectableRow>
                      );
                    })}
                  </div>
                ) : <p className="text-sm text-muted-foreground">No hay rutinas activas.</p>}
              </FilterSection>

              <FilterSection title="Grupo muscular" description="Seleccioná uno o más grupos musculares.">
                <div className="grid grid-cols-2 gap-2" aria-label="Filtrar por grupo muscular">
                  {MUSCLE_GROUP_OPTIONS.map((group) => (
                    <SelectableRow key={group.value} selected={filters.muscleGroups.includes(group.value)} onClick={() => onChange({ ...filters, muscleGroups: toggleTrainingHistoryFilter(filters.muscleGroups, group.value) })}>{group.label}</SelectableRow>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Actividad" description="Muestra ejercicios con o sin registros.">
                <ActivitySegmented value={filters.activity} onChange={(activity) => onChange({ ...filters, activity })} />
              </FilterSection>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:pb-3">
              <span className="text-sm text-muted-foreground">{count} {count === 1 ? "resultado" : "resultados"}</span>
              <Button type="button" className="min-w-36" onClick={onApply}>Ver ejercicios</Button>
            </footer>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExerciseHistoryRows({ items, returnHref }: { items: TrainingHistoryExercise[]; returnHref: string }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      {items.map((item) => {
        const params = new URLSearchParams({ from: "history", return: returnHref });
        return (
          <Link key={item.id} href={`/train/history/${item.id}?${params.toString()}`} className="group flex min-h-[84px] items-center gap-3 border-b border-border/70 px-3 py-2.5 outline-none transition-[background-color,transform] duration-150 last:border-b-0 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.995]" aria-label={`Abrir historial de ${item.name}`}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Dumbbell className="size-4" aria-hidden /></span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-5">{item.name}</span>
              <span className="block truncate text-xs leading-4 text-muted-foreground">{exerciseIdentityLabel({ grupo_muscular: item.muscleGroup, muscle_group_label: item.muscleLabel, implement: item.implement, weight_mode: item.weightMode })}</span>
              <span className="mt-1.5 grid grid-cols-2 divide-x text-xs leading-4">
                <span className="min-w-0 pr-3"><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Último</span><span className="metric-number block truncate font-medium">{formatTrainingHistoryMark(item.lastMark)}</span></span>
                <span className="min-w-0 pl-3"><span className="block text-[10px] uppercase tracking-wide text-muted-foreground">Mejor</span><span className="metric-number block truncate font-medium">{formatTrainingHistoryMark(item.bestMark)}</span></span>
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}

export function HistoryExerciseList({ exercises, routines, initialFilters = DEFAULT_TRAINING_HISTORY_FILTERS }: {
  exercises: TrainingHistoryExercise[];
  routines: TrainingHistoryRoutine[];
  initialFilters?: TrainingHistoryFilters;
}) {
  const [filters, setFilters] = useState<TrainingHistoryFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<TrainingHistoryFilters>(initialFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const visibleItems = useMemo(() => selectTrainingHistoryExercises(exercises, filters), [exercises, filters]);
  const draftCount = useMemo(() => filterTrainingHistoryExercises(exercises, { ...draftFilters, query: filters.query }).length, [draftFilters, exercises, filters.query]);
  const activeFilterCount = trainingHistoryFilterCount(filters);
  const returnHref = trainingHistoryListPath(filters);
  const orderLabel = ORDER_OPTIONS.find((option) => option.value === filters.order)?.label ?? "Más recientes";

  function openFilters() {
    setDraftFilters({ ...filters, routineIds: [...filters.routineIds], muscleGroups: [...filters.muscleGroups] });
    setFiltersOpen(true);
  }

  function removeRoutine(id: string) {
    setFilters((current) => ({ ...current, routineIds: current.routineIds.filter((item) => item !== id) }));
  }

  function removeMuscle(group: MuscleGroup) {
    setFilters((current) => ({ ...current, muscleGroups: current.muscleGroups.filter((item) => item !== group) }));
  }

  return (
    <section aria-labelledby="history-exercise-list-title" className="space-y-3 lg:mx-auto lg:max-w-4xl">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={filters.query} onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))} className="h-11 pr-10 pl-9" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" />
          {filters.query ? <button type="button" onClick={() => setFilters((current) => ({ ...current, query: "" }))} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring" aria-label="Limpiar búsqueda"><X className="size-4" aria-hidden /></button> : null}
        </label>
        <Button type="button" variant="outline" className="h-11 shrink-0 px-3 text-primary" onClick={openFilters} aria-haspopup="dialog">
          <SlidersHorizontal className="size-4" aria-hidden />
          <span>Filtrar{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}</span>
        </Button>
      </div>

      {activeFilterCount > 0 ? (
        <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
          {filters.routineIds.map((id) => {
            const routine = routines.find((item) => item.id === id);
            return routine ? <Button key={id} type="button" size="sm" variant="secondary" className="rounded-full text-primary" onClick={() => removeRoutine(id)}>{routine.name}<X className="size-3" aria-hidden /></Button> : null;
          })}
          {filters.muscleGroups.map((group) => {
            const option = MUSCLE_GROUP_OPTIONS.find((item) => item.value === group);
            return option ? <Button key={group} type="button" size="sm" variant="secondary" className="rounded-full text-primary" onClick={() => removeMuscle(group)}>{option.label}<X className="size-3" aria-hidden /></Button> : null;
          })}
          {filters.activity === "all" ? <Button type="button" size="sm" variant="secondary" className="rounded-full text-primary" onClick={() => setFilters((current) => ({ ...current, activity: "recorded" }))}>Todos<X className="size-3" aria-hidden /></Button> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 px-1">
        <h2 id="history-exercise-list-title" className="text-base font-semibold tracking-tight">{visibleItems.length} {visibleItems.length === 1 ? "ejercicio" : "ejercicios"}{filters.activity === "recorded" ? " con historial" : ""}</h2>
        <label className="relative flex h-9 shrink-0 cursor-pointer items-center rounded-lg px-2 text-xs font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-within:ring-2 focus-within:ring-ring">
          <span className="flex items-center gap-1">{orderLabel}<ChevronDown className="size-3.5" aria-hidden /></span>
          <select
            value={filters.order}
            onChange={(event) => setFilters((current) => ({ ...current, order: event.target.value as TrainingHistoryOrder }))}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
            aria-label="Ordenar ejercicios"
          >
            {ORDER_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
      </div>

      {visibleItems.length === 0 ? (
        <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          <p>{filters.query ? `No encontramos “${filters.query.trim()}”.` : "No encontramos ejercicios con esos filtros."}</p>
          <Button type="button" variant="link" className="mt-1 h-auto px-0" onClick={() => setFilters(DEFAULT_TRAINING_HISTORY_FILTERS)}>Volver al historial</Button>
        </div>
      ) : <ExerciseHistoryRows items={visibleItems} returnHref={returnHref} />}

      <FilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={draftFilters}
        routines={routines}
        count={draftCount}
        onChange={setDraftFilters}
        onClear={() => setDraftFilters({
          ...DEFAULT_TRAINING_HISTORY_FILTERS,
          query: filters.query,
          order: filters.order,
        })}
        onApply={() => {
          setFilters({ ...draftFilters, query: filters.query });
          setFiltersOpen(false);
        }}
      />
    </section>
  );
}
