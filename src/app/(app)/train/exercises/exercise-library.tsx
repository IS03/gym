"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  Archive,
  Check,
  ChevronRight,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exerciseLibrarySummary,
  filterExerciseLibrary,
  type ExerciseLibraryFilter,
  type ExerciseLibraryItem,
} from "@/lib/phase2/exercise-library";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import type { MuscleGroup } from "@/lib/phase2/types";
import type { ExerciseMutationInput } from "@/lib/phase2/exercise-mutation";
import {
  archiveExerciseAction,
  createExerciseAction,
  updateExerciseAction,
} from "../actions";

type FormValues = {
  nombre: string;
  grupo_muscular: MuscleGroup | "";
  series_sugeridas: string;
  reps_sugeridas: string;
  peso_sugerido: string;
  rir_sugerido: string;
  descanso_min_sugerido_segundos: string;
  descanso_max_sugerido_segundos: string;
};

const GROUP_FILTER_OPTIONS: ReadonlyArray<{
  value: ExerciseLibraryFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "none", label: "Sin grupo" },
  ...MUSCLE_GROUP_OPTIONS,
];

function emptyForm(): FormValues {
  return {
    nombre: "",
    grupo_muscular: "",
    series_sugeridas: "",
    reps_sugeridas: "",
    peso_sugerido: "",
    rir_sugerido: "",
    descanso_min_sugerido_segundos: "",
    descanso_max_sugerido_segundos: "",
  };
}

function formFromExercise(exercise: ExerciseLibraryItem): FormValues {
  return {
    nombre: exercise.nombre,
    grupo_muscular: exercise.grupo_muscular ?? "",
    series_sugeridas:
      exercise.series_sugeridas === null ? "" : String(exercise.series_sugeridas),
    reps_sugeridas:
      exercise.reps_sugeridas === null ? "" : String(exercise.reps_sugeridas),
    peso_sugerido:
      exercise.peso_sugerido === null ? "" : String(exercise.peso_sugerido),
    rir_sugerido:
      exercise.rir_sugerido === null ? "" : String(exercise.rir_sugerido),
    descanso_min_sugerido_segundos:
      exercise.descanso_min_sugerido_segundos === null
        ? ""
        : String(exercise.descanso_min_sugerido_segundos),
    descanso_max_sugerido_segundos:
      exercise.descanso_max_sugerido_segundos === null
        ? ""
        : String(exercise.descanso_max_sugerido_segundos),
  };
}

function numberOrNull(raw: string, label: string): number | null {
  const value = raw.trim().replace(",", ".");
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new Error(`${label} debe ser un número igual o mayor a cero.`);
  }
  return number;
}

function mutationFromForm(values: FormValues): ExerciseMutationInput {
  return {
    nombre: values.nombre,
    grupo_muscular: values.grupo_muscular || null,
    series_sugeridas: numberOrNull(values.series_sugeridas, "Series sugeridas"),
    reps_sugeridas: numberOrNull(values.reps_sugeridas, "Repeticiones sugeridas"),
    peso_sugerido: numberOrNull(values.peso_sugerido, "Peso sugerido"),
    rir_sugerido: numberOrNull(values.rir_sugerido, "RIR sugerido"),
    descanso_min_sugerido_segundos: numberOrNull(
      values.descanso_min_sugerido_segundos,
      "Descanso mínimo sugerido",
    ),
    descanso_max_sugerido_segundos: numberOrNull(
      values.descanso_max_sugerido_segundos,
      "Descanso máximo sugerido",
    ),
  };
}

function Sheet({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden lg:items-center lg:p-6">
          <Dialog.Popup className="flex max-h-[min(86dvh,42rem)] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:max-h-[min(80dvh,42rem)] lg:max-w-lg lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]">
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ExerciseForm({
  values,
  onChange,
  pending,
  submitLabel,
}: {
  values: FormValues;
  onChange: (next: FormValues) => void;
  pending: boolean;
  submitLabel: string;
}) {
  return (
    <div className="space-y-4">
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nombre</span>
        <Input
          autoFocus
          value={values.nombre}
          onChange={(event) => onChange({ ...values, nombre: event.target.value })}
          placeholder="Ej: Press banca"
          required
          disabled={pending}
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Grupo muscular</span>
        <select
          value={values.grupo_muscular}
          onChange={(event) =>
            onChange({
              ...values,
              grupo_muscular: event.target.value as MuscleGroup | "",
            })
          }
          disabled={pending}
          className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 lg:text-sm"
        >
          <option value="">Sin grupo</option>
          {MUSCLE_GROUP_OPTIONS.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Valores sugeridos</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Input
            value={values.series_sugeridas}
            onChange={(event) =>
              onChange({ ...values, series_sugeridas: event.target.value })
            }
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Series"
            aria-label="Series sugeridas"
            disabled={pending}
          />
          <Input
            value={values.reps_sugeridas}
            onChange={(event) =>
              onChange({ ...values, reps_sugeridas: event.target.value })
            }
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Reps"
            aria-label="Repeticiones sugeridas"
            disabled={pending}
          />
          <Input
            value={values.peso_sugerido}
            onChange={(event) =>
              onChange({ ...values, peso_sugerido: event.target.value })
            }
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            placeholder="Peso"
            aria-label="Peso sugerido en kg"
            disabled={pending}
          />
          <Input
            value={values.rir_sugerido}
            onChange={(event) =>
              onChange({ ...values, rir_sugerido: event.target.value })
            }
            type="number"
            min={0}
            max={10}
            step={1}
            inputMode="numeric"
            placeholder="RIR"
            aria-label="RIR sugerido"
            disabled={pending}
          />
          <Input
            value={values.descanso_min_sugerido_segundos}
            onChange={(event) =>
              onChange({
                ...values,
                descanso_min_sugerido_segundos: event.target.value,
              })
            }
            type="number"
            min={0}
            max={3600}
            step={1}
            inputMode="numeric"
            placeholder="Desc. mín."
            aria-label="Descanso mínimo sugerido en segundos"
            disabled={pending}
          />
          <Input
            value={values.descanso_max_sugerido_segundos}
            onChange={(event) =>
              onChange({
                ...values,
                descanso_max_sugerido_segundos: event.target.value,
              })
            }
            type="number"
            min={0}
            max={3600}
            step={1}
            inputMode="numeric"
            placeholder="Desc. máx."
            aria-label="Descanso máximo sugerido en segundos"
            disabled={pending}
          />
        </div>
      </fieldset>
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? (submitLabel === "Crear ejercicio" ? "Creando…" : "Guardando…") : submitLabel}
      </Button>
    </div>
  );
}

export function ExerciseLibrary({
  initialExercises,
}: {
  initialExercises: ExerciseLibraryItem[];
}) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<ExerciseLibraryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseLibraryItem | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<ExerciseLibraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const visibleExercises = useMemo(
    () => filterExerciseLibrary(exercises, { query, group }),
    [exercises, group, query],
  );
  const hasFilters = Boolean(query.trim()) || group !== "all";
  const selectedGroup = GROUP_FILTER_OPTIONS.find((option) => option.value === group);

  function openCreate() {
    setError(null);
    setEditing(null);
    setForm(emptyForm());
    setEditorOpen(true);
  }

  function openEdit(exercise: ExerciseLibraryItem) {
    setError(null);
    setEditing(exercise);
    setForm(formFromExercise(exercise));
    setEditorOpen(true);
  }

  function clearFilters() {
    setQuery("");
    setGroup("all");
    setFiltersOpen(false);
  }

  function saveExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setError(null);
    let input: ExerciseMutationInput;
    try {
      input = mutationFromForm(form);
    } catch (validationError) {
      setError(
        validationError instanceof Error
          ? validationError.message
          : "Revisá los valores del ejercicio.",
      );
      return;
    }

    startTransition(async () => {
      const result = editing
        ? await updateExerciseAction(editing.id, input)
        : await createExerciseAction(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setExercises((current) => {
        const next = result.data;
        const withoutCurrent = current.filter((exercise) => exercise.id !== next.id);
        return [...withoutCurrent, next].sort((left, right) =>
          left.nombre.localeCompare(right.nombre, "es-AR"),
        );
      });
      setEditorOpen(false);
      setNotice(editing ? "Cambios guardados" : "Ejercicio creado");
      router.refresh();
    });
  }

  function archive() {
    if (!archiveTarget || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveExerciseAction(archiveTarget.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setExercises((current) =>
        current.filter((exercise) => exercise.id !== archiveTarget.id),
      );
      setArchiveTarget(null);
      setNotice("Ejercicio archivado");
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
          <p className="text-sm text-muted-foreground">Tus ejercicios generales.</p>
        </div>
        <Button type="button" onClick={openCreate} size="sm" className="shrink-0 lg:h-11 lg:px-3">
          <Plus className="size-4" aria-hidden />
          <span className="lg:hidden">Nuevo</span>
          <span className="hidden lg:inline">Nuevo ejercicio</span>
        </Button>
      </div>

      <div className="flex gap-2">
        <label className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 pl-9"
            placeholder="Buscar por nombre..."
            aria-label="Buscar ejercicio"
          />
        </label>
        <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Dialog.Trigger
            type="button"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border bg-background px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          >
            <SlidersHorizontal className="size-4" aria-hidden />Filtros
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
            <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden">
              <Dialog.Popup className="w-full rounded-t-[1.75rem] bg-card p-5 text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full motion-reduce:transition-none">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <Dialog.Title className="text-lg font-semibold">Filtros</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                      Elegí un grupo muscular para acotar la biblioteca.
                    </Dialog.Description>
                  </div>
                  <Dialog.Close
                    className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Cerrar filtros"
                  >
                    <X className="size-4" aria-hidden />
                  </Dialog.Close>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {GROUP_FILTER_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={group === option.value ? "secondary" : "outline"}
                      className="justify-start"
                      onClick={() => setGroup(option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button type="button" variant="outline" onClick={clearFilters}>
                    Limpiar
                  </Button>
                  <Dialog.Close render={<Button type="button" />}>Aplicar</Dialog.Close>
                </div>
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
        <select
          value={group}
          onChange={(event) => setGroup(event.target.value as ExerciseLibraryFilter)}
          className="hidden h-11 min-w-40 rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring lg:block"
          aria-label="Filtrar por grupo muscular"
        >
          {GROUP_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label === "Todos" ? "Grupo: Todos" : option.label}
            </option>
          ))}
        </select>
      </div>

      {group !== "all" ? (
        <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
          <Button type="button" size="sm" variant="secondary" onClick={() => setGroup("all")}>
            {selectedGroup?.label}
            <X className="size-3" aria-hidden />
          </Button>
          {query ? (
            <Button type="button" size="sm" variant="ghost" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          ) : null}
        </div>
      ) : null}

      <section aria-labelledby="exercise-library-list-title" className="space-y-2">
        <div className="flex items-center justify-between gap-3 px-1">
          <h2 id="exercise-library-list-title" className="text-sm font-semibold tracking-tight">
            {hasFilters ? "Resultados" : "Activos"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {visibleExercises.length} {visibleExercises.length === 1 ? "ejercicio" : "ejercicios"}
          </span>
        </div>

        {exercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">Todavía no creaste ejercicios.</p>
            <Button type="button" size="sm" className="mt-3" onClick={openCreate}>
              <Plus className="size-3.5" aria-hidden />Crear ejercicio
            </Button>
          </div>
        ) : visibleExercises.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground">No encontramos ejercicios con esos filtros.</p>
            <Button type="button" variant="link" className="mt-1 h-auto px-0" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
            {visibleExercises.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => openEdit(exercise)}
                className="surface-elevated group flex w-full items-center gap-3 rounded-2xl border bg-card px-4 py-3 text-left outline-none transition-[transform,background-color] duration-150 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99] motion-reduce:transition-none"
                aria-label={`Editar ${exercise.nombre}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{exercise.nombre}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {exerciseLibrarySummary(exercise)}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                  aria-hidden
                />
              </button>
            ))}
          </div>
        )}
      </section>

      <Sheet
        open={editorOpen}
        onOpenChange={(open) => {
          if (!pending) {
            setEditorOpen(open);
            if (!open) setError(null);
          }
        }}
      >
        <header className="relative border-b border-border/70 px-4 pb-4 pt-3 sm:px-5 lg:pt-5">
          <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
          <Dialog.Title className="text-xl font-semibold tracking-tight">
            {editing ? "Editar ejercicio" : "Nuevo ejercicio"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            {editing
              ? "Actualizá los valores generales de este ejercicio."
              : "Agregalo a tu biblioteca para usarlo cuando lo necesites."}
          </Dialog.Description>
          <Dialog.Close
            type="button"
            aria-label="Cerrar formulario de ejercicio"
            disabled={pending}
            className="absolute right-2 top-7 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 lg:right-3 lg:top-3"
          >
            <X className="size-4.5" aria-hidden />
          </Dialog.Close>
        </header>
        <div className="overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
          <form onSubmit={saveExercise} noValidate>
            <ExerciseForm
              values={form}
              onChange={setForm}
              pending={pending}
              submitLabel={editing ? "Guardar cambios" : "Crear ejercicio"}
            />
          </form>
          {editing ? (
            <div className="mt-6 border-t pt-5">
              <p className="text-sm font-medium">Acciones de biblioteca</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Archivar lo oculta de los ejercicios activos; las sesiones y registros anteriores se conservan.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="mt-3 w-full"
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setEditorOpen(false);
                  setArchiveTarget(editing);
                }}
              >
                <Archive className="size-4" aria-hidden />Archivar ejercicio
              </Button>
            </div>
          ) : null}
          {error ? (
            <p className="mt-4 text-sm text-destructive" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
        </div>
      </Sheet>

      <Sheet
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open && !pending) {
            setArchiveTarget(null);
            setError(null);
          }
        }}
      >
        <div className="p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <Archive className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <Dialog.Title className="text-base font-semibold">
                ¿Archivar {archiveTarget?.nombre}?
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Ya no aparecerá entre tus ejercicios activos. Las sesiones y registros históricos existentes se conservan.
              </Dialog.Description>
            </div>
            <Dialog.Close
              type="button"
              aria-label="Cancelar archivado"
              disabled={pending}
              className="-mr-2 -mt-2 flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>
          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert" aria-live="polite">
              {error}
            </p>
          ) : null}
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close render={<Button type="button" variant="outline" disabled={pending} />}>
              Cancelar
            </Dialog.Close>
            <Button type="button" variant="destructive" disabled={pending} onClick={archive}>
              {pending ? "Archivando…" : "Archivar"}
            </Button>
          </div>
        </div>
      </Sheet>

      {notice ? (
        <div
          className="fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-xl border bg-card/95 px-4 py-3 text-sm font-medium shadow-lg backdrop-blur lg:bottom-6 lg:left-auto lg:right-6 lg:mx-0"
          role="status"
          aria-live="polite"
        >
          <Check className="size-4 text-primary" aria-hidden />{notice}
        </div>
      ) : null}
    </div>
  );
}
