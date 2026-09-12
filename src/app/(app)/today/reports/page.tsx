import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { NutritionReportDailyBreakdown } from "@/components/nutrition/nutrition-report-daily-breakdown";
import { NutritionReportEvolutionV2 } from "@/components/nutrition/nutrition-report-evolution-v2";
import {
  NutritionCoverage,
  NutritionEnergySummary,
  NutritionFindings,
  NutritionHighlightedDays,
  NutritionMacroSummary,
} from "@/components/nutrition/nutrition-report-overview";
import { NutritionReportPeriodSelector } from "@/components/nutrition/nutrition-report-period-selector";
import { ComparisonConfigurator } from "@/components/progress/comparison-configurator";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import {
  nutritionReportComparisonMode,
  withDefaultNutritionComparison,
} from "@/lib/nutrition/report-navigation";
import { getNutritionReportWithProgressComparison } from "@/lib/nutrition/reports";
import { NUTRITION_PROGRESS_METRICS } from "@/lib/progress/analytics";
import { parseProgressComparisonQuery, progressComparisonQueryParams } from "@/lib/progress/comparisons";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";

export const dynamic = "force-dynamic";

export default async function NutritionReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const value = (key: string) => typeof sp[key] === "string" ? sp[key] as string : undefined;
  const today = todayInCordoba();
  const progressQuery = withDefaultNutritionComparison(parseProgressComparisonQuery(sp));
  const comparisonMode = nutritionReportComparisonMode(value("compare")) ?? "previous";
  const reportInput = {
    period: value("period"),
    from: value("from"),
    to: value("to"),
  };
  const report = await getNutritionReportWithProgressComparison({
    ...reportInput,
    comparison: progressQuery,
  }, today);
  const { range, days, summary } = report;
  const progressComparison = report.progressComparison;
  const comparisonOptions = NUTRITION_PROGRESS_METRICS
    .filter((metric) => metric.key !== "nutrition.calorie_target")
    .map((metric) => ({
      key: metric.key,
      label: metric.key === "nutrition.calories" ? "Calorías" : metric.label,
      supportsGoal: metric.supportsGoal,
    }));
  const referencePeriod = progressComparison?.reference.type === "goal" ? null : progressComparison?.reference.period ?? null;

  return <div className="space-y-6">
    <header className="space-y-3">
      <Link href="/today" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Nutrición
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Progreso de nutrición</h1>
        <p className="mt-1 text-sm text-muted-foreground">Análisis histórico · solo lectura</p>
      </div>
    </header>

    <section className="space-y-3" aria-label="Período y comparación">
      <NutritionReportPeriodSelector
        preset={range.preset}
        start={range.start}
        end={range.end}
        today={today}
        rangeLabel={formatNutritionReportRange(range.start, range.end)}
        comparison={comparisonMode}
        query={progressComparisonQueryParams(progressQuery)}
        compact
      />
      <ComparisonConfigurator
        metrics={comparisonOptions}
        primaryPeriod={range}
        today={today}
        selectedMetricKeys={progressComparison?.selectedMetricKeys ?? progressQuery.selectedMetricKeys}
        referenceType={progressQuery.referenceType}
        referencePreset={progressQuery.referencePreset}
        referencePeriod={referencePeriod}
        initialView={progressQuery.initialView}
        activeMetricKey={progressComparison?.activeMetricKey ?? progressQuery.activeMetricKey}
        triggerLabel="Comparar"
        showViewSelection={false}
      />
      {range.error ? <p className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{range.error} Se muestran los últimos 7 días.</p> : null}
      {report.comparisonError ? <p className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{report.comparisonError}</p> : null}
    </section>

    {progressComparison ? <>
      <NutritionFindings report={progressComparison} />
      <NutritionEnergySummary summary={summary} comparison={progressComparison} />
      <NutritionMacroSummary summary={summary} comparison={progressComparison} />
      <NutritionReportEvolutionV2 report={progressComparison} />
      <NutritionCoverage comparison={progressComparison} currentDayRegistered={summary.currentDayRegistered} />
    </> : <p className="rounded-xl border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">No fue posible resolver la referencia de comparación.</p>}

    <NutritionHighlightedDays days={days} />
    <NutritionReportDailyBreakdown days={days} summary={summary} />
  </div>;
}
