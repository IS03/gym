import {
  comparisonCoverageLabel,
  comparisonInsufficientMessage,
  type ProgressComparisonMetricResult,
  type ProgressComparisonReport,
} from "@/lib/progress/comparisons";
import { formatProgressMetricValue } from "@/lib/progress/analytics";

const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1, signDisplay: "always" });

function deltaLabel(result: ProgressComparisonMetricResult) {
  if (result.eligibility.status !== "comparable" || result.deltaAbsolute === null) return "—";
  if (result.deltaPercent !== null) return `${percent.format(result.deltaPercent)}%`;
  const value = formatProgressMetricValue(Math.abs(result.deltaAbsolute), result.metric);
  if (result.deltaAbsolute === 0) return value;
  return `${result.deltaAbsolute > 0 ? "+" : "−"}${value}`;
}

function Coverage({ result }: { result: ProgressComparisonMetricResult }) {
  if (result.eligibility.status !== "comparable") {
    return <p className="mt-2 text-xs text-muted-foreground">{comparisonInsufficientMessage(result.eligibility)}</p>;
  }
  const referenceCoverage = result.reference.type === "period"
    ? comparisonCoverageLabel(result.reference.analysis)
    : result.reference.goal.source === "current_reference"
      ? "Referencia actual"
      : `${result.reference.goal.sampleSize} objetivos históricos disponibles`;
  return <p className="mt-2 text-xs text-muted-foreground">
    {comparisonCoverageLabel(result.primary)} · {referenceCoverage}
    {result.reference.type === "goal" && result.reference.goal.hitCount !== null
      ? ` · ${result.reference.goal.hitCount} de ${result.reference.goal.comparableCount} registros alcanzaron el objetivo`
      : ""}
  </p>;
}

export function ComparisonSummary({ report }: { report: ProgressComparisonReport }) {
  return <div className="overflow-hidden rounded-xl border bg-card">
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-2 border-b bg-muted/30 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      <span>Métrica</span><span>Principal</span><span>Referencia</span><span>Cambio</span>
    </div>
    <div className="divide-y">
      {report.results.map((result) => <div key={result.metric.key} className="px-3 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-baseline gap-2 text-right">
          <p className="truncate text-left text-xs font-medium">{result.metric.label}</p>
          <p className="metric-number text-xs">{result.formattedValueA}</p>
          <p className="metric-number text-xs text-muted-foreground">{result.formattedValueB}</p>
          <p className="metric-number text-xs font-semibold">{deltaLabel(result)}</p>
        </div>
        <Coverage result={result} />
      </div>)}
    </div>
  </div>;
}
