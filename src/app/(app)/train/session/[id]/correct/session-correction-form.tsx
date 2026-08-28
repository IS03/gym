"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LocalizedDecimalInput } from "@/components/ui/localized-decimal-input";
import { Label } from "@/components/ui/label";
import { nullableNumberFromInput } from "@/lib/phase2/training-validation";
import { formatSessionDate } from "@/lib/phase2/session-history";
import type { CompletedSessionCorrectionInput, WorkoutSessionDetail } from "@/lib/phase2/types";
import { correctCompletedWorkoutSessionAction } from "../../../actions";

type CorrectionState = Omit<CompletedSessionCorrectionInput, "sessionId" | "expectedSessionUpdatedAt">;

function initialState(detail: WorkoutSessionDetail): CorrectionState {
  return {
    metadata: {
      energy_level: detail.session.energy_level,
      performance_level: detail.session.performance_level,
      pain_level: detail.session.pain_level,
      pain_note: detail.session.pain_note ?? "",
      treadmill_minutes: detail.session.treadmill_minutes,
      treadmill_distance_km: detail.session.treadmill_distance_km,
      treadmill_speed_kmh: detail.session.treadmill_speed_kmh,
      treadmill_incline_percent: detail.session.treadmill_incline_percent,
      notes: detail.session.notes ?? "",
    },
    exercises: detail.exercises.map((exercise) => ({
      id: exercise.id,
      expectedUpdatedAt: exercise.updated_at,
      notes: exercise.notes ?? "",
      sets: exercise.sets.map((set) => ({ id: set.id, actual_reps: set.actual_reps, actual_weight_kg: set.actual_weight_kg, notes: set.notes ?? "" })),
    })),
  };
}

function numericInput(label: string, value: number | null, onChange: (value: number | null) => void, max: number, step = "1") {
  return <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span>{step === "1" ? <Input type="number" min={0} max={max} step={step} inputMode="numeric" value={value ?? ""} onChange={(event) => onChange(nullableNumberFromInput(event.target.value))} /> : <LocalizedDecimalInput min={0} max={max} value={value} onValueChange={onChange} />}</label>;
}

export function SessionCorrectionForm({ detail }: { detail: WorkoutSessionDetail }) {
  const [value, setValue] = useState(() => initialState(detail));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const sessionName = detail.session.routine_name_snapshot ?? detail.session.session_name ?? "Sesión libre";

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<CorrectionState["exercises"][number]["sets"][number]>) {
    setValue((current) => ({ ...current, exercises: current.exercises.map((exercise, index) => index !== exerciseIndex ? exercise : ({ ...exercise, sets: exercise.sets.map((set, currentSetIndex) => currentSetIndex !== setIndex ? set : { ...set, ...patch }) })) }));
  }

  function save() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await correctCompletedWorkoutSessionAction({
        sessionId: detail.session.id,
        expectedSessionUpdatedAt: detail.session.updated_at,
        ...value,
      });
      if (!result.ok) { setError(result.error); return; }
      setSaved(true);
    });
  }

  return <div className="space-y-5">
    <header className="space-y-2"><Link href={`/train/session/${detail.session.id}`} className="inline-flex text-sm font-medium text-muted-foreground hover:text-foreground">← Volver a la sesión</Link><div><h1 className="text-2xl font-semibold tracking-tight">Corregir sesión</h1><p className="mt-1 text-sm text-muted-foreground">{sessionName} · {formatSessionDate(detail.logDate)}</p></div><p className="rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-sm leading-relaxed text-muted-foreground">Sólo podés corregir datos realizados y notas. La fecha, duración, rutina, ejercicios, objetivos y progresión están congelados.</p></header>
    <section className="space-y-3"><h2 className="text-base font-semibold">Series realizadas</h2>{detail.exercises.map((exercise, exerciseIndex) => <Card key={exercise.id}><CardContent className="space-y-3 pt-4"><div><h3 className="font-semibold">{exercise.nombre_snapshot}</h3><p className="mt-0.5 text-xs text-muted-foreground">Objetivos y checks históricos no se modifican.</p></div><div className="space-y-2">{exercise.sets.map((set, setIndex) => <div key={set.id} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2 rounded-lg bg-muted/35 px-2 py-2"><span className="pb-3 text-sm font-semibold text-muted-foreground">S{set.set_number}</span>{numericInput("Peso (kg)", value.exercises[exerciseIndex].sets[setIndex].actual_weight_kg, (next) => updateSet(exerciseIndex, setIndex, { actual_weight_kg: next }), 9999.99, "0.01")}{numericInput("Reps", value.exercises[exerciseIndex].sets[setIndex].actual_reps, (next) => updateSet(exerciseIndex, setIndex, { actual_reps: next }), 1000)}</div>)}</div></CardContent></Card>)}</section>
    <details className="rounded-xl border bg-card px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Notas y resumen opcional</summary><div className="mt-4 space-y-4"><div className="grid grid-cols-3 gap-2">{numericInput("Energía", value.metadata.energy_level, (next) => setValue((current) => ({ ...current, metadata: { ...current.metadata, energy_level: next } })), 5)}{numericInput("Rendimiento", value.metadata.performance_level, (next) => setValue((current) => ({ ...current, metadata: { ...current.metadata, performance_level: next } })), 5)}{numericInput("Dolor", value.metadata.pain_level, (next) => setValue((current) => ({ ...current, metadata: { ...current.metadata, pain_level: next } })), 10)}</div><label className="block space-y-1"><Label htmlFor="session-correction-notes">Notas de la sesión</Label><textarea id="session-correction-notes" className="min-h-24 w-full rounded-lg border bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm" value={value.metadata.notes} onChange={(event) => setValue((current) => ({ ...current, metadata: { ...current.metadata, notes: event.target.value } }))} /></label></div></details>
    {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}{saved ? <div className="flex flex-wrap items-center gap-3"><p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">✓ Correcciones guardadas</p><Link href={`/train/session/${detail.session.id}`} className="text-sm font-medium text-primary hover:underline">Volver a la sesión</Link></div> : null}<Button className="w-full sm:w-auto" type="button" disabled={pending} onClick={save}>{pending ? "Guardando…" : "Guardar correcciones"}</Button>
  </div>;
}
