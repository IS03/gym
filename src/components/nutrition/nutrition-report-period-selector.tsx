"use client";

import Link from "next/link";
import { useState } from "react";

import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import type { NutritionReportPreset } from "@/lib/nutrition/reports-core";
import { cn } from "@/lib/utils";

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
};

export function NutritionReportPeriodSelector({ preset, start, end, today, rangeLabel }: Props) {
  const [customOpen, setCustomOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6" aria-label="Período del reporte">
        {presets.map((option) => (
          <Link
            key={option.period}
            href={`/today/reports?period=${option.period}`}
            className={cn(
              buttonVariants({ variant: preset === option.period ? "default" : "outline", size: "sm" }),
              "min-w-0 w-full px-1.5 text-center text-[13px] sm:px-2",
            )}
          >
            {option.label}
          </Link>
        ))}
        <Button
          type="button"
          variant={preset === "custom" ? "default" : "outline"}
          size="sm"
          className="min-w-0 w-full px-1.5 text-[13px] sm:px-2"
          onClick={() => setCustomOpen(true)}
          aria-expanded={customOpen}
        >
          Personalizado
        </Button>
      </div>
      <p className="text-sm font-medium text-foreground">{rangeLabel}</p>
      <ResponsiveDialog
        open={customOpen}
        onOpenChange={setCustomOpen}
        title="Período personalizado"
        description="Elegí el rango que querés analizar."
        closeLabel="Cerrar período personalizado"
      >
        <form action="/today/reports" className="space-y-4" onSubmit={() => setCustomOpen(false)}>
          <input type="hidden" name="period" value="custom" />
          <label className="block min-w-0 space-y-1 text-sm font-medium">
            Desde
            <DateField name="from" defaultValue={start} max={today} required />
          </label>
          <label className="block min-w-0 space-y-1 text-sm font-medium">
            Hasta
            <DateField name="to" defaultValue={end} max={today} required />
          </label>
          <p className="text-xs text-muted-foreground">Máximo 366 días. Las fechas futuras se excluyen.</p>
          <Button type="submit" className="h-11 w-full">Aplicar período</Button>
        </form>
      </ResponsiveDialog>
    </>
  );
}
