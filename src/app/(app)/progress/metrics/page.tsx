import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";

import { DailyMetricReport } from "@/components/daily-metrics/daily-metric-report";
import { ComparisonConfigurator } from "@/components/progress/comparison-configurator";
import { NutritionReportPeriodSelector } from "@/components/nutrition/nutrition-report-period-selector";
import { Card, CardContent } from "@/components/ui/card";
import { getDailyMetricsReport } from "@/lib/daily-metrics/reports";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import { nutritionReportComparisonMode, nutritionReportCurrentPath, nutritionReportPreviousPath } from "@/lib/nutrition/report-navigation";
import { parseProgressComparisonQuery, progressComparisonQueryParams } from "@/lib/progress/comparisons";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { getVerifiedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DailyMetricsProgressPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const value = (key: string) => typeof sp[key] === "string" ? sp[key] as string : undefined;
  const auth = await getVerifiedRequestContext();
  if (!auth) redirect("/login");
  const today = todayInCordoba();
  const progressQuery = parseProgressComparisonQuery(sp);
  const comparisonMode = nutritionReportComparisonMode(value("compare"));
  const report = await getDailyMetricsReport({
    period: value("period"),
    from: value("from"),
    to: value("to"),
    metricId: value("metric"),
    compare: comparisonMode === "previous",
    progressComparison: progressQuery.referenceType ? progressQuery : null,
  }, today, auth);
  const query = { metric: report.metric?.id, ...progressComparisonQueryParams(progressQuery) };
  const metricQuery = { metric: report.metric?.id };
  const comparisonOptions = report.progressMetrics.map((metric) => ({
    key: metric.key,
    label: metric.label,
    supportsGoal: metric.supportsGoal,
    archived: metric.metadata?.isActive === false,
  }));
  const referencePeriod = report.progressComparison?.reference.type === "goal" ? null : report.progressComparison?.reference.period ?? null;

  return <div className="space-y-6">
    <header className="space-y-3">
      <Link href="/progress" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden /> Progreso</Link>
      <div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Métricas diarias</h1><p className="mt-1 text-sm text-muted-foreground">Historia, objetivos y tendencias de lo que registrás.</p></div>
    </header>
    <Card><CardContent className="p-3 sm:p-4">
      <NutritionReportPeriodSelector preset={report.range.preset} start={report.range.start} end={report.range.end} today={today} rangeLabel={formatNutritionReportRange(report.range.start, report.range.end)} basePath="/progress/metrics" comparison={comparisonMode} query={query} />
      <ComparisonConfigurator metrics={comparisonOptions} primaryPeriod={report.range} today={today} selectedMetricKeys={report.progressComparison?.selectedMetricKeys ?? progressQuery.selectedMetricKeys} referenceType={progressQuery.referenceType} referencePreset={progressQuery.referencePreset} referencePeriod={referencePeriod} initialView={progressQuery.initialView} activeMetricKey={report.progressComparison?.activeMetricKey ?? progressQuery.activeMetricKey} />
      {report.range.error ? <p className="mt-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{report.range.error}</p> : null}
      {report.comparisonError ? <p className="mt-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{report.comparisonError}</p> : null}
    </CardContent></Card>
    {report.metric && report.summary ? <DailyMetricReport
      definitions={report.definitions}
      metric={report.metric}
      days={report.days}
      summary={report.summary}
      comparison={report.comparison}
      progressComparison={report.progressComparison}
      currentHref={nutritionReportCurrentPath(report.range, { basePath: "/progress/metrics", query: metricQuery })}
      previousHref={nutritionReportPreviousPath(report.range, { basePath: "/progress/metrics", query: metricQuery })}
    /> : <Card><CardContent className="py-10 text-sm text-muted-foreground">Todavía no hay métricas disponibles para analizar.</CardContent></Card>}
  </div>;
}
