import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ComparisonInsights } from "@/components/progress/comparison-insights";
import { formatProgressMetricValue } from "@/lib/progress/analytics";
import {
  comparisonInsufficientMessage,
  type ProgressComparisonMetricResult,
  type ProgressComparisonReport,
} from "@/lib/progress/comparisons";
import { buildNutritionReportDayHighlights } from "@/lib/nutrition/report-v2";
import type { NutritionReportDay, NutritionReportSummary } from "@/lib/nutrition/reports-core";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function resultFor(report: ProgressComparisonReport, key: string) {
  return report.results.find((result) => result.metric.key === key) ?? null;
}

function signedDelta(result: ProgressComparisonMetricResult) {
  if (result.deltaAbsolute === null) return null;
  const sign = result.deltaAbsolute > 0 ? "+" : result.deltaAbsolute < 0 ? "−" : "";
  return `${sign}${formatProgressMetricValue(Math.abs(result.deltaAbsolute), result.metric)}`;
}

function comparisonDetail(result: ProgressComparisonMetricResult | null) {
  if (!result) return null;
  if (result.eligibility.status !== "comparable") return comparisonInsufficientMessage(result.eligibility);
  const delta = signedDelta(result);
  return `vs. ${result.formattedValueB}${delta ? ` · ${delta}` : ""}`;
}

function formatValue(value: number | null, unit: string, digits = 1) {
  if (value === null) return "—";
  return `${digits === 0 ? integer.format(value) : decimal.format(value)} ${unit}`;
}

function EnergyCell({
  label,
  value,
  detail,
  className = "",
}: {
  label: string;
  value: string;
  detail?: string | null;
  className?: string;
}) {
  return <div className={`min-w-0 bg-card px-3 py-3 ${className}`}>
    <dt className="text-xs text-muted-foreground">{label}</dt>
    <dd className="metric-number mt-1 text-lg font-semibold tracking-tight">{value}</dd>
    {detail ? <dd className="mt-1 text-xs text-muted-foreground">{detail}</dd> : null}
  </div>;
}

export function NutritionFindings({ report }: { report: ProgressComparisonReport }) {
  const hasReliableMetric = report.results.some((result) => (
    result.eligibility.status === "comparable" && result.insightEligible
  ));
  return <section className="space-y-3" aria-labelledby="nutrition-findings-title">
    <div>
      <h2 id="nutrition-findings-title" className="text-lg font-semibold tracking-tight">Qué cambió</h2>
      <p className="mt-1 text-sm text-muted-foreground">Cambios descriptivos frente a la referencia activa.</p>
    </div>
    {report.insights.length ? <ComparisonInsights report={report} /> : <p className="rounded-xl border bg-card px-4 py-5 text-sm text-muted-foreground">
      {hasReliableMetric
        ? "No hubo cambios relevantes en las métricas principales."
        : "No hay suficiente cobertura para destacar cambios confiables."}
    </p>}
  </section>;
}

export function NutritionEnergySummary({
  summary,
  comparison,
}: {
  summary: NutritionReportSummary;
  comparison: ProgressComparisonReport;
}) {
  const calories = resultFor(comparison, "nutrition.calories");
  const expenditure = resultFor(comparison, "nutrition.expenditure");
  const balance = resultFor(comparison, "nutrition.energy_balance");

  return <section className="space-y-3" aria-labelledby="nutrition-energy-title">
    <div>
      <h2 id="nutrition-energy-title" className="text-lg font-semibold tracking-tight">Energía</h2>
      <p className="mt-1 text-sm text-muted-foreground">Consumo, referencia y gasto se mantienen como conceptos distintos.</p>
    </div>
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border">
      <EnergyCell label="Consumo promedio" value={calories?.formattedValueA ?? formatValue(summary.calories.averageConsumed, "kcal", 0)} detail={comparisonDetail(calories)} />
      {summary.calories.averageTarget !== null ? <EnergyCell label="Objetivo del período" value={formatValue(summary.calories.averageTarget, "kcal", 0)} detail="Referencia histórica registrada" /> : null}
      {summary.energy.averageExpenditure !== null ? <EnergyCell label="Gasto estimado" value={expenditure?.formattedValueA ?? formatValue(summary.energy.averageExpenditure, "kcal", 0)} detail={comparisonDetail(expenditure)} /> : null}
      {summary.energy.averageBalance !== null ? <EnergyCell label="Balance promedio" value={formatValue(summary.energy.averageBalance, "kcal", 0)} detail="por día calculable" /> : null}
      {summary.energy.accumulatedBalance !== null ? <EnergyCell label="Balance acumulado" value={balance?.formattedValueA ?? formatValue(summary.energy.accumulatedBalance, "kcal", 0)} detail={comparisonDetail(balance)} className="col-span-2" /> : null}
    </dl>
    <p className="text-xs text-muted-foreground">Balance energético = consumo − gasto estimado. No es la diferencia contra el objetivo calórico.</p>
  </section>;
}

export function NutritionMacroSummary({
  summary,
  comparison,
}: {
  summary: NutritionReportSummary;
  comparison: ProgressComparisonReport;
}) {
  const rows = [
    { key: "nutrition.protein", label: "Proteína", value: summary.protein.averageConsumed, recorded: resultFor(comparison, "nutrition.protein")?.primary.coverage.registeredCount ?? 0 },
    { key: "nutrition.carbs", label: "Carbohidratos", value: summary.carbs.averageConsumed, recorded: summary.carbs.recordedDays },
    { key: "nutrition.fat", label: "Grasas", value: summary.fat.averageConsumed, recorded: summary.fat.recordedDays },
  ];

  return <section className="space-y-3" aria-labelledby="nutrition-macros-title">
    <div>
      <h2 id="nutrition-macros-title" className="text-lg font-semibold tracking-tight">Macronutrientes</h2>
      <p className="mt-1 text-sm text-muted-foreground">Promedio diario de días terminados con registro.</p>
    </div>
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {rows.map((row) => {
        const result = resultFor(comparison, row.key);
        return <div key={row.key} className="flex min-h-16 items-center justify-between gap-4 px-3 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{row.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{comparisonDetail(result) ?? `${row.recorded} días registrados`}</p>
            {row.key === "nutrition.protein" && summary.protein.averageTarget !== null
              ? <p className="mt-0.5 text-xs text-muted-foreground">Objetivo del período {formatValue(summary.protein.averageTarget, "g")} · {summary.protein.hitDays}/{summary.protein.comparableDays} días alcanzados</p>
              : null}
          </div>
          <p className="metric-number shrink-0 text-lg font-semibold">{formatValue(row.value, "g")}</p>
        </div>;
      })}
    </div>
  </section>;
}

export function NutritionCoverage({
  comparison,
  currentDayRegistered,
}: {
  comparison: ProgressComparisonReport;
  currentDayRegistered: boolean;
}) {
  const keys = ["nutrition.calories", "nutrition.protein", "nutrition.energy_balance"];
  const rows = keys.flatMap((key) => {
    const result = resultFor(comparison, key);
    if (!result) return [];
    const coverage = result.primary.coverage;
    return [{
      key,
      label: key === "nutrition.calories" ? "Días con calorías" : key === "nutrition.protein" ? "Días con proteína" : "Balance calculable",
      registered: coverage.registeredCount,
      eligible: coverage.eligibleCount,
    }];
  });
  if (!rows.length) return null;

  return <section className="space-y-3" aria-labelledby="nutrition-coverage-title">
    <div>
      <h2 id="nutrition-coverage-title" className="text-lg font-semibold tracking-tight">Consistencia y cobertura</h2>
      <p className="mt-1 text-sm text-muted-foreground">Los días sin dato no se convierten en cero.</p>
    </div>
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {rows.map((row) => <div key={row.key} className="flex min-h-12 items-center justify-between gap-3 px-3 py-2.5">
        <p className="text-sm">{row.label}</p>
        <p className="metric-number text-sm font-semibold">{row.registered}{row.eligible === null ? " observaciones" : ` / ${row.eligible} días`}</p>
      </div>)}
    </div>
    {currentDayRegistered ? <p className="text-xs text-muted-foreground">Hoy figura como “En curso” en el detalle y no modifica estos promedios de días terminados.</p> : null}
  </section>;
}

function highlightDescription(highlight: ReturnType<typeof buildNutritionReportDayHighlights>[number]) {
  const day = highlight.day;
  if (highlight.kind === "closest_target") {
    const deviation = Math.round(day.targetDeviationKcal!);
    if (deviation < 0) return `${integer.format(Math.abs(deviation))} kcal bajo el objetivo`;
    if (deviation > 0) return `${integer.format(deviation)} kcal sobre el objetivo`;
    return "En el objetivo exacto";
  }
  if (highlight.kind === "highest_protein") return `${formatValue(day.proteinG, "g")} de proteína`;
  const balance = Math.round(day.energyBalanceKcal!);
  if (balance < 0) return `Déficit estimado de ${integer.format(Math.abs(balance))} kcal`;
  if (balance > 0) return `Superávit estimado de ${integer.format(balance)} kcal`;
  return "Balance energético estimado de 0 kcal";
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(" de ", " ")
    .replace(".", "");
}

export function NutritionHighlightedDays({ days }: { days: readonly NutritionReportDay[] }) {
  const highlights = buildNutritionReportDayHighlights(days);
  if (!highlights.length) return null;
  return <section className="space-y-3" aria-labelledby="nutrition-highlighted-days-title">
    <div>
      <h2 id="nutrition-highlighted-days-title" className="text-lg font-semibold tracking-tight">Días que explican el período</h2>
      <p className="mt-1 text-sm text-muted-foreground">Hitos descriptivos entre los días terminados.</p>
    </div>
    <div className="divide-y overflow-hidden rounded-xl border bg-card">
      {highlights.map((highlight) => <Link key={highlight.kind} href={`/history?date=${highlight.day.date}`} className="group flex min-h-14 items-center gap-3 px-3 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{highlight.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(highlight.day.date)} · {highlightDescription(highlight)}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
      </Link>)}
    </div>
  </section>;
}
