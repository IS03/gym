import {
  Activity,
  ChevronRight,
  Coffee,
  Droplet,
  Dumbbell,
  Flame,
  Footprints,
  Gauge,
  Moon,
  Scale,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { MetricValueType, SystemMetricKey } from "@/lib/daily-metrics/core";

export type ActivityContextValues = {
  targetLabel: string;
  expenditureLabel: string;
  balanceLabel: string;
  trainingLabel: string;
};

export type MetricSummaryItem = {
  id: string;
  label: string;
  valueLabel: string;
  systemKey: SystemMetricKey | null;
  valueType: MetricValueType;
};

type LabelValue = [label: string, value: string, icon: LucideIcon];

export function getMetricIcon(systemKey: SystemMetricKey | null, valueType: MetricValueType): LucideIcon {
  if (systemKey === "steps") return Footprints;
  if (systemKey === "water") return Droplet;
  if (systemKey === "mate") return Coffee;
  if (systemKey === "sleep") return Moon;
  return valueType === "duration" ? Activity : Gauge;
}

export const getActivityContextItems = (values: ActivityContextValues): LabelValue[] => [
  ["Objetivo nutricional", values.targetLabel, Target],
  ["Gasto estimado", values.expenditureLabel, Flame],
  ["Balance", values.balanceLabel, Scale],
  ["Entrenamiento", values.trainingLabel, Dumbbell],
];

export function ActivityContextSummary({
  className = "grid grid-cols-2 overflow-hidden rounded-xl border bg-background/35",
  ...values
}: ActivityContextValues & { className?: string }) {
  return (
    <div className={className}>
      {getActivityContextItems(values).map(([label, value, Icon], index) => (
        <div
          key={label}
          className={`flex min-w-0 items-center gap-2.5 p-3 ${index < 2 ? "border-b" : ""} ${index % 2 === 0 ? "border-r" : ""}`}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-xs text-muted-foreground">{label}</span>
            <span className="block truncate text-sm font-semibold leading-snug">{value}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

type Props = ActivityContextValues & {
  metrics: MetricSummaryItem[];
  onOpen: () => void;
};

export function DayActivityPanel({ metrics, onOpen, expenditureLabel, balanceLabel }: Props) {
  const primaryItems: LabelValue[] = [
    ["Gasto", expenditureLabel, Flame],
    ["Balance", balanceLabel, Scale],
  ];
  const compactMetrics = metrics.slice(0, 3);
  const metricColumns = compactMetrics.length === 1
    ? "grid-cols-1"
    : compactMetrics.length === 2
      ? "grid-cols-2"
      : "grid-cols-3";

  return (
    <Card size="sm" className="surface-elevated overflow-hidden">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={onOpen}
          aria-label="Abrir actividad de hoy"
          aria-haspopup="dialog"
          className="block w-full p-3.5 text-left outline-none transition-colors hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        >
          <span className="flex min-h-7 items-center justify-between gap-3">
            <span className="text-sm font-semibold">Actividad y balance</span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </span>
          <span className={`mt-3 grid grid-cols-2 divide-x ${compactMetrics.length ? "border-b pb-3" : ""}`}>
            {primaryItems.map(([label, value, Icon]) => (
              <span key={label} className="flex min-w-0 items-center gap-2 px-2 first:pl-0 last:pr-0">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">{label}</span>
                  <span className="metric-number block truncate text-sm font-semibold">{value}</span>
                </span>
              </span>
            ))}
          </span>
          {compactMetrics.length ? (
            <span className={`grid ${metricColumns} divide-x pt-3`}>
              {compactMetrics.map((metric) => {
                const Icon = getMetricIcon(metric.systemKey, metric.valueType);
                return (
                  <span key={metric.id} className="flex min-w-0 items-center gap-1.5 px-2 first:pl-0 last:pr-0">
                    <Icon className="size-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] text-muted-foreground">{metric.label}</span>
                      <span className="metric-number block truncate text-xs font-semibold">{metric.valueLabel}</span>
                    </span>
                  </span>
                );
              })}
            </span>
          ) : null}
        </button>
      </CardContent>
    </Card>
  );
}
