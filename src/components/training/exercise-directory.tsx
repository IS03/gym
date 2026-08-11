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
  type ExerciseDirectoryEntry,
} from "@/lib/phase2/exercise-insights";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import type { MuscleGroup } from "@/lib/phase2/types";

const ADJUSTMENT_LABELS = {
  maintain: "Mantener",
  increase_weight: "+ Peso",
  increase_reps: "+ Repeticiones",
  custom: "Personalizado",
};

type RoutineOption = { id: string; nombre: string };
type GroupValue = MuscleGroup | "all";
type RoutineValue = string | "all";

function formatDate(value: string | null) {
  if (!value) return "Sin registros";
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Cordoba",
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function number(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function lastSetLabel(item: ExerciseDirectoryEntry) {
  const set = item.lastSets.find((value) => value.actual_reps !== null || value.actual_weight_kg !== null);
  return set ? `${set.actual_reps ?? "—"} × ${set.actual_weight_kg ?? "—"} kg` : null;
}

function FilterFields({
  group,
  routine,
  routines,
  onGroupChange,
  onRoutineChange,
}: {
  group: GroupValue;
  routine: RoutineValue;
  routines: RoutineOption[];
  onGroupChange: (value: GroupValue) => void;
  onRoutineChange: (value: RoutineValue) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1.5 text-sm font-medium">
        Rutina
        <select
          value={routine}
          onChange={(event) => onRoutineChange(event.target.value)}
          className="h-11 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Todas las activas</option>
          {routines.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
        </select>
      </label>
      <label className="block space-y-1.5 text-sm font-medium">
        Músculo
        <select
          value={group}
          onChange={(event) => onGroupChange(event.target.value as GroupValue)}
          className="h-11 w-full rounded-lg border bg-background px-3 text-sm font-normal outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">Todos los músculos</option>
          {MUSCLE_GROUP_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
    </div>
  );
}

export function ExerciseDirectory({
  items,
  routines,
  mode,
}: {
  items: ExerciseDirectoryEntry[];
  routines: RoutineOption[];
  mode: "progress" | "history";
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<GroupValue>("all");
  const [routine, setRoutine] = useState<RoutineValue>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filtered = useMemo(
    () => sortExerciseDirectory(filterExerciseDirectory(items, { query, muscleGroup: group, routineId: routine }), mode === "progress" ? "recent" : "alpha"),
    [group, items, mode, query, routine],
  );
  const hasActiveFilters = Boolean(query.trim()) || group !== "all" || routine !== "all";
  const visible = mode === "progress" && !hasActiveFilters ? filtered.slice(0, 6) : filtered;
  const selectedRoutine = routines.find((item) => item.id === routine);
  const selectedGroup = MUSCLE_GROUP_OPTIONS.find((item) => item.value === group);
  const clear = () => { setQuery(""); setGroup("all"); setRoutine("all"); };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-9" placeholder="Buscar ejercicio" aria-label="Buscar ejercicio" />
        </label>
        <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Dialog.Trigger className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden">
            <SlidersHorizontal className="size-4" aria-hidden /> Filtros
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
            <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden">
              <Dialog.Popup className="w-full rounded-t-[1.75rem] bg-card p-5 text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div><Dialog.Title className="text-lg font-semibold">Filtros</Dialog.Title><Dialog.Description className="mt-1 text-sm text-muted-foreground">Encontrá ejercicios que hoy forman parte de una rutina.</Dialog.Description></div>
                  <Dialog.Close className="rounded-md p-1.5 outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" /><span className="sr-only">Cerrar filtros</span></Dialog.Close>
                </div>
                <FilterFields group={group} routine={routine} routines={routines} onGroupChange={setGroup} onRoutineChange={setRoutine} />
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline" onClick={clear}>Limpiar</Button>
                  <Dialog.Close render={<Button type="button" />}>Aplicar</Dialog.Close>
                </div>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
        <div className="hidden items-center gap-2 lg:flex">
          <select value={routine} onChange={(event) => setRoutine(event.target.value)} className="h-11 min-w-36 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Filtrar por rutina">
            <option value="all">Todas las rutinas</option>{routines.map((item) => <option key={item.id} value={item.id}>{item.nombre}</option>)}
          </select>
          <select value={group} onChange={(event) => setGroup(event.target.value as GroupValue)} className="h-11 min-w-32 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Filtrar por músculo">
            <option value="all">Todos los músculos</option>{MUSCLE_GROUP_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>

      {(selectedRoutine || selectedGroup) && <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
        {selectedRoutine && <Button size="sm" variant="secondary" onClick={() => setRoutine("all")}>{selectedRoutine.nombre}<X className="ml-1 size-3" aria-hidden /></Button>}
        {selectedGroup && <Button size="sm" variant="secondary" onClick={() => setGroup("all")}>{selectedGroup.label}<X className="ml-1 size-3" aria-hidden /></Button>}
        <Button size="sm" variant="ghost" onClick={clear}>Limpiar</Button>
      </div>}

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{mode === "progress" && !hasActiveFilters ? `${visible.length} ejercicios recientes` : `${filtered.length} ${filtered.length === 1 ? "ejercicio" : "ejercicios"}`}</span>
        {mode === "progress" && !hasActiveFilters && items.length > visible.length && <Link href="/train/history" className="font-medium text-primary hover:underline">Ver todos</Link>}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
          {hasActiveFilters ? <><p>No encontramos ejercicios con estos filtros.</p><Button type="button" variant="link" className="mt-1 h-auto px-0" onClick={clear}>Limpiar filtros</Button></> : "Todavía no hay ejercicios para mostrar."}
        </div>
      ) : (
        <div className={mode === "history" ? "space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0" : "space-y-2"}>
          {visible.map((item) => {
            const last = lastSetLabel(item);
            return (
              <Link key={item.id} href={`/train/history/${item.id}?from=${mode}`} className="surface-elevated group block rounded-2xl border bg-card px-4 py-3 outline-none transition-[transform,background-color] duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] motion-reduce:transition-none">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-sm font-semibold">{item.name}</p><ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden /></div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.muscleLabel ?? item.muscleGroup ?? "Sin grupo"} · {item.lastDate ? `última ${formatDate(item.lastDate)}` : "sin registros"}</p>
                    {mode === "progress" ? <>
                      <p className="mt-2 text-xs text-muted-foreground"><span className="metric-number font-medium text-foreground">{item.bestWeightKg === null ? "—" : `${number(item.bestWeightKg)} kg`}</span> mejor · {item.sessions} {item.sessions === 1 ? "sesión" : "sesiones"} · <span className="metric-number">{number(item.totalVolumeKg)} kg</span></p>
                      {(last || item.lastDecision) && <p className="mt-1 text-xs text-muted-foreground">{last ? `Últimas: ${last}` : "Sin series registradas"}{item.lastDecision ? ` · Próxima: ${ADJUSTMENT_LABELS[item.lastDecision]}` : ""}</p>}
                    </> : <div className="mt-2 flex gap-3 text-[11px] text-muted-foreground">{last ? <span className="metric-number text-primary">Último: {last}</span> : <span>Sin registros</span>}<span>Mejor: {item.bestWeightKg === null ? "—" : `${number(item.bestWeightKg)} kg`}</span></div>}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
