"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, CalendarDays, ChevronRight, Dumbbell, Flame, Ruler, Scale, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Sex } from "@/lib/phase1/profile";
import type { EnergyConfigEditor as EnergyConfigEditorModel } from "@/lib/nutrition/plan-v2";
import {
  estimateBaseExpenditure,
  type ActivityLevel,
  type BaseExpenditureMode,
} from "@/lib/nutrition/plan-v2-core";
import { cn } from "@/lib/utils";
import { saveEnergyConfigV2Action } from "../actions";

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const activityOptions: Array<{ value: ActivityLevel; label: string }> = [
  { value: "low", label: "Baja" },
  { value: "moderate", label: "Moderada" },
  { value: "high", label: "Alta" },
];

function sexLabel(sex: Sex | null) {
  if (sex === "male") return "Masculino";
  if (sex === "female") return "Femenino";
  if (sex === "other") return "Otro";
  return "Sin cargar";
}

export function EnergyConfigEditor({ initial, profile }: {
  initial: EnergyConfigEditorModel;
  profile: { age: number | null; sex: Sex | null; heightCm: number | null; weightKg: number | null; bmrKcal: number | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [activityLevel, setActivityLevel] = useState(initial.activityLevel);
  const [baseMode, setBaseMode] = useState<BaseExpenditureMode>(initial.baseExpenditureMode);
  const [customBase, setCustomBase] = useState(initial.customBaseExpenditureKcal == null ? "" : String(initial.customBaseExpenditureKcal));
  const [trainingDelta, setTrainingDelta] = useState(String(initial.trainingExpenditureDeltaKcal));
  const [trainingDialog, setTrainingDialog] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const complete = profile.age != null && profile.sex != null && profile.heightCm != null && profile.weightKg != null && profile.bmrKcal != null;
  const automaticBase = profile.bmrKcal == null ? null : estimateBaseExpenditure(profile.bmrKcal, activityLevel);
  const parsedCustomBase = Number(customBase);
  const baseUsed = baseMode === "custom" && Number.isFinite(parsedCustomBase) && parsedCustomBase > 0
    ? parsedCustomBase
    : automaticBase;

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveEnergyConfigV2Action({
        activityLevel,
        baseExpenditureMode: baseMode,
        customBaseExpenditureKcal: customBase,
        trainingExpenditureDeltaKcal: trainingDelta,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error ?? "No se pudo guardar el cálculo." });
        return;
      }
      setMessage({ ok: true, text: "Cálculo guardado desde hoy." });
      router.refresh();
    });
  }

  const dataRows = [
    [CalendarDays, "Edad", profile.age == null ? "Sin cargar" : String(profile.age)],
    [UserRound, "Sexo", sexLabel(profile.sex)],
    [Ruler, "Altura", profile.heightCm == null ? "Sin cargar" : `${numberFormatter.format(profile.heightCm)} cm`],
    [Scale, "Peso", profile.weightKg == null ? "Sin cargar" : `${numberFormatter.format(profile.weightKg)} kg`],
  ] as const;

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3"><UserRound className="size-5 text-primary" aria-hidden /><h2 className="text-sm font-semibold">Datos usados</h2></div>
        <dl className="divide-y divide-border/70">
          {dataRows.map(([Icon, label, value]) => <div key={label} className="flex min-h-12 items-center gap-3 px-4 py-2.5"><Icon className="size-4 text-muted-foreground" aria-hidden /><dt className="min-w-0 flex-1 text-sm text-muted-foreground">{label}</dt><dd className="metric-number text-sm font-semibold">{value}</dd></div>)}
        </dl>
      </section>

      {!complete ? (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <h2 className="text-sm font-semibold">Completá tus datos físicos para calcular tu gasto.</h2>
          <p className="mt-1 text-sm text-muted-foreground">Necesitamos nacimiento, género, altura y peso actual.</p>
          <Link href="/settings/profile" className="mt-3 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition-colors hover:bg-primary/80 focus-visible:ring-3 focus-visible:ring-ring/50">Ir a Perfil</Link>
        </section>
      ) : null}

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="mb-3 flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Activity className="size-4" aria-hidden /></span><h2 className="text-sm font-semibold">Actividad cotidiana</h2></div>
        <div className="grid grid-cols-3 rounded-xl bg-muted p-1" aria-label="Actividad cotidiana">
          {activityOptions.map((option) => <button key={option.value} type="button" aria-pressed={activityLevel === option.value} onClick={() => setActivityLevel(option.value)} className={cn("min-h-10 rounded-lg px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", activityLevel === option.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{option.label}</button>)}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Esto refleja tu movimiento general fuera del entrenamiento.</p>
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Flame className="size-5" aria-hidden /></span><div><h2 className="text-sm font-semibold">Estimación automática</h2><p className="text-xs text-muted-foreground">Metabolismo basal + actividad cotidiana</p></div></div>
        <p className="metric-number mt-3 text-3xl font-semibold tracking-tight text-primary">{automaticBase == null ? "—" : `${automaticBase} kcal`}</p>
        <p className="mt-1 text-xs text-muted-foreground">Referencia calculada por OWNLEVEL. No incluye entrenamiento.</p>
      </section>

      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div><h2 className="text-sm font-semibold">Gasto base usado</h2><p className="mt-0.5 text-xs text-muted-foreground">Es la base canónica para Today, historial y balance.</p></div>
        <div className="mt-3 grid grid-cols-2 rounded-xl bg-muted p-1" aria-label="Modo de gasto base">
          {([{ value: "automatic", label: "Automático" }, { value: "custom", label: "Personalizado" }] as const).map(({ value, label }) => {
            return <button key={value} type="button" aria-pressed={baseMode === value} onClick={() => { setBaseMode(value); if (value === "custom" && !customBase && automaticBase != null) setCustomBase(String(automaticBase)); }} className={cn("min-h-10 rounded-lg px-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", baseMode === value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>{label}</button>;
          })}
        </div>
        {baseMode === "custom" ? <label className="mt-4 block space-y-1.5 text-sm font-medium"><span>Gasto base personalizado</span><span className="flex items-center gap-2"><Input type="number" inputMode="numeric" min="1" step="1" value={customBase} onChange={(event) => setCustomBase(event.target.value)} className="text-base" /><span className="w-10 text-sm text-muted-foreground">kcal</span></span></label> : null}
        <p className="metric-number mt-4 text-xl font-semibold">{baseUsed == null ? "—" : `${baseUsed} kcal`}</p>
        <p className="mt-1 text-xs text-muted-foreground">{baseMode === "automatic" ? "Se actualiza con tus datos físicos y tu actividad cotidiana." : "La estimación automática permanece visible como referencia."}</p>
      </section>

      <button type="button" onClick={() => setTrainingDialog(true)} className="flex min-h-20 w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left shadow-sm outline-none ring-1 ring-foreground/8 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Dumbbell className="size-5" aria-hidden /></span>
        <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Extra de gasto por entrenamiento</span><span className="block text-xs text-muted-foreground">Se suma al gasto base usado</span></span>
        <span className="metric-number text-sm font-semibold">+{trainingDelta || 0} kcal</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden />
      </button>

      {message ? <p role="status" className={message.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-destructive"}>{message.text}</p> : null}
      <Button type="button" className="h-12 w-full" disabled={pending || !complete || (baseMode === "custom" && (!Number.isFinite(parsedCustomBase) || parsedCustomBase <= 0))} onClick={save}>{pending ? "Guardando…" : "Guardar cálculo"}</Button>

      <ResponsiveDialog open={trainingDialog} onOpenChange={setTrainingDialog} title="Extra de gasto por entrenamiento" description="Se suma una sola vez al gasto base usado cuando completás al menos una sesión." closeLabel="Cerrar ajuste">
        <label className="space-y-1.5 text-sm font-medium"><span>Extra de gasto</span><span className="flex items-center gap-2"><Input type="number" inputMode="numeric" min="0" step="1" value={trainingDelta} onChange={(event) => setTrainingDelta(event.target.value)} className="text-base" /><span className="w-10 text-sm text-muted-foreground">kcal</span></span></label>
        <Button type="button" className="mt-4 w-full" onClick={() => setTrainingDialog(false)}>Aplicar</Button>
      </ResponsiveDialog>
    </div>
  );
}
