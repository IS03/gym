"use client";

import { Check, SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRangeValue } from "@/lib/calendar/date-range";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import {
  addProgressIsoDays,
  getPreviousProgressPeriod,
  PROGRESS_CUSTOM_RANGE_MAX_DAYS,
  resolveProgressPeriod,
  type ProgressPeriodPreset,
  type ProgressPeriodRange,
} from "@/lib/progress/analytics";
import type { ProgressComparisonReferenceType, ProgressComparisonView } from "@/lib/progress/comparisons";
import { cn } from "@/lib/utils";

export type ComparisonMetricOption = {
  key: string;
  label: string;
  supportsGoal: boolean;
  archived?: boolean;
};

const referenceOptions: Array<{ value: ProgressComparisonReferenceType; label: string }> = [
  { value: "previous_period", label: "Período anterior" },
  { value: "other_period", label: "Otro período" },
  { value: "goal", label: "Objetivo" },
];
const periodOptions: Array<{ value: Exclude<ProgressPeriodPreset, "custom">; label: string }> = [
  { value: "1w", label: "1 semana" },
  { value: "2w", label: "2 semanas" },
  { value: "4w", label: "4 semanas" },
  { value: "8w", label: "8 semanas" },
  { value: "3m", label: "3 meses" },
  { value: "6m", label: "6 meses" },
  { value: "1y", label: "1 año" },
];
const viewOptions: Array<{ value: ProgressComparisonView; label: string }> = [
  { value: "insights", label: "Qué cambió" },
  { value: "summary", label: "Resumen" },
  { value: "evolution", label: "Evolución" },
];

export function ComparisonConfigurator({
  metrics,
  primaryPeriod,
  today,
  selectedMetricKeys,
  referenceType,
  referencePreset,
  referencePeriod,
  initialView,
  activeMetricKey,
  viewParam = "view",
  triggerLabel,
  triggerClassName,
  showViewSelection = true,
}: {
  metrics: ComparisonMetricOption[];
  primaryPeriod: ProgressPeriodRange;
  today: string;
  selectedMetricKeys: string[];
  referenceType: ProgressComparisonReferenceType | null;
  referencePreset: ProgressPeriodPreset | null;
  referencePeriod?: ProgressPeriodRange | null;
  initialView: ProgressComparisonView;
  activeMetricKey: string | null;
  viewParam?: string;
  triggerLabel?: string;
  triggerClassName?: string;
  showViewSelection?: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const fallbackMetrics = metrics.slice(0, 4).map((metric) => metric.key);
  const [draftReference, setDraftReference] = useState<ProgressComparisonReferenceType>(referenceType ?? "previous_period");
  const [draftPreset, setDraftPreset] = useState<ProgressPeriodPreset>(referencePreset ?? "custom");
  const [draftRange, setDraftRange] = useState<DateRangeValue>(referencePeriod ?? getPreviousProgressPeriod(primaryPeriod));
  const [draftMetrics, setDraftMetrics] = useState<string[]>(selectedMetricKeys.length ? selectedMetricKeys : fallbackMetrics);
  const [draftView, setDraftView] = useState<ProgressComparisonView>(initialView);
  const goalAvailable = metrics.some((metric) => metric.supportsGoal);

  const resetDraft = () => {
    setDraftReference(referenceType ?? "previous_period");
    setDraftPreset(referencePreset ?? "custom");
    setDraftRange(referencePeriod ?? getPreviousProgressPeriod(primaryPeriod));
    setDraftMetrics(selectedMetricKeys.length ? selectedMetricKeys : fallbackMetrics);
    setDraftView(initialView);
  };
  const setPreset = (preset: Exclude<ProgressPeriodPreset, "custom">) => {
    const anchor = addProgressIsoDays(primaryPeriod.start, -1);
    setDraftPreset(preset);
    setDraftRange(resolveProgressPeriod({ preset }, anchor).current);
  };
  const toggleMetric = (key: string) => {
    setDraftMetrics((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };
  const applicableMetrics = draftReference === "goal" ? metrics.filter((metric) => metric.supportsGoal) : metrics;
  const effectiveMetrics = draftMetrics.filter((key) => applicableMetrics.some((metric) => metric.key === key));

  const apply = () => {
    const chosen = effectiveMetrics.length ? effectiveMetrics : applicableMetrics.slice(0, 1).map((metric) => metric.key);
    if (!chosen.length) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set("compare", draftReference === "previous_period" ? "previous" : draftReference === "other_period" ? "period" : "goal");
    next.set("metrics", chosen.join(","));
    if (showViewSelection) next.set(viewParam, draftView);
    else next.delete(viewParam);
    const active = chosen.includes(activeMetricKey ?? "") ? activeMetricKey! : chosen[0]!;
    next.set("chartMetric", active);
    if (draftReference === "other_period") {
      next.set("refPeriod", draftPreset);
      if (draftPreset === "custom" && draftRange.start && draftRange.end) {
        next.set("refFrom", draftRange.start);
        next.set("refTo", draftRange.end);
      } else {
        next.delete("refFrom");
        next.delete("refTo");
      }
    } else {
      next.delete("refPeriod");
      next.delete("refFrom");
      next.delete("refTo");
    }
    setOpen(false);
    startTransition(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  };

  return <>
    <Button type="button" variant="outline" className={cn("mt-3 h-11 w-full justify-between", triggerClassName)} aria-expanded={open} onClick={() => { resetDraft(); setOpen(true); }} disabled={pending}>
      <span className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-primary" aria-hidden />{triggerLabel ?? (referenceType ? "Editar comparación" : "Configurar comparación")}</span>
      <span className="text-xs text-muted-foreground">{pending ? "Actualizando…" : "A/B"}</span>
    </Button>
    <ResponsiveDialog open={open} onOpenChange={setOpen} title="Configurar comparación" description="Elegí qué querés comparar sin mezclar métricas incompatibles." closeLabel="Cerrar configurador" footer={<Button type="button" className="h-11 w-full" onClick={apply} disabled={!effectiveMetrics.length && !applicableMetrics.length}>Aplicar comparación</Button>}>
      <div className="space-y-6">
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Comparación principal</p>
          <div className="rounded-xl border border-primary/30 bg-primary/8 px-3 py-3"><p className="text-sm font-semibold">{formatNutritionReportRange(primaryPeriod.start, primaryPeriod.end)}</p><p className="mt-0.5 text-xs text-muted-foreground">Período A</p></div>
        </section>
        <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Comparar con</p>
          <div className="grid gap-2">
            {referenceOptions.map((option) => {
              const disabled = option.value === "goal" && !goalAvailable;
              return <button key={option.value} type="button" disabled={disabled} aria-pressed={draftReference === option.value} className={cn("flex min-h-11 items-center justify-between rounded-xl border px-3 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40", draftReference === option.value ? "border-primary bg-primary/8 text-primary" : "bg-card")} onClick={() => setDraftReference(option.value)}><span>{option.label}</span>{draftReference === option.value ? <Check className="size-4" aria-hidden /> : null}</button>;
            })}
          </div>
        </section>
        {draftReference === "other_period" ? <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Período B</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {periodOptions.map((option) => <Button key={option.value} type="button" size="sm" variant={draftPreset === option.value ? "default" : "outline"} className="h-10 shrink-0" onClick={() => setPreset(option.value)}>{option.label}</Button>)}
            <Button type="button" size="sm" variant={draftPreset === "custom" ? "default" : "outline"} className="h-10 shrink-0" onClick={() => setDraftPreset("custom")}>Personalizado</Button>
          </div>
          {draftPreset === "custom" ? <DateRangePicker value={draftRange} onChange={setDraftRange} today={today} maxDays={PROGRESS_CUSTOM_RANGE_MAX_DAYS} fromName="refFrom" toName="refTo" /> : <p className="rounded-xl border bg-muted/25 px-3 py-2 text-sm">{draftRange.start && draftRange.end ? formatNutritionReportRange(draftRange.start, draftRange.end) : "Elegí un período"}</p>}
        </section> : null}
        <section className="space-y-2">
          <div><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Métricas</p><p className="mt-1 text-xs text-muted-foreground">Sólo aparecen las compatibles con este contexto.</p></div>
          <div className="divide-y overflow-hidden rounded-xl border bg-card">
            {metrics.map((metric) => {
              const disabled = draftReference === "goal" && !metric.supportsGoal;
              const checked = !disabled && draftMetrics.includes(metric.key);
              return <label key={metric.key} className={cn("flex min-h-11 items-center gap-3 px-3 py-2.5", disabled && "opacity-40")}><input type="checkbox" checked={checked} disabled={disabled} onChange={() => toggleMetric(metric.key)} className="size-4 accent-primary" /><span className="min-w-0 flex-1 text-sm font-medium">{metric.label}{metric.archived ? <span className="ml-1 text-xs font-normal text-muted-foreground">· Archivada</span> : null}</span></label>;
            })}
          </div>
        </section>
        {showViewSelection ? <section className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Vista inicial</p>
          <div className="grid grid-cols-3 rounded-xl border bg-muted/25 p-1">{viewOptions.map((option) => <button key={option.value} type="button" aria-pressed={draftView === option.value} className={cn("min-h-11 rounded-lg px-1 text-xs font-medium", draftView === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground")} onClick={() => setDraftView(option.value)}>{option.label}</button>)}</div>
        </section> : null}
      </div>
    </ResponsiveDialog>
  </>;
}
