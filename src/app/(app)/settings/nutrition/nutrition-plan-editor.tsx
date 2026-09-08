"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronRight, Copy, Droplet, Dumbbell, Flame, Target } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NutritionPlanEditor as NutritionPlanEditorModel } from "@/lib/nutrition/plan-v2";
import { WEEKDAYS, type WeekdayNumber } from "@/lib/nutrition/plan-v2-core";
import { saveNutritionPlanV2Action } from "./actions";

type DialogMode = "day" | "copy" | "weekdays" | "training" | "water" | null;
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
  const [weekdays, setWeekdays] = useState(initial.weekdays);
  const [baseWater, setBaseWater] = useState(initial.baseWaterL == null ? "" : String(initial.baseWaterL));
  const [trainingCalories, setTrainingCalories] = useState(String(initial.trainingCalorieDeltaKcal));
  const [trainingWater, setTrainingWater] = useState(String(initial.trainingWaterDeltaL));
  const [dialog, setDialog] = useState<DialogMode>(null);
  const [selectedDay, setSelectedDay] = useState<WeekdayNumber>(1);
  const [draftCalories, setDraftCalories] = useState("");
  const [draftProtein, setDraftProtein] = useState("");
  const [copySource, setCopySource] = useState<WeekdayNumber>(1);
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
    setDialog("day");
  }

  function applyTargets(scope: "day" | "weekdays") {
    const calorieTargetKcal = Number(draftCalories);
    const proteinTargetG = Number(draftProtein);
    if (!Number.isFinite(calorieTargetKcal) || !Number.isFinite(proteinTargetG)) return;
    setWeekdays((current) => current.map((day) => {
      const applies = scope === "day" ? day.weekday === selectedDay : day.weekday <= 5;
      return applies ? { ...day, calorieTargetKcal, proteinTargetG } : day;
    }));
    setDialog(null);
  }

  function openWeekdays() {
    const monday = weekdays.find((day) => day.weekday === 1) ?? weekdays[0];
    setDraftCalories(monday.calorieTargetKcal == null ? "" : String(monday.calorieTargetKcal));
    setDraftProtein(monday.proteinTargetG == null ? "" : String(monday.proteinTargetG));
    setDialog("weekdays");
  }

  function copyToAll() {
    const source = weekdays.find((day) => day.weekday === copySource);
    if (!source) return;
    setWeekdays((current) => current.map((day) => ({ ...day, calorieTargetKcal: source.calorieTargetKcal, proteinTargetG: source.proteinTargetG })));
    setDialog(null);
  }

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await saveNutritionPlanV2Action({
        name: initial.name,
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

  const dialogTitle = dialog === "day" ? WEEKDAYS.find((day) => day.value === selectedDay)?.label ?? "Día" : dialog === "copy" ? "Copiar a todos" : dialog === "weekdays" ? "Aplicar Lun–Vie" : dialog === "training" ? "Entrenamiento" : "Agua";
  const dialogDescription = dialog === "copy" ? "Elegí el día cuyos objetivos querés usar en toda la semana." : dialog === "weekdays" ? "Aplicá las mismas calorías y proteína de lunes a viernes." : dialog === "training" ? "Extra del objetivo en días con entrenamiento finalizado." : dialog === "water" ? "Definí el objetivo base y el extra de entrenamiento." : "Editá los objetivos base de este día.";

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/8">
        <div className="flex items-center gap-3 border-b border-border/70 pb-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Target className="size-5" aria-hidden /></span>
          <div className="min-w-0 flex-1"><p className="text-xs text-muted-foreground">Objetivo actual</p><h2 className="truncate text-base font-semibold">{initial.name}</h2><p className="text-xs text-muted-foreground">Desde {dateLabel(initial.effectiveFrom)}</p></div>
        </div>
        <dl className="grid grid-cols-3 divide-x divide-border/70 pt-4 text-center">
          <div className="px-1"><dt className="text-xs text-muted-foreground">Calorías</dt><dd className="metric-number mt-1 text-sm font-semibold">{calorieRange}</dd></div>
          <div className="px-1"><dt className="text-xs text-muted-foreground">Proteína</dt><dd className="metric-number mt-1 text-sm font-semibold">{proteinRange} g</dd></div>
          <div className="px-1"><dt className="text-xs text-muted-foreground">Agua</dt><dd className="metric-number mt-1 text-sm font-semibold">{waterRange}</dd></div>
        </dl>
      </section>

      <section className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-foreground/8">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CalendarDays className="size-4" aria-hidden /></span>
          <div className="mr-auto"><h2 className="text-sm font-semibold">Semana base</h2><p className="text-xs text-muted-foreground">Calorías y proteína por día.</p></div>
          <Button type="button" variant="secondary" size="sm" onClick={() => setDialog("copy")}><Copy aria-hidden />Copiar a todos</Button>
          <Button type="button" variant="secondary" size="sm" onClick={openWeekdays}>Aplicar Lun–Vie</Button>
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
        <button type="button" onClick={() => setDialog("training")} className="flex min-h-16 w-full items-center gap-3 border-b border-border/70 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Dumbbell className="size-5 shrink-0 text-primary" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Entrenamiento</span><span className="block text-xs text-muted-foreground">En días con entrenamiento</span></span><span className="metric-number text-sm font-medium">+{trainingCalories || 0} kcal</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></button>
        <button type="button" onClick={() => setDialog("water")} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><Droplet className="size-5 shrink-0 text-primary" aria-hidden /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Agua</span><span className="block text-xs text-muted-foreground">En días con entrenamiento</span></span><span className="metric-number text-sm font-medium">+{trainingWater || 0} L</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></button>
      </section>

      <Link href="/settings/nutrition/energy" className="flex min-h-16 items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-sm outline-none ring-1 ring-foreground/8 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"><span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Flame className="size-5" aria-hidden /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Cálculo energético</span><span className="block text-xs text-muted-foreground">Gasto base y ajuste por entrenamiento</span></span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></Link>

      {message ? <p role="status" className={message.ok ? "text-sm text-emerald-700 dark:text-emerald-400" : "text-sm text-destructive"}>{message.text}</p> : null}
      <Button type="button" className="h-12 w-full" disabled={pending} onClick={save}>{pending ? "Guardando…" : "Guardar plan"}</Button>

      <ResponsiveDialog open={dialog !== null} onOpenChange={(open) => { if (!open) setDialog(null); }} title={dialogTitle} description={dialogDescription} closeLabel="Cerrar edición">
        <div className="space-y-4">
          {dialog === "day" || dialog === "weekdays" ? <><Field label="Calorías" value={draftCalories} onChange={setDraftCalories} unit="kcal" integer /><Field label="Proteína" value={draftProtein} onChange={setDraftProtein} unit="g" /><Button type="button" className="w-full" onClick={() => applyTargets(dialog)}>Aplicar</Button></> : null}
          {dialog === "copy" ? <><label className="space-y-1.5 text-sm font-medium"><span>Día de referencia</span><select value={copySource} onChange={(event) => setCopySource(Number(event.target.value) as WeekdayNumber)} className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50">{WEEKDAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label><Button type="button" className="w-full" onClick={copyToAll}>Copiar a los siete días</Button></> : null}
          {dialog === "training" ? <><Field label="Extra de calorías" value={trainingCalories} onChange={setTrainingCalories} unit="kcal" integer /><Button type="button" className="w-full" onClick={() => setDialog(null)}>Aplicar</Button></> : null}
          {dialog === "water" ? <><Field label="Objetivo base" value={baseWater} onChange={setBaseWater} unit="L" /><Field label="Extra con entrenamiento" value={trainingWater} onChange={setTrainingWater} unit="L" /><Button type="button" className="w-full" onClick={() => setDialog(null)}>Aplicar</Button></> : null}
        </div>
      </ResponsiveDialog>
    </div>
  );
}
