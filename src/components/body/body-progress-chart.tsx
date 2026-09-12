"use client";

import { useMemo, useState } from "react";

import { ChartDetail } from "@/components/ui/chart-detail";
import { chartDomain, chartY, chartYAxisTicks } from "@/lib/chart-core";
import {
  type BodyMetricKey,
  type BodyMetricProgress,
  type BodyObservation,
} from "@/lib/progress/body";
import { progressRangeDays, type ProgressPeriodRange } from "@/lib/progress/analytics";
import { cn } from "@/lib/utils";

const WIDTH = 340;
const HEIGHT = 190;
const LEFT = 48;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 28;

function shortDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric", month: "short", timeZone: "America/Argentina/Cordoba",
  }).format(new Date(`${value}T12:00:00Z`)).replace(".", "");
}

function number(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

function xForDate(date: string, range: ProgressPeriodRange) {
  const span = Math.max(progressRangeDays(range) - 1, 1);
  const offset = Math.max(0, progressRangeDays({ start: range.start, end: date }) - 1);
  return LEFT + Math.min(offset / span, 1) * (WIDTH - LEFT - RIGHT);
}

function polyline(points: readonly BodyObservation[], range: ProgressPeriodRange, domain: ReturnType<typeof chartDomain>) {
  return points.map((point) => `${xForDate(point.date, range)},${chartY(point.value, domain, HEIGHT, TOP, BOTTOM)}`).join(" ");
}

export function BodyProgressChart({
  metrics,
  initialMetricKey,
  period,
  referencePeriod,
  referenceLabel,
  onMetricChange,
}: {
  metrics: BodyMetricProgress[];
  initialMetricKey: string | null;
  period: ProgressPeriodRange;
  referencePeriod: ProgressPeriodRange;
  referenceLabel: string;
  onMetricChange?: (key: BodyMetricKey) => void;
}) {
  const fallback = metrics.find((metric) => metric.key === "body.weight" && metric.current.length > 0)
    ?? metrics.find((metric) => metric.current.length > 0)
    ?? metrics[0]
    ?? null;
  const [selectedMetricKey, setSelectedMetricKey] = useState<BodyMetricKey | null>(
    metrics.some((metric) => metric.key === initialMetricKey) ? initialMetricKey as BodyMetricKey : fallback?.key ?? null,
  );
  const [showReference, setShowReference] = useState(false);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);
  const metric = metrics.find((item) => item.key === selectedMetricKey) ?? fallback;
  const allValues = useMemo(() => metric
    ? [...metric.current, ...(showReference ? metric.reference : [])].map((point) => point.value)
    : [], [metric, showReference]);

  if (!metric) return <p className="py-8 text-sm text-muted-foreground">Todavía no hay mediciones para graficar.</p>;
  const domain = chartDomain(allValues);
  const selected = metric.current.find((point) => point.id === selectedPointId)
    ?? metric.current.at(-1)
    ?? null;

  return <div className="space-y-4">
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
      <label className="min-w-0">
        <span className="sr-only">Medida</span>
        <select
          value={metric.key}
          onChange={(event) => { const key = event.target.value as BodyMetricKey; setSelectedMetricKey(key); setSelectedPointId(null); onMetricChange?.(key); }}
          className="h-11 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {metrics.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 rounded-xl border bg-muted/25 p-1" role="group" aria-label="Referencia del gráfico">
        <button type="button" className={cn("min-h-9 rounded-lg px-2 text-xs font-medium", !showReference ? "bg-primary text-primary-foreground" : "text-muted-foreground")} onClick={() => setShowReference(false)}>Actual</button>
        <button type="button" className={cn("min-h-9 rounded-lg px-2 text-xs font-medium", showReference ? "bg-primary text-primary-foreground" : "text-muted-foreground")} onClick={() => setShowReference(true)}>Vs anterior</button>
      </div>
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-primary" />Actual</span>
      {showReference ? <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-muted-foreground" />{referenceLabel}</span> : null}
    </div>
    {metric.current.length === 0 ? <p className="rounded-xl border bg-muted/20 px-4 py-7 text-sm text-muted-foreground">No hay mediciones de {metric.label.toLowerCase()} en este período.</p> : <>
      <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Evolución de ${metric.label}. Cada punto representa una medición real.`}>
        {chartYAxisTicks(domain).map((tick) => <g key={tick}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} y2={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} className="stroke-border" strokeDasharray="2 3" />
          <text x={LEFT - 6} y={chartY(tick, domain, HEIGHT, TOP, BOTTOM) + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">{number(tick)}</text>
        </g>)}
        {showReference && metric.reference.length > 1 ? <polyline points={polyline(metric.reference, referencePeriod, domain)} fill="none" className="text-muted-foreground" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {metric.current.length > 1 ? <polyline points={polyline(metric.current, period, domain)} fill="none" className="text-primary" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        {showReference ? metric.reference.map((point) => <circle key={`reference-${point.id}`} cx={xForDate(point.date, referencePeriod)} cy={chartY(point.value, domain, HEIGHT, TOP, BOTTOM)} r="2.5" className="fill-muted-foreground" />) : null}
        {metric.current.map((point) => <g key={point.id}>
          <circle cx={xForDate(point.date, period)} cy={chartY(point.value, domain, HEIGHT, TOP, BOTTOM)} r="18" fill="transparent" role="button" tabIndex={0} aria-label={`${shortDate(point.date)}. ${number(point.value)} ${metric.unit}.`} onClick={() => setSelectedPointId(point.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedPointId(point.id); }} />
          <circle cx={xForDate(point.date, period)} cy={chartY(point.value, domain, HEIGHT, TOP, BOTTOM)} r={selected?.id === point.id ? 4.5 : 3} className="fill-primary" pointerEvents="none" />
        </g>)}
        <text x={LEFT} y={HEIGHT - 5} textAnchor="start" className="fill-muted-foreground text-[9px]">{shortDate(period.start)}</text>
        <text x={WIDTH - RIGHT} y={HEIGHT - 5} textAnchor="end" className="fill-muted-foreground text-[9px]">{shortDate(period.end)}</text>
      </svg>
      {selected ? <ChartDetail title={shortDate(selected.date)} items={[
        { label: metric.label, value: `${number(selected.value)} ${metric.unit}` },
        { label: "Origen", value: selected.provenanceLabel },
      ]} /> : null}
    </>}
    <p className="text-xs text-muted-foreground">
      {metric.current.length === 0
        ? "Sin observaciones dentro del rango."
        : metric.current.length === 1
          ? "1 medición real · tendencia no disponible."
          : metric.current.length === 2
            ? "2 mediciones reales · cambio puntual, tendencia limitada."
            : `${metric.current.length} mediciones reales · ${metric.trend === "variable" ? "evolución variable" : metric.trend === "increased" ? "dirección ascendente" : metric.trend === "decreased" ? "dirección descendente" : "sin cambio neto"}.`}
      {showReference && metric.reference.length < 2 ? " La referencia no tiene mediciones suficientes para comparar." : ""}
    </p>
  </div>;
}
