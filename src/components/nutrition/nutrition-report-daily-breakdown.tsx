"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { NutritionReportDay, NutritionReportSummary } from "@/lib/nutrition/reports-core";
import { getVisibleNutritionReportDays } from "@/lib/nutrition/report-display";

const numberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

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
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold capitalize">{formatDate(day.date)}</p>
              {day.isToday ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">En curso</span> : null}
              {day.imported ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">Histórico</span> : null}
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

type Props = {
  days: NutritionReportDay[];
  summary: Pick<NutritionReportSummary, "registeredDays" | "completedRegisteredDays" | "currentDayRegistered">;
};

export function NutritionReportDailyBreakdown({ days, summary }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visible = getVisibleNutritionReportDays(days, expanded);
  const periodLabel = `${visible.total} ${visible.total === 1 ? "día" : "días"} del período`;

  return (
    <section className="space-y-3" aria-labelledby="daily-breakdown-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="daily-breakdown-title" className="text-lg font-semibold tracking-tight">Desglose diario</h2>
          <p className="text-xs text-muted-foreground">
            {periodLabel} · {summary.registeredDays} con nutrición · {summary.completedRegisteredDays} terminados
            {summary.currentDayRegistered ? " · hoy en curso" : ""}
          </p>
        </div>
        {visible.hasMore ? (
          <button
            type="button"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-expanded={expanded}
            aria-controls="nutrition-report-daily-rows"
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Mostrar menos" : `Ver todos los ${visible.total} días`}
          </button>
        ) : null}
      </div>
      <div id="nutrition-report-daily-rows" className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
        {visible.days.map((day) => <DailyRow key={day.date} day={day} />)}
      </div>
    </section>
  );
}
