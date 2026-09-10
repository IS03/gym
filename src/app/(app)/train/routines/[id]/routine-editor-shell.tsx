"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ArrowLeft, ChevronDown, Dumbbell, Pencil, Play, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { RoutineRestoreButton } from "../routine-restore-button";
import { RoutineArchiveButton } from "../routine-archive-button";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import type { Exercise, Routine, RoutineExerciseTemplate } from "@/lib/phase2/types";
import { RoutineExerciseAddDialog } from "./routine-exercise-manager";
import { shouldShowRoutineExerciseSectionAddAction } from "./routine-editor-interaction";
import { RoutineSettingsSheet } from "./routine-settings-sheet";
import { RoutineTemplateEditor } from "./routine-template-editor";

type RoutineExercisePickerItem = Pick<
  Exercise,
  "id" | "nombre" | "grupo_muscular" | "muscle_group_label" | "implement" | "weight_mode"
>;

export function RoutineEditorShell({
  routine,
  items,
  exercises,
}: {
  routine: Routine;
  items: RoutineExerciseTemplate[];
  exercises: RoutineExercisePickerItem[];
}) {
  const router = useRouter();
  const [dirtyCount, setDirtyCount] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [requestedExerciseId, setRequestedExerciseId] = useState<string | null>(null);
  const existingExerciseIds = useMemo(() => items.map((item) => item.exercise_id), [items]);
  const setCount = useMemo(
    () => items.reduce((total, item) => total + item.sets.length, 0),
    [items],
  );
  const changesMessage = dirtyCount > 0
    ? `Tenés ${dirtyCount} objetivo${dirtyCount === 1 ? "" : "s"} sin guardar. Guardalos antes de cambiar la estructura o iniciar una sesión.`
    : null;

  function canChangeStructure() {
    return dirtyCount === 0;
  }

  function openSettings() {
    if (!canChangeStructure()) return;
    setSettingsOpen(true);
  }

  function openPicker() {
    if (!canChangeStructure()) return;
    setPickerOpen(true);
  }

  function handleExerciseAdded(routineExerciseId: string) {
    setPickerOpen(false);
    setRequestedExerciseId(routineExerciseId);
    router.refresh();
  }

  function leaveRoutine() {
    if (dirtyCount > 0) setLeaveOpen(true);
    else router.push("/train/routines");
  }

  return (
    <div className="space-y-5 pb-8 lg:mx-auto lg:max-w-4xl">
      <header className="space-y-4 border-b border-border/80 pb-5">
        <Button type="button" size="sm" variant="ghost" className="-ml-2 text-muted-foreground" onClick={leaveRoutine}>
          <ArrowLeft className="size-4" aria-hidden />
          Rutinas
        </Button>

        <div className="relative flex items-start gap-3 pl-4">
          <span
            className="absolute inset-y-0 left-0 w-[3px] rounded-full"
            style={{ backgroundColor: routineColorCssVariable(routine.color) }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight lg:text-3xl">{routine.nombre}</h1>
              {!routine.is_active ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">Archivada</span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length} ejercicio{items.length === 1 ? "" : "s"} · {setCount} serie{setCount === 1 ? "" : "s"}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="-mt-1 shrink-0"
            aria-label="Editar nombre y color de la rutina"
            disabled={!canChangeStructure()}
            onClick={openSettings}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        </div>

        {routine.is_active ? (
          canChangeStructure() ? (
            <Link href={`/train/session/new?routine_id=${routine.id}`} className={cn(buttonVariants(), "w-full")}>
              <Play className="size-4" aria-hidden />
              Iniciar entrenamiento
            </Link>
          ) : (
            <Button type="button" className="w-full" disabled aria-describedby="routine-dirty-status">
              <Play className="size-4" aria-hidden />
              Iniciar entrenamiento
            </Button>
          )
        ) : null}

        {changesMessage ? (
          <p id="routine-dirty-status" className="text-xs text-amber-700 dark:text-amber-300" aria-live="polite">
            {changesMessage}
          </p>
        ) : null}
      </header>

      {!routine.is_active ? (
        <section className="border border-amber-500/25 bg-amber-500/[0.04] px-4 py-4" aria-labelledby="archived-routine-title">
          <h2 id="archived-routine-title" className="text-base font-semibold">Rutina archivada</h2>
          <p className="mt-1 text-sm text-muted-foreground">Podés revisar y editar su estructura. Restaurala para volver a iniciarla.</p>
          <div className="mt-3"><RoutineRestoreButton routineId={routine.id} routineName={routine.nombre} /></div>
        </section>
      ) : null}

      <section className="space-y-3" aria-labelledby="routine-exercises-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="routine-exercises-title" className="text-lg font-semibold tracking-tight">Ejercicios</h2>
          {items.length > 0 ? <span className="text-xs text-muted-foreground">Abrí uno para editarlo</span> : null}
        </div>

        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-8 text-center">
            <Dumbbell className="mx-auto size-5 text-primary" aria-hidden />
            <h3 className="mt-3 text-base font-semibold">Todavía no tiene ejercicios</h3>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">Agregá el primero para empezar a armar esta rutina.</p>
            <Button type="button" className="mt-4 h-11" onClick={openPicker}><Plus className="size-4" aria-hidden />Agregar ejercicio</Button>
          </div>
        ) : (
          <RoutineTemplateEditor
            routineId={routine.id}
            routineColor={routine.color}
            items={items}
            initialExpandedExerciseId={requestedExerciseId}
            onDirtyChange={setDirtyCount}
          />
        )}

        {shouldShowRoutineExerciseSectionAddAction(items.length) ? (
          <div className="flex justify-center pt-1">
            <Button type="button" size="sm" variant="outline" disabled={!canChangeStructure()} onClick={openPicker} aria-describedby={dirtyCount > 0 ? "routine-dirty-status" : undefined}>
              <Plus className="size-4" aria-hidden />
              Agregar ejercicio
            </Button>
          </div>
        ) : null}
      </section>

      {routine.is_active ? (
        <details className="group border-t border-border/80 pt-2">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
            Opciones de rutina
            <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
          </summary>
          <div className="flex flex-col items-stretch gap-3 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              Archivarla la quita de tus rutinas activas sin modificar su historial.
            </p>
            <RoutineArchiveButton
              routineId={routine.id}
              routineName={routine.nombre}
              trigger="secondary"
              disabled={!canChangeStructure()}
              onArchived={() => router.push("/train/routines")}
            />
          </div>
        </details>
      ) : null}

      <RoutineSettingsSheet
        routine={routine}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onUpdated={() => router.refresh()}
      />
      <RoutineExerciseAddDialog
        routineId={routine.id}
        exercises={exercises}
        existingExerciseIds={existingExerciseIds}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onAdded={handleExerciseAdded}
      />

      <Dialog.Root open={leaveOpen} onOpenChange={setLeaveOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[90] bg-black/45 backdrop-blur-[2px]" />
          <Dialog.Viewport className="fixed inset-0 z-[91] flex items-end justify-center sm:items-center sm:p-6">
            <Dialog.Popup className="w-full rounded-t-[1.5rem] bg-card p-5 text-card-foreground shadow-2xl outline-none sm:max-w-sm sm:rounded-2xl sm:border">
              <Dialog.Title className="text-base font-semibold">Tenés cambios sin guardar</Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">Volver ahora descarta esos objetivos locales. Las sesiones anteriores no se modifican.</Dialog.Description>
              <div className="mt-5 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setLeaveOpen(false)}>Seguir editando</Button>
                <Button type="button" variant="destructive" onClick={() => router.push("/train/routines")}>Salir sin guardar</Button>
              </div>
            </Dialog.Popup>
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
