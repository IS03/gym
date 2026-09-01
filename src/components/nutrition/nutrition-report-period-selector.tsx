"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import type { DateRangeValue } from "@/lib/calendar/date-range";
import { NUTRITION_REPORT_MAX_DAYS, type NutritionReportPreset } from "@/lib/nutrition/reports-core";

const presets: Array<{ period: Exclude<NutritionReportPreset, "custom">; label: string }> = [
  { period: "7", label: "7 días" },
  { period: "15", label: "15 días" },
  { period: "30", label: "30 días" },
  { period: "3m", label: "3 meses" },
  { period: "1y", label: "1 año" },
];

type Props = {
  preset: NutritionReportPreset;
  start: string;
  end: string;
  today: string;
  rangeLabel: string;
  basePath?: string;
};

export function NutritionReportPeriodSelector({ preset, start, end, today, rangeLabel, basePath = "/today/reports" }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customRange, setCustomRange] = useState<DateRangeValue>({ start, end });
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function navigate(href: string) {
    startTransition(() => router.push(href));
  }

  function submitCustomRange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customRange.start || !customRange.end) return;
    const params = new URLSearchParams({
      period: "custom",
      from: customRange.start,
      to: customRange.end,
    });
    setCustomOpen(false);
    navigate(`${basePath}?${params.toString()}`);
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
            onClick={() => navigate(`${basePath}?period=${option.period}`)}
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
