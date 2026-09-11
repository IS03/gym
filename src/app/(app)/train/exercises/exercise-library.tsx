"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Archive, Check, ChevronDown, ChevronRight, Dumbbell, Plus, RotateCcw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_EXERCISE_LIBRARY_FILTERS,
  exerciseLibraryActiveFilterCount,
  exerciseLibraryImplementOptions,
  exerciseLibrarySummary,
  filterExerciseLibrary,
  groupExerciseLibrary,
  sortExerciseLibrary,
  type ExerciseLibraryFilters,
  type ExerciseLibraryGroup,
  type ExerciseLibraryItem,
  type ExerciseLibraryRoutine,
  type ExerciseLibraryStatus,
} from "@/lib/phase2/exercise-library";
import { MUSCLE_GROUP_OPTIONS, muscleGroupLabel } from "@/lib/phase2/muscle-groups";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import type { MuscleGroup } from "@/lib/phase2/types";
import { EXERCISE_IMPLEMENT_SUGGESTIONS, EXERCISE_WEIGHT_MODE_SUGGESTIONS, type ExerciseMutationInput } from "@/lib/phase2/exercise-mutation";
import { emptyForm, formFromExercise, mutationFromForm, type ExerciseFormValues as FormValues } from "@/lib/phase2/exercise-form";
import { archiveExerciseAction, createExerciseAction, restoreExerciseAction, updateExerciseAction } from "../actions";

const GROUP_OPTIONS: ReadonlyArray<{ value: ExerciseLibraryGroup; label: string }> = MUSCLE_GROUP_OPTIONS;
type RoutineUsage = "any" | "assigned" | "unassigned";

function cloneFilters(filters: ExerciseLibraryFilters): ExerciseLibraryFilters {
  return { ...filters, routineIds: [...filters.routineIds], muscleGroups: [...filters.muscleGroups], implements: [...filters.implements] };
}

function toggleValue<T>(values: readonly T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function routineUsageFromFilters(filters: ExerciseLibraryFilters): RoutineUsage {
  if (filters.withoutRoutine) return "unassigned";
  if (filters.withRoutine || filters.routineIds.length > 0) return "assigned";
  return "any";
}

function implementSelectionSummary(values: readonly string[]): string {
  if (values.length === 0) return "Todos";
  if (values.length <= 2) return values.join(", ");
  return `${values.length} seleccionados`;
}

function Sheet({ children, open, onOpenChange, large = false, initialFocus }: {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  large?: boolean;
  initialFocus?: React.RefObject<HTMLElement | null>;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-[2px] transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Viewport className="fixed inset-0 z-[81] flex items-end justify-center overflow-hidden px-0 pt-[max(.75rem,env(safe-area-inset-top))] lg:items-center lg:p-6">
          <Dialog.Popup
            initialFocus={initialFocus}
            className={`${large ? "h-[min(92dvh,52rem)]" : "max-h-[min(88dvh,46rem)]"} flex min-h-0 w-full flex-col overflow-hidden rounded-t-[1.75rem] bg-card text-card-foreground shadow-2xl outline-none transition-[transform,opacity] data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full lg:max-w-2xl lg:rounded-2xl lg:border lg:data-[ending-style]:translate-y-2 lg:data-[starting-style]:translate-y-2`}
          >
            {children}
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SheetHeader({ title, description, closeLabel, closeRef, pending, action, inlineActions = false }: {
  title: string;
  description: string;
  closeLabel: string;
  closeRef?: React.RefObject<HTMLButtonElement | null>;
  pending?: boolean;
  action?: React.ReactNode;
  inlineActions?: boolean;
}) {
  if (!inlineActions) return (
    <header className="relative shrink-0 border-b border-border/70 px-4 pb-4 pt-3 sm:px-5">
      <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
      <Dialog.Title className="text-xl font-semibold tracking-tight">{title}</Dialog.Title>
      <Dialog.Description className="mt-1 pr-12 text-sm text-muted-foreground">{description}</Dialog.Description>
      {action ? <div className="absolute right-12 top-5">{action}</div> : null}
      <Dialog.Close ref={closeRef} type="button" disabled={pending} aria-label={closeLabel}
        className="absolute right-2 top-4 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
        <X className="size-5" aria-hidden />
      </Dialog.Close>
    </header>
  );
  return (
    <header className="shrink-0 border-b border-border/70 px-4 pb-4 pt-3 sm:px-5">
      <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" aria-hidden />
      <div className="flex items-center gap-2">
        <Dialog.Title className="min-w-0 flex-1 text-xl font-semibold tracking-tight">{title}</Dialog.Title>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          <Dialog.Close ref={closeRef} type="button" disabled={pending} aria-label={closeLabel}
            className="flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
            <X className="size-5" aria-hidden />
          </Dialog.Close>
        </div>
      </div>
      <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>
    </header>
  );
}

function SectionTitle({ number, title, subtitle }: { number: number; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{number}</span>
      <div><h3 className="font-semibold">{title}</h3><p className="text-xs text-muted-foreground">{subtitle}</p></div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1.5"><span className="text-xs font-medium text-muted-foreground">{label}</span>{children}</label>;
}

function ExerciseForm({ values, onChange, pending, editing, routines, selectedRoutineIds, onRoutineIdsChange, error, onArchive, onRestore }: {
  values: FormValues;
  onChange: (next: FormValues) => void;
  pending: boolean;
  editing: ExerciseLibraryItem | null;
  routines: ExerciseLibraryRoutine[];
  selectedRoutineIds: string[];
  onRoutineIdsChange: (ids: string[]) => void;
  error: string | null;
  onArchive: () => void;
  onRestore: () => void;
}) {
  const selectClass = "h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:text-sm";
  const unknownImplement = values.implement && !EXERCISE_IMPLEMENT_SUGGESTIONS.includes(values.implement as never);
  const unknownMode = values.weight_mode && !EXERCISE_WEIGHT_MODE_SUGGESTIONS.includes(values.weight_mode as never);
  return (
    <div className="divide-y divide-border/70">
      <section className="space-y-4 pb-5">
        <SectionTitle number={1} title="Información" subtitle="Datos básicos del ejercicio." />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Nombre"><Input value={values.nombre} onChange={(event) => onChange({ ...values, nombre: event.target.value })} placeholder="Ej: Press banca" required disabled={pending} /></Field>
          <Field label="Grupo muscular"><select value={values.grupo_muscular} onChange={(event) => onChange({ ...values, grupo_muscular: event.target.value as MuscleGroup | "" })} disabled={pending} className={selectClass}>
            <option value="">Sin grupo</option>{MUSCLE_GROUP_OPTIONS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select></Field>
        </div>
      </section>

      <section className="space-y-4 py-5">
        <SectionTitle number={2} title="Configuración" subtitle="Definí los detalles del ejercicio." />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Músculo específico"><Input value={values.muscle_group_label} onChange={(event) => onChange({ ...values, muscle_group_label: event.target.value })} placeholder="Ej: Pectoral mayor" maxLength={120} disabled={pending} /></Field>
          <Field label="Implemento"><select value={values.implement} onChange={(event) => onChange({ ...values, implement: event.target.value })} disabled={pending} className={selectClass}>
            <option value="">Sin especificar</option>{unknownImplement ? <option value={values.implement}>{values.implement}</option> : null}{EXERCISE_IMPLEMENT_SUGGESTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></Field>
          <Field label="Registro de carga"><select value={values.weight_mode} onChange={(event) => onChange({ ...values, weight_mode: event.target.value })} disabled={pending} className={selectClass}>
            <option value="">Sin especificar</option>{unknownMode ? <option value={values.weight_mode}>{values.weight_mode}</option> : null}{EXERCISE_WEIGHT_MODE_SUGGESTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select></Field>
        </div>
      </section>

      <section className="space-y-4 py-5">
        <SectionTitle number={3} title="Valores por defecto" subtitle="Se usarán al agregar este ejercicio a una rutina." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ["Series", "series_sugeridas", "numeric", "Ej: 3"], ["Reps", "reps_sugeridas", "numeric", "Ej: 10"],
            ["Peso", "peso_sugerido", "decimal", "Ej: 60"], ["RIR", "rir_sugerido", "numeric", "Ej: 2"],
          ] as const).map(([label, key, mode, placeholder]) => <Field key={key} label={label}><Input value={values[key]} onChange={(event) => onChange({ ...values, [key]: event.target.value })} inputMode={mode} placeholder={placeholder} disabled={pending} /></Field>)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Descanso mínimo"><Input value={values.descanso_min_sugerido_segundos} onChange={(event) => onChange({ ...values, descanso_min_sugerido_segundos: event.target.value })} inputMode="text" placeholder="Ej: 1:30" aria-label="Descanso mínimo en minutos y segundos" disabled={pending} /></Field>
          <Field label="Descanso máximo"><Input value={values.descanso_max_sugerido_segundos} onChange={(event) => onChange({ ...values, descanso_max_sugerido_segundos: event.target.value })} inputMode="text" placeholder="Ej: 2:00" aria-label="Descanso máximo en minutos y segundos" disabled={pending} /></Field>
        </div>
      </section>

      <section className="space-y-4 py-5">
        <SectionTitle number={4} title={editing ? "Usado en rutinas" : "Agregar a rutina (opcional)"} subtitle={editing ? "Gestioná dónde se utiliza actualmente." : "Seleccioná una rutina para tenerlo más a mano."} />
        <div className="flex flex-wrap gap-2" aria-label={editing ? "Uso en rutinas" : "Agregar a rutina"}>
          {!editing ? <button type="button" aria-pressed={selectedRoutineIds.length === 0} onClick={() => onRoutineIdsChange([])} className={`min-h-10 rounded-full border px-4 text-sm ${selectedRoutineIds.length === 0 ? "border-primary/30 bg-primary/10 text-primary" : "bg-background"}`}>Ninguna</button> : null}
          {routines.map((routine) => {
            const selected = selectedRoutineIds.includes(routine.id);
            return <button key={routine.id} type="button" aria-pressed={selected} onClick={() => onRoutineIdsChange(editing ? toggleValue(selectedRoutineIds, routine.id) : selected ? [] : [routine.id])}
              className={`min-h-10 rounded-full border px-4 text-sm font-medium ${selected ? "border-primary/30 bg-primary/10 text-primary" : "bg-background hover:bg-muted"}`}>{routine.nombre}</button>;
          })}
          {routines.length === 0 ? <span className="text-sm text-muted-foreground">No hay rutinas activas.</span> : null}
        </div>
      </section>

      <section className="py-5">
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span>Opciones avanzadas</span><ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <Field label="Notas"><textarea value={values.notes} onChange={(event) => onChange({ ...values, notes: event.target.value })} placeholder="Notas opcionales" maxLength={1000} disabled={pending} className="mt-2 min-h-24 w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm" /></Field>
        </details>
      </section>

      {editing ? <section className="space-y-2 py-5">
        {editing.is_active ? <Button type="button" variant="destructive" className="w-full bg-destructive/10 text-destructive hover:bg-destructive/15" onClick={onArchive} disabled={pending}><Archive className="size-4" aria-hidden />Archivar ejercicio</Button>
          : <Button type="button" variant="secondary" className="w-full text-primary" onClick={onRestore} disabled={pending}><RotateCcw className="size-4" aria-hidden />Restaurar ejercicio</Button>}
        <p className="text-center text-xs text-muted-foreground">Las sesiones y registros anteriores siempre se conservan.</p>
      </section> : null}
      {error ? <p className="py-4 text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}

function ExerciseRows({ exercises, onEdit }: { exercises: ExerciseLibraryItem[]; onEdit: (exercise: ExerciseLibraryItem) => void }) {
  return <div className="divide-y divide-border/70">{exercises.map((exercise) => <button key={exercise.id} type="button" onClick={() => onEdit(exercise)}
    className="group flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left outline-none hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" aria-label={`Editar ${exercise.nombre}`}>
    <span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="line-clamp-2 text-sm font-semibold leading-5">{exercise.nombre}</span>{!exercise.is_active ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Archivado</span> : null}</span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{exerciseLibrarySummary(exercise)}</span></span>
    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
  </button>)}</div>;
}

function FilterChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return <button type="button" onClick={onRemove} className="inline-flex min-h-8 items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 text-xs font-medium text-primary">{children}<X className="size-3" aria-hidden /></button>;
}

function FilterSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <fieldset className="space-y-3 border-b border-border/70 pb-5 last:border-b-0 last:pb-0"><legend className="font-semibold">{title}</legend>{description ? <p className="-mt-2 text-xs text-muted-foreground">{description}</p> : null}{children}</fieldset>;
}

function SegmentedControl<T extends string>({ label, value, options, onChange }: {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/45 p-1" role="group" aria-label={label}>{options.map((option) => {
    const selected = value === option.value;
    return <button key={option.value} type="button" aria-pressed={selected} onClick={() => onChange(option.value)} className={`min-h-10 rounded-lg px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected ? "bg-background text-primary shadow-sm ring-1 ring-primary/15" : "text-muted-foreground hover:text-foreground"}`}>{option.label}</button>;
  })}</div>;
}

function SelectableRow({ selected, onClick, children, leading }: { selected: boolean; onClick: () => void; children: React.ReactNode; leading?: React.ReactNode }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl border px-3 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-primary/35 bg-primary/10" : "border-border bg-background hover:bg-muted/55"}`}>
    {leading}<span className="min-w-0 flex-1 truncate">{children}</span><span className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`} aria-hidden>{selected ? <Check className="size-3.5" /> : null}</span>
  </button>;
}

export function ExerciseLibrary({ initialExercises, initialRoutines }: { initialExercises: ExerciseLibraryItem[]; initialRoutines: ExerciseLibraryRoutine[] }) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<ExerciseLibraryFilters>(DEFAULT_EXERCISE_LIBRARY_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ExerciseLibraryFilters>(DEFAULT_EXERCISE_LIBRARY_FILTERS);
  const [openGroups, setOpenGroups] = useState<Set<ExerciseLibraryGroup>>(() => {
    const first = groupExerciseLibrary(filterExerciseLibrary(initialExercises, { query: "", filters: DEFAULT_EXERCISE_LIBRARY_FILTERS }))[0];
    return new Set(first ? [first.value] : []);
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [implementsOpen, setImplementsOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ExerciseLibraryItem | null>(null);
  const [form, setForm] = useState<FormValues>(emptyForm);
  const [selectedRoutineIds, setSelectedRoutineIds] = useState<string[]>([]);
  const [archiveTarget, setArchiveTarget] = useState<ExerciseLibraryItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const editorCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (!notice) return; const timeout = window.setTimeout(() => setNotice(null), 3000); return () => window.clearTimeout(timeout); }, [notice]);
  const visibleExercises = useMemo(() => filterExerciseLibrary(exercises, { query, filters }), [exercises, filters, query]);
  const groupedExercises = useMemo(() => groupExerciseLibrary(visibleExercises), [visibleExercises]);
  const previewExercises = useMemo(() => filterExerciseLibrary(exercises, { query, filters: draftFilters }), [draftFilters, exercises, query]);
  const implementOptions = useMemo(() => exerciseLibraryImplementOptions(exercises), [exercises]);
  const activeFilterCount = exerciseLibraryActiveFilterCount(filters);

  function openCreate() { setEditing(null); setForm(emptyForm()); setSelectedRoutineIds([]); setError(null); setEditorOpen(true); }
  function openEdit(exercise: ExerciseLibraryItem) { setEditing(exercise); setForm(formFromExercise(exercise)); setSelectedRoutineIds(exercise.memberships.map((item) => item.id)); setError(null); setEditorOpen(true); }
  function openFilters() { setDraftFilters(cloneFilters(filters)); setImplementsOpen(false); setFiltersOpen(true); }
  function clearDraftFilters() { setDraftFilters(cloneFilters(DEFAULT_EXERCISE_LIBRARY_FILTERS)); }
  function setRoutineUsage(value: RoutineUsage) {
    setDraftFilters({
      ...draftFilters,
      withRoutine: value === "assigned",
      withoutRoutine: value === "unassigned",
      routineIds: [],
    });
  }

  function saveExercise(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return; setError(null);
    let input: ExerciseMutationInput;
    try { input = mutationFromForm(form); } catch (cause) { setError(cause instanceof Error ? cause.message : "Revisá los valores del ejercicio."); return; }
    startTransition(async () => {
      const result = editing ? await updateExerciseAction(editing.id, input, selectedRoutineIds) : await createExerciseAction(input, selectedRoutineIds);
      if (!result.ok) { setError(result.error); return; }
      const memberships = initialRoutines.filter((routine) => selectedRoutineIds.includes(routine.id));
      const next: ExerciseLibraryItem = { ...result.data, memberships };
      setExercises((current) => sortExerciseLibrary([...current.filter((item) => item.id !== next.id), next]));
      setOpenGroups((current) => new Set([...current, next.grupo_muscular ?? "none"]));
      setEditorOpen(false); setNotice(result.warning ?? (editing ? "Cambios guardados" : "Ejercicio creado")); router.refresh();
    });
  }

  function archiveConfirmed() {
    if (!archiveTarget || pending) return;
    startTransition(async () => { const result = await archiveExerciseAction(archiveTarget.id); if (!result.ok) { setError(result.error); return; }
      setExercises((current) => current.map((item) => item.id === archiveTarget.id ? { ...item, is_active: false } : item));
      setArchiveTarget(null); setNotice("Ejercicio archivado"); router.refresh(); });
  }

  function restoreCurrent() {
    if (!editing || pending) return;
    startTransition(async () => { const result = await restoreExerciseAction(editing.id); if (!result.ok) { setError(result.error); return; }
      setExercises((current) => current.map((item) => item.id === editing.id ? { ...item, ...result.data } : item));
      setEditorOpen(false); setNotice("Ejercicio restaurado"); router.refresh(); });
  }

  const statusHeading = filters.status === "active" ? "Ejercicios activos" : filters.status === "archived" ? "Ejercicios archivados" : "Todos los ejercicios";
  const draftRoutineUsage = routineUsageFromFilters(draftFilters);
  return <div className="space-y-5 lg:mx-auto lg:max-w-3xl">
    <div className="flex items-start justify-between gap-4"><div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1><p className="text-sm text-muted-foreground">Buscá y organizá tus ejercicios.</p></div>
      <Button type="button" onClick={openCreate} className="shrink-0"><Plus className="size-4" aria-hidden />Nuevo</Button></div>

    <div className="flex gap-2"><label className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 pl-9 pr-10" placeholder="Buscar ejercicio, músculo o implemento" aria-label="Buscar ejercicio, músculo o implemento" />
      {query ? <button type="button" onClick={() => setQuery("")} className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted" aria-label="Limpiar búsqueda"><X className="size-4" /></button> : null}</label>
      <Button type="button" variant="outline" className="h-11 shrink-0 px-3 text-primary" onClick={openFilters} aria-haspopup="dialog"><SlidersHorizontal className="size-4" aria-hidden /><span className="hidden sm:inline">Filtros</span>{activeFilterCount ? <span>· {activeFilterCount}</span> : null}</Button></div>

    {activeFilterCount ? <div className="flex flex-wrap gap-2" aria-label="Filtros activos">
      {filters.withoutRoutine ? <FilterChip onRemove={() => setFilters({ ...filters, withoutRoutine: false })}>Sin rutina</FilterChip> : null}
      {filters.withRoutine && filters.routineIds.length === 0 ? <FilterChip onRemove={() => setFilters({ ...filters, withRoutine: false })}>En rutina</FilterChip> : null}
      {filters.routineIds.map((id) => <FilterChip key={id} onRemove={() => setFilters({ ...filters, routineIds: filters.routineIds.filter((item) => item !== id) })}>{initialRoutines.find((routine) => routine.id === id)?.nombre ?? "Rutina"}</FilterChip>)}
      {filters.muscleGroups.map((group) => <FilterChip key={group} onRemove={() => setFilters({ ...filters, muscleGroups: filters.muscleGroups.filter((item) => item !== group) })}>{group === "none" ? "Sin clasificar" : muscleGroupLabel(group)}</FilterChip>)}
      {filters.implements.map((item) => <FilterChip key={item} onRemove={() => setFilters({ ...filters, implements: filters.implements.filter((value) => value !== item) })}>{item}</FilterChip>)}
      {filters.status !== "active" ? <FilterChip onRemove={() => setFilters({ ...filters, status: "active" })}>{filters.status === "archived" ? "Archivados" : "Todos"}</FilterChip> : null}
    </div> : null}

    <section className="space-y-2" aria-labelledby="exercise-library-list-title"><div className="flex items-center justify-between gap-3 px-1"><h2 id="exercise-library-list-title" className="text-sm text-muted-foreground">{query.trim() ? "Resultados" : statusHeading}</h2><span className="text-sm text-muted-foreground">{visibleExercises.length} {visibleExercises.length === 1 ? "ejercicio" : "ejercicios"}</span></div>
      {visibleExercises.length === 0 ? <div className="rounded-2xl border border-dashed p-6 text-center"><p className="text-sm text-muted-foreground">{query ? `No encontramos “${query.trim()}”.` : "No hay ejercicios con estos filtros."}</p><Button type="button" variant="link" onClick={() => { setQuery(""); setFilters(cloneFilters(DEFAULT_EXERCISE_LIBRARY_FILTERS)); }}>Limpiar</Button></div>
        : query.trim() ? <div className="overflow-hidden rounded-xl border bg-card"><ExerciseRows exercises={sortExerciseLibrary(visibleExercises)} onEdit={openEdit} /></div>
        : <div className="space-y-2">{groupedExercises.map((section) => { const open = openGroups.has(section.value); return <section key={section.value} className="overflow-hidden rounded-xl border bg-card"><button type="button" aria-expanded={open} onClick={() => setOpenGroups((current) => { const next = new Set(current); if (open) next.delete(section.value); else next.add(section.value); return next; })} className="flex min-h-14 w-full items-center gap-3 px-4 text-left outline-none hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
          {open ? <ChevronDown className="size-4" aria-hidden /> : <ChevronRight className="size-4" aria-hidden />}<span className="flex-1 text-sm font-semibold uppercase tracking-wide">{section.label}</span><span className="rounded-full bg-muted px-2.5 py-1 text-xs">{section.exercises.length}</span></button>{open ? <ExerciseRows exercises={section.exercises} onEdit={openEdit} /> : null}</section>; })}</div>}
    </section>

    <Sheet open={filtersOpen} onOpenChange={(open) => { setFiltersOpen(open); if (!open) setImplementsOpen(false); }}>
      <SheetHeader inlineActions title="Filtrar ejercicios" description="Acotá la biblioteca por rutina, músculo e implemento." closeLabel="Cerrar filtros" action={<button type="button" onClick={clearDraftFilters} aria-label="Limpiar filtros" className="flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">Limpiar</button>} />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        <FilterSection title="Uso en rutinas" description="Filtrá por ejercicios que estén o no en tus rutinas.">
          <SegmentedControl label="Uso en rutinas" value={draftRoutineUsage} onChange={setRoutineUsage} options={[
            { value: "any", label: "Cualquiera" }, { value: "assigned", label: "En rutina" }, { value: "unassigned", label: "Sin rutina" },
          ]} />
          {draftRoutineUsage === "assigned" ? <div className="space-y-3">
            <div><h4 className="text-sm font-semibold">Rutinas</h4><p className="text-xs text-muted-foreground">Seleccioná una o más rutinas.</p></div>
            {initialRoutines.length ? <div className="grid grid-cols-2 gap-2" aria-label="Rutinas activas">{initialRoutines.map((routine) => {
              const selected = draftFilters.routineIds.includes(routine.id);
              return <SelectableRow key={routine.id} selected={selected} onClick={() => setDraftFilters({ ...draftFilters, withRoutine: true, withoutRoutine: false, routineIds: toggleValue(draftFilters.routineIds, routine.id) })} leading={<span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: routineColorCssVariable(routine.color) }} aria-hidden />}>{routine.nombre}</SelectableRow>;
            })}</div> : <p className="text-sm text-muted-foreground">No hay rutinas activas.</p>}
          </div> : null}
        </FilterSection>

        <FilterSection title="Grupo muscular" description="Seleccioná uno o más grupos musculares.">
          <div className="grid grid-cols-2 gap-2" aria-label="Grupos musculares">{GROUP_OPTIONS.map((group) => <SelectableRow key={group.value} selected={draftFilters.muscleGroups.includes(group.value)} onClick={() => setDraftFilters({ ...draftFilters, muscleGroups: toggleValue(draftFilters.muscleGroups, group.value) })}>{group.label}</SelectableRow>)}</div>
          <button type="button" aria-pressed={draftFilters.muscleGroups.includes("none")} onClick={() => setDraftFilters({ ...draftFilters, muscleGroups: toggleValue(draftFilters.muscleGroups, "none") })} className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${draftFilters.muscleGroups.includes("none") ? "border-primary/35 bg-primary/10" : "border-border bg-background hover:bg-muted/55"}`}>
            <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${draftFilters.muscleGroups.includes("none") ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`} aria-hidden>{draftFilters.muscleGroups.includes("none") ? <Check className="size-3.5" /> : null}</span>
            <span className="min-w-0"><span className="block text-sm font-medium">Sin clasificar</span><span className="block text-xs text-muted-foreground">Mostrar ejercicios sin grupo muscular asignado.</span></span>
          </button>
        </FilterSection>

        <FilterSection title="Implemento">
          <button type="button" onClick={() => setImplementsOpen(true)} aria-haspopup="dialog" aria-label={`Implemento: ${implementSelectionSummary(draftFilters.implements)}`} className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-border bg-background px-3 text-left outline-none transition-colors hover:bg-muted/55 focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Dumbbell className="size-5" aria-hidden /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Implemento</span><span className="block text-xs text-muted-foreground">Filtrá por tipo de implemento.</span></span>
            <span className="max-w-[38%] truncate text-right text-sm text-muted-foreground">{implementSelectionSummary(draftFilters.implements)}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </FilterSection>

        <FilterSection title="Mostrar" description="Filtrá por estado del ejercicio.">
          <SegmentedControl label="Estado del ejercicio" value={draftFilters.status} onChange={(status) => setDraftFilters({ ...draftFilters, status: status as ExerciseLibraryStatus })} options={[
            { value: "active", label: "Activos" }, { value: "archived", label: "Archivados" }, { value: "all", label: "Todos" },
          ]} />
        </FilterSection>
      </div>
      <footer className="flex shrink-0 items-center justify-between gap-4 border-t bg-card px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-5"><span className="text-sm text-muted-foreground">{previewExercises.length} {previewExercises.length === 1 ? "ejercicio" : "ejercicios"}</span><Button type="button" onClick={() => { setFilters(cloneFilters(draftFilters)); setFiltersOpen(false); }}>Ver ejercicios</Button></footer>
    </Sheet>

    <Sheet open={implementsOpen} onOpenChange={setImplementsOpen}>
      <SheetHeader inlineActions title="Implementos" description="Seleccioná uno o más implementos." closeLabel="Volver a filtros" action={draftFilters.implements.length ? <button type="button" onClick={() => setDraftFilters({ ...draftFilters, implements: [] })} className="flex min-h-10 items-center rounded-lg px-2 text-sm font-medium text-primary outline-none hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-ring">Limpiar</button> : null} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
        {implementOptions.length ? <div className="space-y-2" aria-label="Seleccionar implementos">{implementOptions.map((item) => <SelectableRow key={item} selected={draftFilters.implements.includes(item)} onClick={() => setDraftFilters({ ...draftFilters, implements: toggleValue(draftFilters.implements, item) })}>{item}</SelectableRow>)}</div> : <p className="text-sm text-muted-foreground">No hay implementos disponibles.</p>}
      </div>
      <footer className="shrink-0 border-t bg-card px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-5"><Button type="button" className="h-11 w-full" onClick={() => setImplementsOpen(false)}>Listo</Button></footer>
    </Sheet>

    <Sheet open={editorOpen} large initialFocus={editorCloseRef} onOpenChange={(open) => { if (!pending) { setEditorOpen(open); if (!open) setError(null); } }}>
      <SheetHeader title={editing ? "Editar ejercicio" : "Nuevo ejercicio"} description={editing ? "Actualizá la configuración del ejercicio." : "Agregalo a tu biblioteca para usarlo cuando lo necesites."} closeLabel="Cerrar formulario de ejercicio" closeRef={editorCloseRef} pending={pending} />
      <form onSubmit={saveExercise} className="flex min-h-0 flex-1 flex-col" noValidate><div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-5 sm:px-5"><ExerciseForm values={form} onChange={setForm} pending={pending} editing={editing} routines={initialRoutines} selectedRoutineIds={selectedRoutineIds} onRoutineIdsChange={setSelectedRoutineIds} error={error} onArchive={() => { if (editing) { setError(null); setEditorOpen(false); setArchiveTarget(editing); } }} onRestore={restoreCurrent} /></div>
        <footer className="shrink-0 border-t bg-card px-4 py-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] sm:px-5"><Button className="h-11 w-full" type="submit" disabled={pending}>{pending ? (editing ? "Guardando…" : "Creando…") : editing ? "Guardar cambios" : "Crear ejercicio"}</Button></footer></form>
    </Sheet>

    <Sheet open={Boolean(archiveTarget)} onOpenChange={(open) => { if (!open && !pending) setArchiveTarget(null); }}><div className="p-5"><Dialog.Title className="font-semibold">¿Archivar {archiveTarget?.nombre}?</Dialog.Title><Dialog.Description className="mt-2 text-sm text-muted-foreground">Se ocultará de los ejercicios activos. Las sesiones anteriores y sus rutinas se conservan.</Dialog.Description><div className="mt-5 flex justify-end gap-2"><Dialog.Close render={<Button type="button" variant="outline" disabled={pending} />}>Cancelar</Dialog.Close><Button type="button" variant="destructive" onClick={archiveConfirmed} disabled={pending}>{pending ? "Archivando…" : "Archivar"}</Button></div>{error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}</div></Sheet>

    {notice ? <div className="fixed inset-x-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-sm items-center justify-center gap-2 rounded-xl border bg-card/95 px-4 py-3 text-sm font-medium shadow-lg backdrop-blur" role="status"><Check className="size-4 text-primary" aria-hidden />{notice}</div> : null}
  </div>;
}
