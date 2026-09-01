import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { NutritionReportCharts } from "@/components/nutrition/nutrition-report-charts";
import { NutritionReportDailyBreakdown } from "@/components/nutrition/nutrition-report-daily-breakdown";
import { NutritionReportPeriodSelector } from "@/components/nutrition/nutrition-report-period-selector";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import { getNutritionReport } from "@/lib/nutrition/reports";
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
  const { range, days, summary } = await getNutritionReport({
    period: value("period"),
    from: value("from"),
    to: value("to"),
  }, today);

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
        />
        {range.error ? <p className="mt-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{range.error} Se muestran los últimos 7 días.</p> : null}
      </CardContent>
    </Card>

    <section className="space-y-3" aria-labelledby="nutrition-summary-title">
      <div>
        <h2 id="nutrition-summary-title" className="text-lg font-semibold tracking-tight">Resumen</h2>
        <p className="text-xs text-muted-foreground">Promedios y totales de días terminados.</p>
      </div>
      <Card className="surface-elevated">
        <CardContent className="space-y-4 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:divide-x">
            <SummaryStat label="Calorías promedio" value={formatValue(summary.calories.averageConsumed, "kcal", true)} detail={`Objetivo: ${formatValue(summary.calories.averageTarget, "kcal", true)}`} className="sm:pr-3" />
            <SummaryStat label="Balance acumulado" value={energyBalanceLabel(summary.energy.accumulatedBalance)} detail={`Gasto promedio: ${formatValue(summary.energy.averageExpenditure, "kcal", true)}`} className="sm:px-3" />
            <SummaryStat label="Proteína promedio" value={formatValue(summary.protein.averageConsumed, "g")} detail={`Objetivo: ${formatValue(summary.protein.averageTarget, "g")} · ${summary.protein.hitDays}/${summary.protein.comparableDays} días`} className="sm:pl-3" />
          </div>
          <div className="flex flex-wrap gap-1.5 border-t pt-3 text-xs">
            <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">Bajo {summary.calories.belowTargetDays}</span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-300">Exacto {summary.calories.exactTargetDays}</span>
            <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">Sobre {summary.calories.aboveTargetDays}</span>
            <span className="px-1 py-1 text-muted-foreground">{targetDeviationLabel(summary.calories.averageTargetDeviation)}</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-3 sm:grid-cols-4 lg:grid-cols-6">
            <SummaryStat label="Agua" value={formatValue(summary.hydration.averageWaterL, "L")} detail={`${summary.hydration.hitDays}/${summary.hydration.comparableDays} con meta`} />
            <SummaryStat label="Pasos" value={formatValue(summary.activity.averageSteps, "pasos", true)} detail={`${summary.activity.stepDays} días con dato`} />
            <SummaryStat label="Entrenamientos" value={integerFormatter.format(summary.activity.completedWorkoutDays)} detail="sesiones terminadas" />
            <SummaryStat label="Trabajo" value={integerFormatter.format(summary.activity.workedDays)} detail="días trabajados" />
            <SummaryStat label="Carbos" value={formatValue(summary.carbs.averageConsumed, "g")} detail="promedio" />
            <SummaryStat label="Grasas" value={formatValue(summary.fat.averageConsumed, "g")} detail="promedio" />
          </div>
          <p className="text-xs text-muted-foreground">Balance = consumo − gasto. No es la desviación contra el objetivo. El mate se mantiene separado del agua.</p>
        </CardContent>
      </Card>
    </section>

    <NutritionReportCharts days={days} />

    <NutritionReportDailyBreakdown days={days} summary={summary} />
  </div>;
}
