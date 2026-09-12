"use client";

import Link from "next/link";
import { CalendarRange, ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRangeValue } from "@/lib/calendar/date-range";
import { TRAINING_ANALYSIS_PERIODS, type TrainingAnalysis } from "@/lib/phase2/training-analysis";
import type { TrainingAnalysisView } from "@/lib/phase2/training-analysis-navigation";
import { PROGRESS_CUSTOM_RANGE_MAX_DAYS, type ProgressPeriodRange } from "@/lib/progress/analytics";
import type { ProgressTemporalComparisonReference } from "@/lib/progress/comparisons";
import { cn } from "@/lib/utils";

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Cordoba" })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

export function trainingProgressRangeLabel(range: ProgressPeriodRange) {
  return `${shortDate(range.start)}–${shortDate(range.end)}`;
}

export function TrainingProgressPeriodSelector({
  analysis,
  reference,
  today,
  view,
}: {
  analysis: TrainingAnalysis;
  reference: ProgressTemporalComparisonReference;
  today: string;
  view: TrainingAnalysisView;
}) {
  const [open, setOpen] = useState(false);
  const [draftRange, setDraftRange] = useState<DateRangeValue>({ start: analysis.range.start, end: analysis.range.end });
  const searchParams = useSearchParams();
  const hrefFor = (period: string) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", view);
    next.set("period", period);
    next.delete("from");
    next.delete("to");
    return `/train/progress?${next.toString()}`;
  };
  const customHref = draftRange.start && draftRange.end ? (() => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("view", view);
    next.set("period", "custom");
    next.set("from", draftRange.start!);
    next.set("to", draftRange.end!);
    return `/train/progress?${next.toString()}`;
  })() : null;

  return <>
    <button type="button" onClick={() => { setDraftRange({ start: analysis.range.start, end: analysis.range.end }); setOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={open}>
      <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{analysis.range.label}</span><span className="block truncate text-xs text-muted-foreground">{trainingProgressRangeLabel(analysis.range)} · vs. {trainingProgressRangeLabel(reference.period)}</span></span>
      <ChevronRight className="size-4 shrink-0 rotate-90 text-muted-foreground" aria-hidden />
    </button>
    <ResponsiveDialog open={open} onOpenChange={setOpen} title="Período de entrenamiento" description="El período de comparación se resuelve con el motor común de Progreso." closeLabel="Cerrar selector de período">
      <div className="divide-y overflow-hidden rounded-xl border bg-card">
        {TRAINING_ANALYSIS_PERIODS.map((period) => <Link key={period.value} href={hrefFor(period.value)} onClick={() => setOpen(false)} aria-current={period.value === analysis.period ? "page" : undefined} className={cn("flex min-h-11 items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium", period.value === analysis.period && "bg-primary/8 text-primary")}><span>{period.label}</span>{period.value === analysis.period ? <span className="text-xs">Actual</span> : null}</Link>)}
      </div>
      <div className="mt-4 space-y-3"><p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rango personalizado</p><DateRangePicker value={draftRange} onChange={setDraftRange} today={today} maxDays={PROGRESS_CUSTOM_RANGE_MAX_DAYS} fromName="from" toName="to" />{customHref ? <Link href={customHref} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground">Aplicar rango</Link> : <span className="flex min-h-11 items-center justify-center rounded-xl bg-muted px-4 text-sm text-muted-foreground">Elegí ambas fechas</span>}</div>
    </ResponsiveDialog>
  </>;
}
