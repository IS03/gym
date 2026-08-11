import type { WeeklyTrainingSummary } from "@/lib/phase2/types";
import { cn } from "@/lib/utils";

function compactNumber(value: number) {
  return new Intl.NumberFormat("es-AR", {
    notation: value >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1_000 ? 1 : 0,
  }).format(value);
}

function shortWeekLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

export function WeeklyVolumeChart({
  weeks,
  className,
}: {
  weeks: WeeklyTrainingSummary[];
  className?: string;
}) {
  const visibleWeeks = weeks.slice(0, 8).reverse();
  const maximum = Math.max(...visibleWeeks.map((week) => week.volumeKg), 1);

  if (visibleWeeks.length === 0) {
    return (
      <div className={cn("flex min-h-52 items-center justify-center rounded-xl border border-dashed px-6 text-center", className)}>
        <p className="max-w-xs text-sm text-muted-foreground">
          Necesitamos algunas sesiones para mostrar tu evolución.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-56 items-end gap-3", className)} aria-label="Volumen de entrenamiento de las últimas semanas">
      {visibleWeeks.map((week, index) => {
        const height = week.volumeKg > 0 ? Math.max((week.volumeKg / maximum) * 100, 7) : 2;
        const isCurrent = index === visibleWeeks.length - 1;
        return (
          <div key={week.weekStart} className="group flex h-full min-w-0 flex-1 flex-col justify-end gap-2">
            <div className="metric-number min-h-5 truncate text-center text-[11px] font-medium text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
              {week.volumeKg > 0 ? compactNumber(week.volumeKg) : "—"}
            </div>
            <div className="flex h-40 items-end overflow-hidden rounded-lg bg-muted/55">
              <div
                className={cn(
                  "w-full rounded-lg transition-[height,background-color] duration-300",
                  isCurrent ? "bg-primary" : "bg-primary/45 group-hover:bg-primary/65",
                )}
                style={{ height: `${height}%` }}
                title={`${compactNumber(week.volumeKg)} kg · ${week.sessions} sesiones · ${week.sets} series`}
              />
            </div>
            <div className="text-center">
              <p className={cn("text-[11px]", isCurrent ? "font-semibold text-foreground" : "text-muted-foreground")}>
                {isCurrent ? "Actual" : shortWeekLabel(week.weekStart)}
              </p>
              <p className="metric-number text-[10px] text-muted-foreground">{week.sessions} ses.</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MuscleDistribution({
  values,
  limit,
}: {
  values: Record<string, number>;
  limit?: number;
}) {
  const entries = Object.entries(values)
    .sort(([leftName, leftValue], [rightName, rightValue]) =>
      rightValue - leftValue || leftName.localeCompare(rightName, "es"),
    )
    .slice(0, limit);
  const maximum = Math.max(...entries.map(([, value]) => value), 1);

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no hay series completadas esta semana.</p>;
  }

  return (
    <div className="space-y-3">
      {entries.map(([name, sets]) => (
        <div key={name} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-4 text-sm">
            <span className="truncate font-medium">{name}</span>
            <span className="metric-number shrink-0 text-xs text-muted-foreground">
              {sets} {sets === 1 ? "serie" : "series"}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary/75" style={{ width: `${(sets / maximum) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}
