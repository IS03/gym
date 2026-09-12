"use client";

import { useRouter } from "next/navigation";
import { CalendarRange, ChevronDown } from "lucide-react";
import { useState, useTransition } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRangeValue } from "@/lib/calendar/date-range";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import { nutritionReportPath, type NutritionReportComparisonMode } from "@/lib/nutrition/report-navigation";
import { NUTRITION_REPORT_MAX_DAYS, previousNutritionReportRange, type NutritionReportPreset } from "@/lib/nutrition/reports-core";
import { cn } from "@/lib/utils";

const presets: Array<{ period: Exclude<NutritionReportPreset, "custom">; label: string }> = [
  { period: "7", label: "Semana" },
  { period: "14", label: "2 semanas" },
  { period: "30", label: "Mes" },
  { period: "3m", label: "3 meses" },
  { period: "6m", label: "6 meses" },
  { period: "1y", label: "1 año" },
];

type Props = {
  preset: NutritionReportPreset;
  start: string;
  end: string;
  today: string;
  rangeLabel: string;
  basePath?: string;
  comparison?: NutritionReportComparisonMode;
  query?: Record<string, string | undefined>;
  compact?: boolean;
};

export function NutritionReportPeriodSelector({ preset, start, end, today, rangeLabel, basePath = "/today/reports", comparison = null, query, compact = false }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRangeValue>({ start, end });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function navigate(href: string) {
    setCustomOpen(false);
    startTransition(() => router.push(href));
  }

  function submitCustomRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customRange.start || !customRange.end) return;
    setCustomOpen(false);
    navigate(nutritionReportPath({
      preset: "custom",
      start: customRange.start,
      end: customRange.end,
      comparison,
      basePath,
      query,
    }));
  }

  if (compact) {
    const label = preset === "custom" ? "Rango personalizado" : presets.find((option) => option.period === preset)?.label ?? "Período";
    const previous = previousNutritionReportRange({ start, end });
    const comparisonLabel = comparison === "goal"
      ? "vs. objetivo"
      : comparison === "period"
        ? "vs. otro período"
        : `vs. ${formatNutritionReportRange(previous.start, previous.end)}`;
    return <>
      <button type="button" onClick={() => { setCustomRange({ start, end }); setCustomOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-xl border bg-card px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-expanded={customOpen} aria-busy={isPending}>
        <CalendarRange className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{label}</span>
          <span className="block truncate text-xs text-muted-foreground">{rangeLabel} · {comparisonLabel}</span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      <ResponsiveDialog open={customOpen} onOpenChange={setCustomOpen} title="Período de nutrición" description="Los períodos y su referencia se resuelven con el motor común de Progreso." closeLabel="Cerrar selector de período">
        <div className="divide-y overflow-hidden rounded-xl border bg-card">
          {presets.map((option) => <button key={option.period} type="button" onClick={() => navigate(nutritionReportPath({ preset: option.period, start, end, comparison, basePath, query }))} aria-current={option.period === preset ? "page" : undefined} className={cn("flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm font-medium", option.period === preset && "bg-primary/8 text-primary")} disabled={isPending}>
            <span>{option.label}</span>
            {option.period === preset ? <span className="text-xs">Actual</span> : null}
          </button>)}
        </div>
        <form className="mt-4 space-y-3" onSubmit={submitCustomRange}>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">Rango personalizado</p>
          <input type="hidden" name="period" value="custom" />
          <DateRangePicker value={customRange} onChange={setCustomRange} today={today} maxDays={NUTRITION_REPORT_MAX_DAYS} />
          <Button type="submit" className="h-11 w-full" disabled={!customRange.start || !customRange.end || isPending}>Aplicar rango</Button>
        </form>
      </ResponsiveDialog>
    </>;
  }

  return (
    <>
      <div className="space-y-1.5" aria-busy={isPending}>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Período del reporte">
        {presets.map((option) => (
          <Button
            type="button"
            key={option.period}
            variant={preset === option.period ? "default" : "outline"}
            size="sm"
            className="h-10 shrink-0 px-3 text-[13px]"
            aria-pressed={preset === option.period}
            disabled={isPending}
            onClick={() => navigate(nutritionReportPath({
              preset: option.period,
              start,
              end,
              comparison,
              basePath,
              query,
            }))}
          >
            {option.label}
          </Button>
        ))}
        <Button
          type="button"
          variant={preset === "custom" ? "default" : "outline"}
          size="sm"
          className="h-10 shrink-0 px-3 text-[13px]"
          onClick={() => {
            setCustomRange({ start, end });
            setCustomOpen(true);
          }}
          aria-expanded={customOpen}
          aria-pressed={preset === "custom"}
          disabled={isPending}
        >
          Personalizado
        </Button>
        </div>
        <div className="flex min-h-5 items-center gap-2 text-xs">
          <p className="font-medium text-foreground">{rangeLabel}</p>
          <span className="text-muted-foreground" role="status" aria-live="polite">{isPending ? "Actualizando…" : ""}</span>
        </div>
      </div>
      <ResponsiveDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        title="Período personalizado"
        description="Elegí el rango que querés analizar."
        closeLabel="Cerrar período personalizado"
      >
        <form className="space-y-4" onSubmit={submitCustomRange}>
          <input type="hidden" name="period" value="custom" />
          <DateRangePicker
            value={customRange}
            onChange={setCustomRange}
            today={today}
            maxDays={NUTRITION_REPORT_MAX_DAYS}
          />
          <p className="text-xs text-muted-foreground">Máximo 366 días. Las fechas futuras se excluyen.</p>
          <Button type="submit" className="h-11 w-full" disabled={!customRange.start || !customRange.end}>Aplicar período</Button>
        </form>
      </ResponsiveDialog>
    </>
  );
}
