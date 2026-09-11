import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import type { ProgressComparisonReport } from "@/lib/progress/comparisons";

export function ComparisonPeriodPair({ report }: { report: ProgressComparisonReport }) {
  const reference = report.reference;
  return <div className="grid grid-cols-2 gap-2" aria-label="Contexto de la comparación">
    <div className="rounded-xl border border-primary/30 bg-primary/8 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Principal</p>
      <p className="mt-1 text-sm font-medium">{formatNutritionReportRange(report.primaryPeriod.start, report.primaryPeriod.end)}</p>
    </div>
    <div className="rounded-xl border bg-muted/25 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {reference.type === "goal" ? "Referencia" : "Comparación"}
      </p>
      <p className="mt-1 text-sm font-medium">{reference.type === "goal"
        ? reference.label
        : formatNutritionReportRange(reference.period.start, reference.period.end)}</p>
    </div>
  </div>;
}
