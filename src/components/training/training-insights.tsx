"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  WEEKLY_CHART_METRICS,
  formatWeeklyMetric,
  sortedProgressEntries,
  visibleProgressEntries,
  weeklyBarScale,
  weeklyMetricTitle,
  weeklyMetricValue,
  type ProgressEntry,
  type WeeklyChartMetric,
} from "@/lib/phase2/training-progress-insights";
import type { WeeklyTrainingSummary } from "@/lib/phase2/types";
import { cn } from "@/lib/utils";

function shortWeekLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function ProgressiveEntries({ entries, kind }: { entries: ProgressEntry[]; kind: "muscles" | "routines" }) {
  const [expanded, setExpanded] = useState(false);
  const visible = visibleProgressEntries(entries, expanded);
  const remaining = Math.max(entries.length - visible.length, 0);
  const maximum = Math.max(...entries.map(([, value]) => value), 1);
  const label = kind === "muscles" ? "Músculos" : "Rutinas";
  const regionId = `training-${kind}-entries`;

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay {kind === "muscles" ? "series completadas" : "rutinas realizadas"} esta semana.</p>;
  }

  return (
    <div className="space-y-3">
      <div id={regionId} className="space-y-3">
        {visible.map(([name, value]) => (
          <div key={name} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-4 text-sm">
              <span className="truncate font-medium">{name}</span>
              <span className="metric-number shrink-0 text-xs text-muted-foreground">
                {kind === "muscles" ? `${value} ${value === 1 ? "serie" : "series"}` : `×${value}`}
              </span>
            </div>
            {kind === "muscles" && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/75" style={{ width: `${(value / maximum) * 100}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
      {entries.length > 4 && (
        <Button type="button" size="sm" variant="ghost" className="h-auto px-0 text-primary" aria-expanded={expanded} aria-controls={regionId} onClick={() => setExpanded((current) => !current)}>
          {expanded ? "Mostrar menos" : `Ver ${remaining} ${label.toLocaleLowerCase("es-AR")} más`}
        </Button>
      )}
    </div>
  );
}

export function WeeklyTrainingChart({ weeks, className }: { weeks: WeeklyTrainingSummary[]; className?: string }) {
  const [metric, setMetric] = useState<WeeklyChartMetric>("volume");
  const visibleWeeks = useMemo(() => weeks.slice(0, 8).reverse(), [weeks]);
  const values = visibleWeeks.map((week) => weeklyMetricValue(week, metric));
  const maximum = Math.max(...values, 0);
  const title = weeklyMetricTitle(metric);

  if (visibleWeeks.length === 0) {
    return <div className={cn("flex min-h-52 items-center justify-center rounded-xl border border-dashed px-6 text-center", className)}><p className="max-w-xs text-sm text-muted-foreground">Necesitamos algunas sesiones para mostrar tu evolución.</p></div>;
  }

  const summary = `${title}. ${visibleWeeks.map((week, index) => `${index === visibleWeeks.length - 1 ? "Actual" : shortWeekLabel(week.weekStart)}: ${formatWeeklyMetric(values[index], metric)}`).join(". ")}.`;

  return (
    <section className={cn("space-y-4", className)} aria-labelledby="weekly-training-chart-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 id="weekly-training-chart-title" className="text-lg font-semibold tracking-tight">{title}</h2><p className="text-sm text-muted-foreground">Últimas {visibleWeeks.length} {visibleWeeks.length === 1 ? "semana" : "semanas"}.</p></div>
        <div className="grid grid-cols-2 gap-1 rounded-lg border p-1 sm:flex" aria-label="Métrica de evolución semanal">
          {WEEKLY_CHART_METRICS.map((option) => <Button key={option.value} type="button" size="sm" variant={metric === option.value ? "secondary" : "ghost"} aria-pressed={metric === option.value} onClick={() => setMetric(option.value)}>{option.label}</Button>)}
        </div>
      </div>
      <p className="sr-only">{summary}</p>
      <div className="flex h-52 items-end gap-1.5 sm:gap-3" role="img" aria-label={summary}>
        {visibleWeeks.map((week, index) => {
          const value = values[index];
          const height = weeklyBarScale(value, maximum);
          const isCurrent = index === visibleWeeks.length - 1;
          return <div key={week.weekStart} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-1.5">
            <span className="metric-number min-h-4 truncate text-center text-[10px] font-medium text-muted-foreground sm:text-[11px]">{value > 0 ? formatWeeklyMetric(value, metric) : "—"}</span>
            <div className="flex h-32 items-end overflow-hidden rounded-lg bg-muted/55"><div className={cn("w-full rounded-lg transition-[height,background-color] duration-200", isCurrent ? "bg-primary" : "bg-primary/50")} style={{ height: `${height}%` }} /></div>
            <div className="text-center"><p className={cn("text-[10px] sm:text-[11px]", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>{isCurrent ? "Actual" : shortWeekLabel(week.weekStart)}</p>{isCurrent && <p className="text-[10px] text-muted-foreground">En curso</p>}</div>
          </div>;
        })}
      </div>
    </section>
  );
}

export function WeeklyTrainingDistribution({ muscles, routines }: { muscles: Record<string, number>; routines: Record<string, number> }) {
  const muscleEntries = useMemo(() => sortedProgressEntries(muscles), [muscles]);
  const routineEntries = useMemo(() => sortedProgressEntries(routines), [routines]);
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <section className="space-y-3" aria-labelledby="training-muscles-title"><h2 id="training-muscles-title" className="text-base font-semibold tracking-tight">Músculos</h2><ProgressiveEntries entries={muscleEntries} kind="muscles" /></section>
      <section className="space-y-3" aria-labelledby="training-routines-title"><h2 id="training-routines-title" className="text-base font-semibold tracking-tight">Rutinas</h2><ProgressiveEntries entries={routineEntries} kind="routines" /></section>
    </div>
  );
}

// Kept for the compact Home summary; `/train/progress` uses the selector above.
export function WeeklyVolumeChart({ weeks, className }: { weeks: WeeklyTrainingSummary[]; className?: string }) {
  const visibleWeeks = weeks.slice(0, 8).reverse();
  const maximum = Math.max(...visibleWeeks.map((week) => week.volumeKg), 1);
  if (visibleWeeks.length === 0) {
    return <div className={cn("flex min-h-52 items-center justify-center rounded-xl border border-dashed px-6 text-center", className)}><p className="max-w-xs text-sm text-muted-foreground">Necesitamos algunas sesiones para mostrar tu evolución.</p></div>;
  }
  return <div className={cn("flex h-56 items-end gap-3", className)} aria-label="Volumen de entrenamiento de las últimas semanas">
    {visibleWeeks.map((week, index) => {
      const height = week.volumeKg > 0 ? Math.max(weeklyBarScale(week.volumeKg, maximum), 7) : 0;
      const isCurrent = index === visibleWeeks.length - 1;
      return <div key={week.weekStart} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="metric-number min-h-5 truncate text-center text-[11px] font-medium text-muted-foreground">{week.volumeKg > 0 ? formatWeeklyMetric(week.volumeKg, "volume") : "—"}</div><div className="flex h-40 items-end overflow-hidden rounded-lg bg-muted/55"><div className={cn("w-full rounded-lg transition-[height,background-color] duration-300", isCurrent ? "bg-primary" : "bg-primary/45")} style={{ height: `${height}%` }} /></div><div className="text-center"><p className={cn("text-[11px]", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>{isCurrent ? "Actual" : shortWeekLabel(week.weekStart)}</p><p className="metric-number text-[10px] text-muted-foreground">{week.sessions} ses.</p></div></div>;
    })}
  </div>;
}

// Kept for the Home sidebar-style distribution.
export function MuscleDistribution({ values, limit }: { values: Record<string, number>; limit?: number }) {
  const entries = sortedProgressEntries(values).slice(0, limit);
  const maximum = Math.max(...entries.map(([, value]) => value), 1);
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">Todavía no hay series completadas esta semana.</p>;
  return <div className="space-y-3">{entries.map(([name, sets]) => <div key={name} className="space-y-1.5"><div className="flex items-baseline justify-between gap-4 text-sm"><span className="truncate font-medium">{name}</span><span className="metric-number shrink-0 text-xs text-muted-foreground">{sets} {sets === 1 ? "serie" : "series"}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary/75" style={{ width: `${(sets / maximum) * 100}%` }} /></div></div>)}</div>;
}
