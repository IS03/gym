"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, Droplet, Dumbbell, Flame, Target } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NutritionPlanEditor as NutritionPlanEditorModel } from "@/lib/nutrition/plan-v2";
import {
  applyWeekdayTargets,
  WEEKDAYS,
  type WeekdayNumber,
  type WeekdayPropagationScope,
} from "@/lib/nutrition/plan-v2-core";
import { saveNutritionPlanV2Action } from "./actions";

type DialogMode = "objective" | "day" | "training" | "water" | null;
type DayDraft = NutritionPlanEditorModel["weekdays"][number];

const dateFormatter = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeZone: "America/Argentina/Cordoba" });
const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const dateLabel = (value: string | null) => value
  ? dateFormatter.format(new Date(`${value}T12:00:00`))
  : "Sin versión guardada";

function Field({ label, value, onChange, unit, integer = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  unit: string;
  integer?: boolean;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <Input type="number" inputMode={integer ? "numeric" : "decimal"} min="0" step={integer ? "1" : "0.1"} value={value} onChange={(event) => onChange(event.target.value)} className="text-base" />
        <span className="w-10 text-sm text-muted-foreground">{unit}</span>
      </span>
    </label>
  );
}

export function NutritionPlanEditor({ initial }: { initial: NutritionPlanEditorModel }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(initial.name);
  const [objectiveDraft, setObjectiveDraft] = useState(initial.name);
  const [weekdays, setWeekdays] = useState(initial.weekdays);
  const [baseWater, setBaseWater] = useState(initial.baseWaterL == null ? "" : String(initial.baseWaterL));
  const [trainingCalories, setTrainingCalories] = useState(String(initial.trainingCalorieDeltaKcal));
  const [trainingWater, setTrainingWater] = useState(String(initial.trainingWaterDeltaL));
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [selectedDay, setSelectedDay] = useState<WeekdayNumber>(1);
  const [draftCalories, setDraftCalories] = useState("");
  const [draftProtein, setDraftProtein] = useState("");
  const [propagationScope, setPropagationScope] = useState<WeekdayPropagationScope>("day");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const calories = weekdays.map((day) => day.calorieTargetKcal).filter((value): value is number => value != null);
  const protein = weekdays.map((day) => day.proteinTargetG).filter((value): value is number => value != null);
  const calorieRange = calories.length === 0 ? "—" : Math.min(...calories) === Math.max(...calories) ? `${Math.min(...calories)}` : `${Math.min(...calories)} – ${Math.max(...calories)}`;
  const proteinRange = protein.length === 0 ? "—" : Math.min(...protein) === Math.max(...protein) ? `${numberFormatter.format(Math.min(...protein))}` : `${numberFormatter.format(Math.min(...protein))} – ${numberFormatter.format(Math.max(...protein))}`;
  const waterRange = useMemo(() => {
    const base = Number(baseWater) || 0;
    const extra = Number(trainingWater) || 0;
    return extra > 0 ? `${numberFormatter.format(base)} – ${numberFormatter.format(base + extra)} L` : `${numberFormatter.format(base)} L`;
  }, [baseWater, trainingWater]);

  function openDay(day: DayDraft) {
    setSelectedDay(day.weekday);
    setDraftCalories(day.calorieTargetKcal == null ? "" : String(day.calorieTargetKcal));
    setDraftProtein(day.proteinTargetG == null ? "" : String(day.proteinTargetG));
    setPropagationScope("day");
    setDialog("day");
  }

  function applyTargets() {
    const calorieTargetKcal = Number(draftCalories);
    const proteinTargetG = Number(draftProtein);
    if (!Number.isFinite(calorieTargetKcal) || !Number.isFinite(proteinTargetG)) return;
    setWeekdays((current) => applyWeekdayTargets(
      current,
      selectedDay,
      { calorieTargetKcal, proteinTargetG },
      propagationScope,
    ));
    setDialog(null);
  }

  function applyObjective() {
    const nextName = objectiveDraft.trim();
    if (!nextName) return;
    setName(nextName);
    setDialog(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveNutritionPlanV2Action({
        name,
        baseWaterL: baseWater,
        trainingCalorieDeltaKcal: trainingCalories,
        trainingWaterDeltaL: trainingWater,
        weekdays,
      });
      if (!result.ok) {
        setMessage({ ok: false, text: result.error ?? "No se pudo guardar el plan." });
        return;
      }
      setMessage({ ok: true, text: "Plan guardado desde hoy." });
      router.refresh();
    });
  }

  const dialogTitle = dialog === "objective" ? "Objetivo nutricional" : dialog === "day" ? WEEKDAYS.find((day) => day.value === selectedDay)?.label ?? "Día" : dialog === "training" ? "Extra por entrenamiento" : "Agua";
  const dialogDescription = dialog === "objective" ? "Nombrá la etapa que querés aplicar desde hoy." : dialog === "training" ? "Extra del objetivo nutricional en días con entrenamiento finalizado." : dialog === "water" ? "Definí el objetivo base y el extra de entrenamiento." : "Editá los objetivos base y elegí dónde aplicarlos.";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <button type="button" onClick={() => { setObjectiveDraft(name); setDialog("objective"); }} className="flex w-full items-center gap-3 border-b border-border/70 pb-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="size-5" aria-hidden /></span>
          <span className="min-w-0 flex-1"><span className="block text-xs text-muted-foreground">Objetivo actual</span><span className="block truncate text-base font-semibold">{name}</span><span className="block text-xs text-muted-foreground">Desde {dateLabel(initial.effectiveFrom)}</span></span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
        <dl className="grid grid-cols-3 divide-x divide-border/70 pt-4 text-center">
          <div className="px-1"><dt className="text-xs text-muted-foreground">Calorías</dt><dd className="metric-number mt-1 text-sm font-semibold">{calorieRange}</dd></div>
          <div className="px-1"><dt className="text-xs text-muted-foreground">Proteína</dt><dd className="metric-number mt-1 text-sm font-semibold">{proteinRange} g</dd></div>
          <div className="px-1"><dt className="text-xs text-muted-foreground">Agua</dt><dd className="metric-number mt-1 text-sm font-semibold">{waterRange}</dd></div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-center gap-2 border-b border-border/70 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-4" aria-hidden /></span>
          <div><h2 className="text-sm font-semibold">Semana base</h2><p className="text-xs text-muted-foreground">Calorías y proteína por día.</p></div>
        </div>
        <div className="divide-y divide-border/70">
          {WEEKDAYS.map((label) => {
            const day = weekdays.find((item) => item.weekday === label.value);
            if (!day) return null;
            const values = day.calorieTargetKcal == null || day.proteinTargetG == null ? "Sin configurar" : `${day.calorieTargetKcal} kcal · ${numberFormatter.format(day.proteinTargetG)} g`;
            return <button key={label.value} type="button" onClick={() => openDay(day)} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="w-9 text-sm font-semibold">{label.short}</span><span className="metric-number min-w-0 flex-1 text-sm text-muted-foreground">{values}</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></button>;
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3"><span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="size-4" aria-hidden /></span><div><h2 className="text-sm font-semibold">Ajustes automáticos</h2><p className="text-xs text-muted-foreground">Se aplican con una sesión finalizada.</p></div></div>
        <button type="button" onClick={() => setDialog("training")} className="flex min-h-16 w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Dumbbell className="size-5 shrink-0 text-primary" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Extra de objetivo por entrenamiento</span><span className="block text-xs text-muted-foreground">Se suma al objetivo del día</span></span><span className="metric-number text-sm font-medium">+{trainingCalories || 0} kcal</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></button>
        <button type="button" onClick={() => setDialog("water")} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Droplet className="size-5 shrink-0 text-primary" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Agua</span><span className="block text-xs text-muted-foreground">En días con entrenamiento</span></span><span className="metric-number text-sm font-medium">+{trainingWater || 0} L</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></button>
      </section>

      <Link href="/settings/nutrition/energy" className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm outline-none ring-1 ring-foreground/8 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Flame className="size-5" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Cálculo energético</span><span className="block text-xs text-muted-foreground">Gasto base y ajuste por entrenamiento</span></span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></Link>

      {message ? <p role="status" className={message.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-destructive"}>{message.text}</p> : null}
      <Button type="button" className="h-12 w-full" disabled={pending} onClick={save}>{pending ? "Guardando…" : "Guardar plan"}</Button>

      <ResponsiveDialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }} title={dialogTitle} description={dialogDescription} closeLabel="Cerrar edición">
        <div className="space-y-4">
          {dialog === "objective" ? <><label className="space-y-1.5 text-sm font-medium"><span>Nombre de la etapa</span><Input value={objectiveDraft} onChange={(event) => setObjectiveDraft(event.target.value)} maxLength={80} className="text-base" placeholder="Ej: Volumen controlado" /></label><p className="text-xs text-muted-foreground">Al guardar el plan, este nombre queda vigente desde hoy. El historial anterior no cambia.</p><Button type="button" className="w-full" disabled={!objectiveDraft.trim()} onClick={applyObjective}>Aplicar</Button></> : null}
          {dialog === "day" ? <><Field label="Calorías" value={draftCalories} onChange={setDraftCalories} unit="kcal" integer /><Field label="Proteína" value={draftProtein} onChange={setDraftProtein} unit="g" /><fieldset className="space-y-2"><legend className="text-sm font-medium">Aplicar estos valores a</legend><div className="grid gap-2">{([
            ["day", `Solo ${WEEKDAYS.find((day) => day.value === selectedDay)?.label.toLowerCase() ?? "este día"}`],
            ["weekdays", "Lunes a viernes"],
            ["all", "Todos los días"],
          ] as const).map(([value, label]) => <label key={value} className="flex min-h-11 items-center gap-3 rounded-xl border px-3 py-2 text-sm"><input type="radio" name="propagation-scope" value={value} checked={propagationScope === value} onChange={() => setPropagationScope(value)} className="size-4 accent-primary" /><span>{label}</span></label>)}</div></fieldset><Button type="button" className="w-full" onClick={applyTargets}>Aplicar</Button></> : null}
          {dialog === "training" ? <div className="grid gap-5"><Field label="Extra de calorías" value={trainingCalories} onChange={setTrainingCalories} unit="kcal" integer /><Button type="button" className="w-full" onClick={() => setDialog(null)}>Aplicar</Button></div> : null}
          {dialog === "water" ? <div className="grid gap-5"><div className="grid gap-4"><Field label="Objetivo base" value={baseWater} onChange={setBaseWater} unit="L" /><Field label="Extra con entrenamiento" value={trainingWater} onChange={setTrainingWater} unit="L" /></div><Button type="button" className="w-full" onClick={() => setDialog(null)}>Aplicar</Button></div> : null}
        </div>
      </ResponsiveDialog>
    </div>
  );
}
