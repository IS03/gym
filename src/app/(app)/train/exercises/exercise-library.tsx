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
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  exerciseLibrarySummary,
  filterExerciseLibrary,
  groupExerciseLibrary,
  sortExerciseLibrary,
  type ExerciseLibraryFilter,
  type ExerciseLibraryItem,
} from "@/lib/phase2/exercise-library";
import { MUSCLE_GROUP_OPTIONS } from "@/lib/phase2/muscle-groups";
import type { MuscleGroup } from "@/lib/phase2/types";
import {
  EXERCISE_IMPLEMENT_SUGGESTIONS,
  EXERCISE_WEIGHT_MODE_SUGGESTIONS,
  type ExerciseMutationInput,
} from "@/lib/phase2/exercise-mutation";
import {
  emptyForm,
  formFromExercise,
  mutationFromForm,
  type ExerciseFormValues as FormValues,
} from "@/lib/phase2/exercise-form";
import {
  archiveExerciseAction,
  createExerciseAction,
  updateExerciseAction,
} from "../actions";

const GROUP_FILTER_OPTIONS: ReadonlyArray<{
  value: ExerciseLibraryFilter;
  label: string;
}> = [
  { value: "all", label: "Todos" },
  { value: "none", label: "Sin grupo" },
  ...MUSCLE_GROUP_OPTIONS,
];

function Sheet({
  children,
  open,
  onOpenChange,
  variant = "default",
  initialFocus,
}: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variant?: "default" | "editor";
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  const editorSheet = variant === "editor";

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 opacity-100 backdrop-blur-[2px] transition-opacity duration-200 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none" />
        <Dialog.Viewport
          className={
            editorSheet
              ? "fixed inset-0 z-[81] flex items-end justify-center overflow-hidden px-2 pt-[max(0.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6"
              : "fixed inset-0 z-[81] flex items-end justify-center overflow-hidden lg:items-center lg:p-6"
          }
        >
          <Dialog.Popup
            initialFocus={initialFocus}
            className={
              editorSheet
                ? "flex h-[min(82svh,42rem)] min-h-0 w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:h-[min(78dvh,42rem)] lg:max-w-lg lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]"
                : "flex max-h-[min(86dvh,42rem)] w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] duration-200 ease-out data-[ending-style]:translate-y-full data-[ending-style]:opacity-95 data-[starting-style]:translate-y-full data-[starting-style]:opacity-95 motion-reduce:transition-none lg:max-h-[min(80dvh,42rem)] lg:max-w-lg lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[ending-style]:scale-[0.98] lg:data-[starting-style]:translate-y-2 lg:data-[starting-style]:scale-[0.98]"
            }
          >
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
            type="text"
            min={0}
            inputMode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
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
            placeholder="Desc. mín. (s)"
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
            placeholder="Desc. máx. (s)"
            aria-label="Descanso máximo sugerido en segundos"
            disabled={pending}
          />
        </div>
        <p className="text-xs text-muted-foreground">Segundos totales.</p>
      </fieldset>
      <fieldset className="space-y-2 rounded-xl border border-border/70 bg-muted/25 p-3">
        <legend className="px-1 text-sm font-medium">Detalles</legend>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Detalle muscular</span>
          <Input
            value={values.muscle_group_label}
            onChange={(event) => onChange({ ...values, muscle_group_label: event.target.value })}
            placeholder="Ej: Deltoides posteriores"
            maxLength={120}
            disabled={pending}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Implemento</span>
            <Input
              value={values.implement}
              onChange={(event) => onChange({ ...values, implement: event.target.value })}
              placeholder="Ej: Polea"
              list="exercise-implement-suggestions"
              maxLength={120}
              disabled={pending}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Registro de carga</span>
            <Input
              value={values.weight_mode}
              onChange={(event) => onChange({ ...values, weight_mode: event.target.value })}
              placeholder="Ej: Peso total"
              list="exercise-weight-mode-suggestions"
              maxLength={120}
              disabled={pending}
            />
          </label>
        </div>
        <datalist id="exercise-implement-suggestions">
          {EXERCISE_IMPLEMENT_SUGGESTIONS.map((value) => <option key={value} value={value} />)}
        </datalist>
        <datalist id="exercise-weight-mode-suggestions">
          {EXERCISE_WEIGHT_MODE_SUGGESTIONS.map((value) => <option key={value} value={value} />)}
        </datalist>
      </fieldset>
      <Button className="h-11 w-full" type="submit" disabled={pending}>
        {pending ? (submitLabel === "Crear ejercicio" ? "Creando…" : "Guardando…") : submitLabel}
      </Button>
    </div>
  );
}

function ExerciseRows({
  exercises,
  onEdit,
}: {
  exercises: ExerciseLibraryItem[];
  onEdit: (exercise: ExerciseLibraryItem) => void;
}) {
  return (
    <div className="divide-y divide-border/70">
      {exercises.map((exercise) => (
        <button
          key={exercise.id}
          type="button"
          onClick={() => onEdit(exercise)}
          className="group flex min-h-14 w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-[background-color,transform] duration-150 hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:scale-[0.995] motion-reduce:transition-none"
          aria-label={`Editar ${exercise.nombre}`}
        >
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 block text-sm font-semibold leading-5">{exercise.nombre}</span>
            <span className="mt-0.5 block truncate text-xs leading-4 text-muted-foreground">
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
  const [draftGroup, setDraftGroup] = useState<ExerciseLibraryFilter>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseLibraryItem | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [archiveTarget, setArchiveTarget] = useState<ExerciseLibraryItem | null>(null);
  const editorCloseRef = useRef<HTMLButtonElement>(null);
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
  const groupedExercises = useMemo(
    () => groupExerciseLibrary(visibleExercises),
    [visibleExercises],
  );
  const filterPreviewCount = useMemo(
    () => filterExerciseLibrary(exercises, { query, group: draftGroup }).length,
    [draftGroup, exercises, query],
  );
  const hasFilters = Boolean(query.trim()) || group !== "all";
  const showGroups = !query.trim() && group === "all";
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
    setDraftGroup("all");
    setFiltersOpen(false);
  }

  function handleFiltersOpenChange(open: boolean) {
    if (open) setDraftGroup(group);
    setFiltersOpen(open);
  }

  function applyGroupFilter() {
    setGroup(draftGroup);
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
    <div className="space-y-5 lg:mx-auto lg:max-w-3xl">
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
            className="h-11 pr-10 pl-9"
            placeholder="Buscar ejercicio"
            aria-label="Buscar ejercicio"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </label>
        <button
          type="button"
          onClick={() => handleFiltersOpenChange(true)}
          className="relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg border bg-background text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
          aria-label={
            group === "all"
              ? "Filtrar ejercicios"
              : `Filtrar ejercicios. Filtro activo: ${selectedGroup?.label}`
          }
          aria-haspopup="dialog"
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          {group !== "all" ? (
            <span
              className="absolute right-1.5 top-1.5 size-2 rounded-full bg-primary ring-2 ring-background"
              aria-hidden
            />
          ) : null}
        </button>
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
          <h2 id="exercise-library-list-title" className="sr-only">
            Biblioteca de ejercicios
          </h2>
          <span className="text-sm text-muted-foreground">
            {hasFilters ? "Resultados" : "Ejercicios activos"}
          </span>
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
            <p className="text-sm text-muted-foreground">
              {query ? `No encontramos “${query.trim()}”.` : "No encontramos ejercicios con ese filtro."}
            </p>
            <Button type="button" variant="link" className="mt-1 h-auto px-0" onClick={clearFilters}>
              Limpiar filtros
            </Button>
          </div>
        ) : showGroups ? (
          <div className="overflow-hidden rounded-xl border bg-card">
            {groupedExercises.map((section) => (
              <section key={section.value} aria-labelledby={`exercise-group-${section.value}`}>
                <h3
                  id={`exercise-group-${section.value}`}
                  className="border-y border-border/70 bg-muted/35 px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground first:border-t-0"
                >
                  {section.label}
                </h3>
                <ExerciseRows exercises={section.exercises} onEdit={openEdit} />
              </section>
            ))}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <ExerciseRows exercises={sortExerciseLibrary(visibleExercises)} onEdit={openEdit} />
          </div>
        )}
      </section>

      <Sheet open={filtersOpen} onOpenChange={handleFiltersOpenChange}>
        <header className="relative border-b border-border/70 px-4 pb-3 pt-3 sm:px-5 lg:pt-5">
          <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
          <Dialog.Title className="text-lg font-semibold">Filtrar ejercicios</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Elegí un grupo muscular para acotar la biblioteca.
          </Dialog.Description>
          <Dialog.Close
            type="button"
            className="absolute right-2 top-3 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring lg:right-3 lg:top-3"
            aria-label="Cerrar filtros"
          >
            <X className="size-4" aria-hidden />
          </Dialog.Close>
        </header>
        <div className="overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <p className="text-sm font-medium">Grupo muscular</p>
          <div className="mt-3 flex flex-wrap gap-2" aria-label="Grupo muscular">
            {GROUP_FILTER_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={draftGroup === option.value}
                onClick={() => setDraftGroup(option.value)}
                className={`min-h-9 rounded-full border px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${
                  draftGroup === option.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-foreground hover:bg-muted"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-border/70 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-5 lg:pb-3">
          {draftGroup !== "all" ? (
            <Button type="button" variant="ghost" onClick={() => setDraftGroup("all")}>
              Limpiar
            </Button>
          ) : (
            <span aria-hidden />
          )}
          <Button type="button" onClick={applyGroupFilter}>
            Ver {filterPreviewCount} {filterPreviewCount === 1 ? "ejercicio" : "ejercicios"}
          </Button>
        </footer>
      </Sheet>

      <Sheet
        open={editorOpen}
        variant="editor"
        initialFocus={editorCloseRef}
        onOpenChange={(open) => {
          if (!pending) {
            setEditorOpen(open);
            if (!open) setError(null);
          }
        }}
      >
        <header className="relative shrink-0 border-b border-border/70 px-4 pb-4 pt-3 sm:px-5 lg:pt-5">
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
            ref={editorCloseRef}
            type="button"
            aria-label="Cerrar formulario de ejercicio"
            disabled={pending}
            className="absolute right-2 top-7 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none transition-[background-color,color,transform] hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-95 lg:right-3 lg:top-3"
          >
            <X className="size-4.5" aria-hidden />
          </Dialog.Close>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 [-webkit-overflow-scrolling:touch] sm:px-5">
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
