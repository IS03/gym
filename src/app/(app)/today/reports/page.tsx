import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { NutritionReportCharts } from "@/components/nutrition/nutrition-report-charts";
import { NutritionReportDailyBreakdown } from "@/components/nutrition/nutrition-report-daily-breakdown";
import { NutritionReportPeriodSelector } from "@/components/nutrition/nutrition-report-period-selector";
import { ComparisonConfigurator } from "@/components/progress/comparison-configurator";
import { ComparisonWorkspace } from "@/components/progress/comparison-workspace";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import {
  nutritionReportComparisonMode,
  nutritionReportCurrentPath,
  nutritionReportPreviousPath,
} from "@/lib/nutrition/report-navigation";
import { getNutritionReport, getNutritionReportWithProgressComparison } from "@/lib/nutrition/reports";
import { NUTRITION_PROGRESS_METRICS } from "@/lib/progress/analytics";
import { parseProgressComparisonQuery, progressComparisonQueryParams } from "@/lib/progress/comparisons";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function formatValue(value: number | null, unit: string, integer = false) {
  if (value === null) return "—";
  return `${integer ? integerFormatter.format(value) : numberFormatter.format(value)} ${unit}`;
}

function targetDeviationLabel(value: number | null) {
  if (value === null) return "Sin días comparables";
  const rounded = Math.round(value);
  if (rounded < 0) return `${Math.abs(rounded)} kcal bajo el objetivo`;
  if (rounded > 0) return `${rounded} kcal sobre el objetivo`;
  return "En el objetivo exacto";
}

function energyBalanceLabel(value: number | null) {
  if (value === null) return "Sin días comparables";
  const rounded = Math.round(value);
  if (rounded < 0) return `Déficit estimado ${Math.abs(rounded)} kcal`;
  if (rounded > 0) return `Superávit estimado ${rounded} kcal`;
  return "Balance estimado 0 kcal";
}

function SummaryStat({ label, value, detail, className = "" }: { label: string; value: string; detail?: string; className?: string }) {
  return <div className={`min-w-0 ${className}`}>
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="metric-number mt-1 text-lg font-semibold tracking-tight sm:text-xl">{value}</p>
    {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
  </div>;
}

export default async function NutritionReportsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const value = (key: string) => typeof sp[key] === "string" ? sp[key] as string : undefined;
  const today = todayInCordoba();
  const progressQuery = parseProgressComparisonQuery(sp);
  const comparisonMode = nutritionReportComparisonMode(value("compare"));
  const reportInput = {
    period: value("period"),
    from: value("from"),
    to: value("to"),
  };
  const comparisonReport = progressQuery.referenceType
    ? await getNutritionReportWithProgressComparison({ ...reportInput, comparison: progressQuery }, today)
    : null;
  const report = comparisonReport ?? await getNutritionReport(reportInput, today);
  const { range, days, summary } = report;
  const progressComparison = comparisonReport?.progressComparison ?? null;
  const comparisonOptions = NUTRITION_PROGRESS_METRICS
    .filter((metric) => metric.key !== "nutrition.calorie_target")
    .map((metric) => ({ key: metric.key, label: metric.label, supportsGoal: metric.supportsGoal }));
  const referencePeriod = progressComparison?.reference.type === "goal" ? null : progressComparison?.reference.period ?? null;

  return <div className="space-y-6">
    <header className="space-y-3">
      <Link href="/today" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Nutrición
      </Link>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Reportes de nutrición</h1>
        <p className="mt-1 text-sm text-muted-foreground">Solo lectura</p>
      </div>
    </header>

    <Card>
      <CardContent className="p-3 sm:p-4">
        <NutritionReportPeriodSelector
          preset={range.preset}
          start={range.start}
          end={range.end}
          today={today}
          rangeLabel={formatNutritionReportRange(range.start, range.end)}
          comparison={comparisonMode}
          query={progressComparisonQueryParams(progressQuery)}
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
        />
        {range.error ? <p className="mt-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{range.error} Se muestran los últimos 7 días.</p> : null}
        {comparisonReport?.comparisonError ? <p className="mt-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{comparisonReport.comparisonError}</p> : null}
      </CardContent>
    </Card>

    {progressComparison ? <ComparisonWorkspace key={`${progressComparison.reference.type}:${progressComparison.selectedMetricKeys.join(",")}:${progressComparison.initialView}:${progressComparison.activeMetricKey}`} report={progressComparison} currentHref={nutritionReportCurrentPath(range)} /> : null}

    <section className="space-y-3" aria-labelledby="nutrition-summary-title">
      <div>
        <h2 id="nutrition-summary-title" className="text-lg font-semibold tracking-tight">Resumen</h2>
        <p className="text-xs text-muted-foreground">Promedios y totales de días terminados.</p>
      </div>
      <Card className="surface-elevated">
        <CardContent className="space-y-4 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:divide-x">
            <SummaryStat label="Calorías promedio" value={formatValue(summary.calories.averageConsumed, "kcal", true)} detail={`Objetivo: ${formatValue(summary.calories.averageTarget, "kcal", true)}`} className="sm:pr-3" />
            <SummaryStat label="Balance acumulado" value={energyBalanceLabel(summary.energy.accumulatedBalance)} detail={`${summary.energy.comparableDays} días comparables`} className="sm:px-3" />
            <SummaryStat label="Proteína promedio" value={formatValue(summary.protein.averageConsumed, "g")} detail={`Objetivo: ${formatValue(summary.protein.averageTarget, "g")} · ${summary.protein.hitDays}/${summary.protein.comparableDays} días`} className="sm:pl-3" />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t pt-3 text-xs">
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">Bajo {summary.calories.belowTargetDays}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">Exacto {summary.calories.exactTargetDays}</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">Sobre {summary.calories.aboveTargetDays}</span>
            <span className="px-1 py-1 text-muted-foreground">{targetDeviationLabel(summary.calories.averageTargetDeviation)}</span>
          </div>
          <div className="flex flex-wrap gap-1.5 border-t pt-3 text-xs">
            <span className="rounded-full bg-primary/10 px-2 py-1 text-primary">Déficit {summary.energy.deficitDays}</span>
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">Neutro {summary.energy.neutralDays}</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">Superávit {summary.energy.surplusDays}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-4">
            <SummaryStat label="Carbos" value={formatValue(summary.carbs.averageConsumed, "g")} detail="promedio" />
            <SummaryStat label="Grasas" value={formatValue(summary.fat.averageConsumed, "g")} detail="promedio" />
            <SummaryStat label="Gasto estimado" value={formatValue(summary.energy.averageExpenditure, "kcal", true)} detail="promedio" />
            <SummaryStat label="Balance promedio" value={energyBalanceLabel(summary.energy.averageBalance)} detail="consumo − gasto" />
          </div>
          {summary.goalStages.length ? <p className="border-t pt-3 text-xs text-muted-foreground">Etapa{summary.goalStages.length === 1 ? "" : "s"} del período: <span className="font-medium text-foreground">{summary.goalStages.join(" · ")}</span></p> : null}
          <p className="text-xs text-muted-foreground">Balance = consumo − gasto. No es la desviación contra el objetivo.</p>
        </CardContent>
      </Card>
    </section>

    {progressComparison ? null : <NutritionReportCharts
      days={days}
      comparison={null}
      comparisonMode={null}
      currentHref={nutritionReportCurrentPath(range)}
      previousHref={nutritionReportPreviousPath(range)}
    />}

    <NutritionReportDailyBreakdown days={days} summary={summary} />
  </div>;
}
