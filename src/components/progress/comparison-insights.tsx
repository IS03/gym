import type { ProgressComparisonReport } from "@/lib/progress/comparisons";

export function ComparisonInsights({ report }: { report: ProgressComparisonReport }) {
  if (!report.insights.length) {
    const hasInsufficient = report.results.some((result) => result.eligibility.status !== "comparable" || !result.insightEligible);
    return <div className="rounded-xl border bg-card px-4 py-5 text-sm text-muted-foreground">
      {hasInsufficient
        ? "No hay suficiente cobertura para destacar cambios confiables. Revisá el resumen para ver el detalle por métrica."
        : "No hubo cambios relevantes en las métricas seleccionadas."}
    </div>;
  }

  return <ol className="divide-y overflow-hidden rounded-xl border bg-card">
    {report.insights.map((insight) => <li key={insight.metricKey} className="px-4 py-3.5">
      <p className="text-sm font-semibold">{insight.title}</p>
      <p className="metric-number mt-1 text-sm text-muted-foreground">{insight.description}</p>
    </li>)}
  </ol>;
}
