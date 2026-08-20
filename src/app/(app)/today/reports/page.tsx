import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getNutritionReport } from "@/lib/nutrition/reports";
import type { NutritionReportDay, NutritionReportPreset } from "@/lib/nutrition/reports-core";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { NutritionReportCharts } from "@/components/nutrition/nutrition-report-charts";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

const filters: Array<{ period: Exclude<NutritionReportPreset, "custom">; label: string }> = [
  { period: "7", label: "7 días" },
  { period: "14", label: "14 días" },
  { period: "30", label: "30 días" },
  { period: "month", label: "Este mes" },
];

function formatValue(value: number | null, unit: string, integer = false) {
  if (value === null) return "—";
  return `${integer ? integerFormatter.format(value) : numberFormatter.format(value)} ${unit}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
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
  if (rounded < 0) return `Déficit estimado: ${Math.abs(rounded)} kcal`;
  if (rounded > 0) return `Superávit estimado: ${rounded} kcal`;
  return "Balance estimado: 0 kcal";
}

function dailyBalanceLabel(value: number | null) {
  if (value === null) return null;
  const rounded = Math.round(value);
  if (rounded < 0) return `Déficit ${Math.abs(rounded)} kcal`;
  if (rounded > 0) return `Superávit ${rounded} kcal`;
  return "Balance 0 kcal";
}

function DailyRow({ day }: { day: NutritionReportDay }) {
  const balance = dailyBalanceLabel(day.energyBalanceKcal);
  return (
    <Link href={`/history?date=${day.date}`} className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <Card size="sm" className="surface-elevated transition-[transform,background-color] duration-150 group-hover:bg-muted/35 group-active:scale-[0.995]">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold capitalize">{formatDate(day.date)}</p>
                {day.isToday ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">En curso</span> : null}
                {day.imported ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Histórico</span> : null}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{day.date}</p>
            </div>
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </div>

          {!day.hasNutrition ? (
            <p className="rounded-lg bg-muted/45 px-3 py-2 text-sm text-muted-foreground">Sin registro nutricional</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <div>
                <p className="text-[11px] text-muted-foreground">Calorías</p>
                <p className="metric-number font-semibold">
                  {formatValue(day.calories, "kcal", true)}
                  {day.targetCalories === null ? "" : ` / ${integerFormatter.format(day.targetCalories)}`}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Proteína</p>
                <p className="metric-number font-semibold">
                  {formatValue(day.proteinG, "g")}
                  {day.targetProteinG === null ? "" : ` / ${numberFormatter.format(day.targetProteinG)}`}
                </p>
              </div>
              {day.expenditureKcal !== null ? <div><p className="text-[11px] text-muted-foreground">Gasto estimado</p><p className="font-medium">{formatValue(day.expenditureKcal, "kcal", true)}</p></div> : null}
              {balance ? <div><p className="text-[11px] text-muted-foreground">Balance energético</p><p className="font-medium">{balance}</p></div> : null}
            </div>
          )}

          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground">
            {day.hasCompletedWorkout ? <span>Entrenamiento: Sí</span> : day.gymEffective ? <span>Gym: Sí · corrección</span> : day.dayLogId ? <span>Entrenamiento: No</span> : null}
            {day.workEffective !== null ? <span>Trabajo: {day.workEffective ? "Sí" : "No"}</span> : null}
            {day.steps !== null ? <span>{integerFormatter.format(day.steps)} pasos</span> : null}
            {day.waterL !== null ? <span>{numberFormatter.format(day.waterL)} L agua</span> : null}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
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

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/today" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Nutrición
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Reportes de nutrición</h1>
          <p className="mt-1 text-sm text-muted-foreground">{range.start} al {range.end} · sólo lectura</p>
        </div>
      </header>

      <Card>
        <CardContent className="space-y-4 pt-1">
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filters.map((filter) => (
              <Link
                key={filter.period}
                href={`/today/reports?period=${filter.period}`}
                className={cn(
                  buttonVariants({ variant: range.preset === filter.period ? "default" : "outline", size: "sm" }),
                  "shrink-0 rounded-full",
                )}
              >
                {filter.label}
              </Link>
            ))}
          </div>
          <form action="/today/reports" className="grid grid-cols-2 gap-2 border-t pt-4 sm:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="period" value="custom" />
            <label className="space-y-1 text-xs text-muted-foreground">Desde<input className="h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" name="from" defaultValue={range.preset === "custom" ? range.start : ""} max={today} required /></label>
            <label className="space-y-1 text-xs text-muted-foreground">Hasta<input className="h-10 w-full rounded-md border bg-background px-2 text-sm text-foreground" type="date" name="to" defaultValue={range.preset === "custom" ? range.end : today} required /></label>
            <Button type="submit" variant="outline" className="col-span-2 h-10 sm:col-span-1 sm:self-end">Aplicar</Button>
          </form>
          <p className="text-xs text-muted-foreground">Período personalizado: máximo 366 días. Las fechas futuras se excluyen.</p>
          {range.error ? <p className="rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">{range.error} Se muestran los últimos 7 días.</p> : null}
        </CardContent>
      </Card>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Resumen del período">
        <Card className="surface-elevated">
          <CardHeader className="pb-1"><CardTitle>Calorías y objetivo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><p className="text-xs text-muted-foreground">Promedio consumido</p><p className="metric-number text-3xl font-semibold tracking-tight">{formatValue(summary.calories.averageConsumed, "kcal", true)}</p></div>
            <div className="grid grid-cols-2 gap-4 border-t pt-3">
              <div><p className="text-xs text-muted-foreground">Objetivo promedio</p><p className="metric-number mt-1 font-semibold">{formatValue(summary.calories.averageTarget, "kcal", true)}</p></div>
              <div><p className="text-xs text-muted-foreground">Desviación promedio</p><p className="mt-1 font-semibold">{targetDeviationLabel(summary.calories.averageTargetDeviation)}</p></div>
            </div>
            <p className="text-xs text-muted-foreground">Bajo: {summary.calories.belowTargetDays} · Exacto: {summary.calories.exactTargetDays} · Sobre: {summary.calories.aboveTargetDays} · {summary.calories.comparableDays} días comparables</p>
          </CardContent>
        </Card>

        <Card className="surface-elevated">
          <CardHeader className="pb-1"><CardTitle>Gasto y balance energético</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div><p className="text-xs text-muted-foreground">Balance acumulado estimado</p><p className="metric-number text-2xl font-semibold tracking-tight">{energyBalanceLabel(summary.energy.accumulatedBalance)}</p></div>
            <div className="border-t pt-3"><p className="text-xs text-muted-foreground">Gasto estimado promedio</p><p className="metric-number mt-1 font-semibold">{formatValue(summary.energy.averageExpenditure, "kcal", true)}</p></div>
            <p className="text-xs text-muted-foreground">Balance = consumo − gasto. No es la desviación contra el objetivo. {summary.energy.comparableDays} días comparables.</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader className="pb-1"><CardTitle>Macros, hidratación y actividad</CardTitle></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Macros</p>
            <div><p className="text-xs text-muted-foreground">Proteína promedio / objetivo</p><p className="metric-number font-semibold">{formatValue(summary.protein.averageConsumed, "g")} / {formatValue(summary.protein.averageTarget, "g")}</p><p className="text-xs text-muted-foreground">{summary.protein.hitDays} de {summary.protein.comparableDays} días alcanzaron el objetivo</p></div>
            <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Carbos promedio</p><p className="metric-number font-semibold">{formatValue(summary.carbs.averageConsumed, "g")}</p></div><div><p className="text-xs text-muted-foreground">Grasas promedio</p><p className="metric-number font-semibold">{formatValue(summary.fat.averageConsumed, "g")}</p></div></div>
          </section>
          <section className="space-y-3 border-t pt-4 sm:border-t-0 sm:border-l sm:pl-5 sm:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Hidratación</p>
            <div><p className="text-xs text-muted-foreground">Agua promedio / objetivo</p><p className="metric-number font-semibold">{formatValue(summary.hydration.averageWaterL, "L")} / {formatValue(summary.hydration.averageTargetL, "L")}</p></div>
            <p className="text-xs text-muted-foreground">{summary.hydration.hitDays} de {summary.hydration.comparableDays} días con datos alcanzaron el objetivo. El mate se mantiene separado.</p>
          </section>
          <section className="space-y-3 border-t pt-4 lg:border-t-0 lg:border-l lg:pl-5 lg:pt-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Actividad</p>
            <div><p className="text-xs text-muted-foreground">Pasos promedio</p><p className="metric-number font-semibold">{formatValue(summary.activity.averageSteps, "pasos", true)}</p><p className="text-xs text-muted-foreground">Sólo {summary.activity.stepDays} días con dato</p></div>
            <div className="grid grid-cols-2 gap-3"><div><p className="text-xs text-muted-foreground">Entrenamientos</p><p className="metric-number text-lg font-semibold">{summary.activity.completedWorkoutDays}</p></div><div><p className="text-xs text-muted-foreground">Días trabajados</p><p className="metric-number text-lg font-semibold">{summary.activity.workedDays}</p></div></div>
          </section>
        </CardContent>
      </Card>

      <NutritionReportCharts days={days} />

      <section className="space-y-3" aria-labelledby="daily-breakdown-title">
        <div className="flex items-end justify-between gap-3">
          <div><h2 id="daily-breakdown-title" className="text-lg font-semibold tracking-tight">Desglose diario</h2><p className="text-xs text-muted-foreground">{summary.completedRegisteredDays} días terminados con nutrición · {summary.registeredDays} registrados en total{summary.currentDayRegistered ? " · hoy en curso" : ""}</p></div>
        </div>
        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
          {days.map((day) => <DailyRow key={day.date} day={day} />)}
        </div>
      </section>
    </div>
  );
}
