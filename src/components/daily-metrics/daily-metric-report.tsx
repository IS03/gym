"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { ChartDetail } from "@/components/ui/chart-detail";
import { formatDurationMinutes } from "@/lib/daily-metrics/core";
import type {
  MetricReportComparison,
  MetricReportDay,
  MetricReportDefinition,
  MetricReportSummary,
} from "@/lib/daily-metrics/reports-core";
import {
  alignNutritionComparisonBuckets,
  averageBucketValue,
  bucketNutritionChartDays,
  chartDomain,
  chartTickIndexes,
  chartX,
  chartY,
  lineSegments,
} from "@/lib/nutrition/report-chart-core";
import { formatNutritionReportRange } from "@/lib/nutrition/report-display";
import { cn } from "@/lib/utils";

const WIDTH = 320;
const HEIGHT = 188;
const LEFT = 50;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 28;

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const signed = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2, signDisplay: "always" });

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`)).replace(" de ", " ").replace(".", "");
}

function axisValue(value: number, metric: MetricReportDefinition) {
  if (metric.value_type === "duration") return formatDurationMinutes(Math.round(value));
  return metric.value_type === "integer" ? integer.format(value) : number.format(value);
}

function formatValue(value: number | null, metric: MetricReportDefinition) {
  if (value === null) return "—";
  if (metric.value_type === "integer") {
    return `${integer.format(value)}${metric.unit ? ` ${metric.unit}` : ""}`;
  }
  if (metric.value_type === "duration") return formatDurationMinutes(Math.round(value));
  return `${number.format(value)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function formatSignedValue(value: number | null, metric: MetricReportDefinition) {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const magnitude = Math.abs(value);
  if (metric.value_type === "duration") return `${sign}${formatDurationMinutes(Math.round(magnitude))}`;
  const formatted = metric.value_type === "integer"
    ? integer.format(magnitude)
    : number.format(magnitude);
  return `${sign}${formatted}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function SummaryStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="min-w-0">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="metric-number mt-1 text-lg font-semibold tracking-tight">{value}</p>
    {detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}
  </div>;
}

function MetricChart({
  metric,
  days,
  comparison,
}: {
  metric: MetricReportDefinition;
  days: MetricReportDay[];
  comparison: MetricReportComparison | null;
}) {
  const current = useMemo(() => bucketNutritionChartDays([...days].reverse()), [days]);
  const compared = useMemo(() => comparison
    ? alignNutritionComparisonBuckets([...days].reverse(), [...comparison.previousDays].reverse())
    : [], [comparison, days]);
  const currentValues = current.map((bucket) => averageBucketValue(bucket, (day) => day.value));
  const previousValues = compared.map((bucket) => averageBucketValue(bucket.previous, (day) => day.value));
  const comparedCurrentValues = compared.map((bucket) => averageBucketValue(bucket.current, (day) => day.value));
  const values = comparison ? comparedCurrentValues : currentValues;
  const allValues = comparison ? [...values, ...previousValues] : [...values, metric.target_value];
  const domain = chartDomain(allValues, { nonNegative: true });
  const buckets = comparison ? compared.map((bucket) => bucket.current) : current;
  const [selected, setSelected] = useState(() => Math.max(values.findLastIndex((value) => value !== null), 0));
  const selectedIndex = Math.min(selected, Math.max(buckets.length - 1, 0));
  const targetY = metric.target_value === null ? null : chartY(metric.target_value, domain, HEIGHT, TOP, BOTTOM);
  const yTicks = [domain.max, domain.max * 2 / 3, domain.max / 3, 0];

  if (!values.some((value) => value !== null) && !previousValues.some((value) => value !== null)) {
    return <p className="py-10 text-sm text-muted-foreground">No registraste {metric.name} en este período.</p>;
  }

  return <div className="space-y-3">
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-primary" />{comparison ? "Actual" : "Registrado"}</span>
      {comparison ? <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-muted-foreground" />Anterior</span> : null}
      {!comparison && metric.target_value !== null ? <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-muted-foreground" />Objetivo actual</span> : null}
    </div>
    <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Evolución de ${metric.name}`} style={{ touchAction: "pan-y" }}>
      {yTicks.map((tick) => <g key={tick}>
        <line x1={LEFT} x2={WIDTH - RIGHT} y1={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} y2={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} className="stroke-border" strokeDasharray="2 3" />
        <text x={LEFT - 6} y={chartY(tick, domain, HEIGHT, TOP, BOTTOM) + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">{axisValue(tick, metric)}</text>
      </g>)}
      {targetY === null || comparison ? null : <line x1={LEFT} x2={WIDTH - RIGHT} y1={targetY} y2={targetY} className="stroke-muted-foreground" strokeDasharray="5 4" />}
      {lineSegments(values, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={`current-${index}`} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" className="text-primary" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
      {comparison ? lineSegments(previousValues, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={`previous-${index}`} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" className="text-muted-foreground" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />) : null}
      {values.map((value, index) => value === null ? null : <circle key={index} cx={chartX(index, values.length, WIDTH, LEFT, RIGHT)} cy={chartY(value, domain, HEIGHT, TOP, BOTTOM)} r={selectedIndex === index ? 4 : 2.5} className="fill-primary" />)}
      {buckets.map((bucket, index) => <rect key={bucket.end} x={Math.max(LEFT, chartX(index, buckets.length, WIDTH, LEFT, RIGHT) - 14)} y={TOP} width="28" height={HEIGHT - TOP - BOTTOM} fill="transparent" role="button" tabIndex={0} aria-label={`${dateLabel(bucket.end)}. Ver detalle.`} onClick={() => setSelected(index)} onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") setSelected(index);
      }} />)}
      {chartTickIndexes(buckets.length, 4).map((index) => <text key={buckets[index]!.end} x={chartX(index, buckets.length, WIDTH, LEFT, RIGHT)} y={HEIGHT - 5} textAnchor="middle" className="fill-muted-foreground text-[9px]">{comparison ? `D${index + 1}` : dateLabel(buckets[index]!.end)}</text>)}
    </svg>
    <ChartDetail
      title={buckets[selectedIndex] ? (comparison ? `Día ${selectedIndex + 1}` : dateLabel(buckets[selectedIndex]!.end)) : "Sin dato"}
      items={[
        { label: comparison ? "Actual" : metric.name, value: formatValue(values[selectedIndex] ?? null, metric) },
        ...(comparison ? [{ label: "Anterior", value: formatValue(previousValues[selectedIndex] ?? null, metric) }] : []),
      ]}
      className="min-h-20"
    />
  </div>;
}

export function DailyMetricReport({
  definitions,
  metric,
  days,
  summary,
  comparison,
  currentHref,
  previousHref,
}: {
  definitions: MetricReportDefinition[];
  metric: MetricReportDefinition;
  days: MetricReportDay[];
  summary: MetricReportSummary;
  comparison: MetricReportComparison | null;
  currentHref: string;
  previousHref: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const registered = days.filter((day) => day.value !== null).slice(0, 7);

  function selectMetric(metricId: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("metric", metricId);
    startTransition(() => router.push(`/progress/metrics?${next.toString()}`));
  }

  return <div className="space-y-6" aria-busy={pending}>
    <section className="space-y-3" aria-labelledby="metric-selector-title">
      <div>
        <h2 id="metric-selector-title" className="text-lg font-semibold tracking-tight">Métrica</h2>
        <p className="text-xs text-muted-foreground">Activas y archivadas; la historia nunca se elimina.</p>
      </div>
      <label className="block">
        <span className="sr-only">Elegir métrica</span>
        <select value={metric.id} onChange={(event) => selectMetric(event.target.value)} className="h-11 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={pending}>
          {definitions.map((definition) => <option key={definition.id} value={definition.id}>{definition.name}{definition.is_active ? "" : " · Archivada"}</option>)}
        </select>
      </label>
    </section>

    <section className="space-y-3" aria-labelledby="metric-summary-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="metric-summary-title" className="text-lg font-semibold tracking-tight">Resumen</h2>
        {!metric.is_active ? <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">Archivada</span> : null}
      </div>
      <Card className="surface-elevated"><CardContent className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-4">
        <SummaryStat label="Promedio" value={formatValue(summary.average, metric)} />
        <SummaryStat label="Días registrados" value={`${summary.registeredDays}/${days.length}`} detail="Sin dato no cuenta como cero" />
        <SummaryStat label="Mínimo" value={formatValue(summary.minimum, metric)} />
        <SummaryStat label="Máximo" value={formatValue(summary.maximum, metric)} />
        <div className="col-span-2 border-t pt-3 sm:col-span-4">
          <p className="text-xs text-muted-foreground">Tendencia del período</p>
          <p className="metric-number mt-1 font-semibold">{formatSignedValue(summary.trendDelta, metric)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Primer registro vs último{summary.trendPercentDelta === null ? "" : ` · ${signed.format(summary.trendPercentDelta)}%`}</p>
        </div>
        {summary.currentTargetReference !== null ? <div className="col-span-2 border-t pt-3 sm:col-span-4">
          <p className="text-xs text-muted-foreground">Objetivo actual · referencia, no objetivo histórico</p>
          <p className="metric-number mt-1 font-semibold">{formatValue(summary.currentTargetReference, metric)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{summary.currentTargetHitDays}/{summary.registeredDays} registros alcanzan esta referencia actual.</p>
        </div> : null}
      </CardContent></Card>
    </section>

    <section className="space-y-3" aria-labelledby="metric-trend-title">
      <div>
        <h2 id="metric-trend-title" className="text-lg font-semibold tracking-tight">Tendencia</h2>
        <p className="text-xs text-muted-foreground">Los huecos son días sin registro.</p>
      </div>
      <div className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-lg border bg-muted/25 p-1">
        <Link scroll={false} href={currentHref} className={cn("flex h-9 items-center justify-center rounded-md text-xs font-medium", comparison ? "text-muted-foreground" : "bg-primary text-primary-foreground shadow-sm")}>Actual</Link>
        <Link scroll={false} href={previousHref} className={cn("flex h-9 items-center justify-center rounded-md text-xs font-medium", comparison ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>Vs anterior</Link>
      </div>
      {comparison ? <Card><CardContent className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <SummaryStat label="Actual" value={formatValue(comparison.current.average, metric)} detail={formatNutritionReportRange(days.at(-1)?.date ?? "", days[0]?.date ?? "")} />
          <SummaryStat label="Anterior" value={formatValue(comparison.previous.average, metric)} detail={formatNutritionReportRange(comparison.previousRange.start, comparison.previousRange.end)} />
        </div>
        <p className="border-t pt-3 text-sm text-muted-foreground">Cambio promedio: <span className="font-semibold text-foreground">{formatSignedValue(comparison.averageDelta, metric)}</span>{comparison.averagePercentDelta === null ? "" : ` · ${signed.format(comparison.averagePercentDelta)}%`}</p>
      </CardContent></Card> : null}
      <Card className="surface-elevated"><CardContent className="p-3 sm:p-4"><MetricChart metric={metric} days={days} comparison={comparison} /></CardContent></Card>
    </section>

    <section className="space-y-3" aria-labelledby="metric-history-title">
      <h2 id="metric-history-title" className="text-lg font-semibold tracking-tight">Registros recientes</h2>
      {registered.length ? <div className="divide-y overflow-hidden rounded-xl border bg-card surface-elevated">
        {registered.map((day) => <div key={day.date} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="capitalize text-muted-foreground">{dateLabel(day.date)}</span><span className="metric-number font-semibold">{formatValue(day.value, metric)}</span></div>)}
      </div> : <Card><CardContent className="py-8 text-sm text-muted-foreground">No registraste {metric.name} en este período.</CardContent></Card>}
    </section>
  </div>;
}
