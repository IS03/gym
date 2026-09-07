"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { NutritionReportComparisonSummary } from "@/components/nutrition/nutrition-report-comparison";
import { Card, CardContent } from "@/components/ui/card";
import { ChartDetail } from "@/components/ui/chart-detail";
import { chartY, formatChartValue, type ChartUnit } from "@/lib/chart-core";
import type { NutritionReportComparisonMode } from "@/lib/nutrition/report-navigation";
import type { NutritionReportComparison, NutritionReportDay } from "@/lib/nutrition/reports-core";
import {
  alignNutritionComparisonBuckets,
  averageBucketValue,
  balanceChartTicks,
  bucketNutritionChartDays,
  chartBandGeometry,
  chartDomain,
  chartTickIndexes,
  chartX,
  lineSegments,
  type NutritionComparisonChartBucket,
  type NutritionChartBucket,
} from "@/lib/nutrition/report-chart-core";
import { cn } from "@/lib/utils";

const WIDTH = 320;
const HEIGHT = 184;
const LEFT = 48;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 28;

type Metric = "energy" | "balance" | "protein" | "water" | "steps";
type LineSeries = {
  label: string;
  values: Array<number | null>;
  className: string;
  dash?: string;
  width?: number;
};

const metricOptions: Array<{ id: Metric; label: string }> = [
  { id: "energy", label: "Energía" },
  { id: "balance", label: "Balance" },
  { id: "protein", label: "Proteína" },
  { id: "water", label: "Agua" },
  { id: "steps", label: "Pasos" },
];

function dateLabel(value: string, year = false) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    ...(year ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`)).replace(" de ", " ").replace(".", "");
}

function bucketLabel(bucket: NutritionChartBucket<NutritionReportDay>, year = false) {
  if (bucket.start === bucket.end) return dateLabel(bucket.start, year);
  return `${dateLabel(bucket.start)} — ${dateLabel(bucket.end, year)}`;
}

function points(values: ReturnType<typeof lineSegments>[number]) {
  return values.map((point) => `${point.x},${point.y}`).join(" ");
}

function keySelect(event: React.KeyboardEvent<SVGElement>, select: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
}

function dateHitBounds(index: number, count: number) {
  const center = chartX(index, count, WIDTH, LEFT, RIGHT);
  const previous = index === 0 ? LEFT : (chartX(index - 1, count, WIDTH, LEFT, RIGHT) + center) / 2;
  const next = index === count - 1 ? WIDTH - RIGHT : (center + chartX(index + 1, count, WIDTH, LEFT, RIGHT)) / 2;
  return { x: previous, width: next - previous };
}

function firstSelectableIndex(values: Array<number | null>) {
  return Math.max(...values.map((value, index) => value === null ? -1 : index), 0);
}

function firstSeriesSelectionIndex(series: LineSeries[]) {
  const count = series[0]?.values.length ?? 0;
  return Math.max(...Array.from({ length: count }, (_, index) => series.some((item) => item.values[index] !== null) ? index : -1), 0);
}

function yTicks(domain: ReturnType<typeof chartDomain>) {
  return [0, 1 / 3, 2 / 3, 1].map((step) => domain.max - (domain.max - domain.min) * step);
}

function ChartGrid({
  domain,
  unit,
  ticks = yTicks(domain),
  skipZeroGridLine = false,
}: {
  domain: ReturnType<typeof chartDomain>;
  unit: ChartUnit;
  ticks?: number[];
  skipZeroGridLine?: boolean;
}) {
  return <>{ticks.map((value) => {
    const y = chartY(value, domain, HEIGHT, TOP, BOTTOM);
    const isZero = Math.abs(value) < 1e-9;
    return <g key={value}>
      {skipZeroGridLine && isZero ? null : <line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} className="stroke-border" strokeDasharray="2 3" />}
      <text x={LEFT - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{formatChartValue(value, unit)}</text>
    </g>;
  })}</>;
}

function DateTicks({
  buckets,
  position = (index) => chartX(index, buckets.length, WIDTH, LEFT, RIGHT),
}: {
  buckets: NutritionChartBucket<NutritionReportDay>[];
  position?: (index: number) => number;
}) {
  const indexes = chartTickIndexes(buckets.length, buckets.length > 100 ? 3 : 4);
  return <>{indexes.map((index) => <text
    key={buckets[index]!.end}
    x={position(index)}
    y={HEIGHT - 5}
    textAnchor="middle"
    className="fill-muted-foreground text-[9px]"
  >{dateLabel(buckets[index]!.end)}</text>)}</>;
}

function ChartLegend({ series }: { series: LineSeries[] }) {
  return <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
    {series.map((item) => <li key={item.label} className="flex items-center gap-1.5">
      <svg className={`h-2.5 w-5 ${item.className}`} viewBox="0 0 20 10" aria-hidden>
        <path d="M1 5h18" fill="none" stroke="currentColor" strokeWidth={item.width ?? 2} strokeDasharray={item.dash} />
      </svg>
      {item.label}{item.dash ? " (línea discontinua)" : ""}
    </li>)}
  </ul>;
}

function ComparisonLegend({ bars = false }: { bars?: boolean }) {
  return <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda comparativa">
    <li className="flex items-center gap-1.5">
      <svg className="h-3 w-5 text-primary" viewBox="0 0 20 12" aria-hidden>
        {bars ? <rect x="3" y="1" width="14" height="10" rx="1" fill="currentColor" /> : <path d="M1 6h18" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      </svg>
      Actual
    </li>
    <li className="flex items-center gap-1.5">
      <svg className="h-3 w-5 text-muted-foreground" viewBox="0 0 20 12" aria-hidden>
        {bars
          ? <rect x="3" y="1" width="14" height="10" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
          : <path d="M1 6h18" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />}
      </svg>
      Anterior {bars ? "(borde discontinuo)" : "(línea discontinua)"}
    </li>
  </ul>;
}

function comparisonBucketValues(
  buckets: NutritionComparisonChartBucket<NutritionReportDay>[],
  metric: Metric,
) {
  const value = (day: NutritionReportDay) => {
    if (metric === "energy") return day.hasNutrition ? day.calories : null;
    if (metric === "balance") return day.hasNutrition ? day.energyBalanceKcal : null;
    if (metric === "protein") return day.hasNutrition ? day.proteinG : null;
    if (metric === "water") return day.waterL;
    return day.steps;
  };
  return {
    current: buckets.map((bucket) => averageBucketValue(bucket.current, value)),
    previous: buckets.map((bucket) => averageBucketValue(bucket.previous, value)),
  };
}

function comparisonUnit(metric: Metric): ChartUnit {
  if (metric === "protein") return "g";
  if (metric === "water") return "L";
  if (metric === "steps") return "pasos";
  return "kcal";
}

function relativeTicks(
  buckets: NutritionComparisonChartBucket<NutritionReportDay>[],
  position: (index: number) => number,
) {
  const indexes = chartTickIndexes(buckets.length, buckets.length > 100 ? 3 : 4);
  return indexes.map((index) => <text
    key={buckets[index]!.id}
    x={position(index)}
    y={HEIGHT - 5}
    textAnchor="middle"
    className="fill-muted-foreground text-[9px]"
  >{buckets[index]!.label.replace("Día ", "D").replace("Semana ", "S").replace("Tramo ", "T")}</text>);
}

function comparisonDetailValue(
  value: number | null,
  unit: ChartUnit,
  bucket: NutritionChartBucket<NutritionReportDay>,
) {
  return `${value === null ? "Sin dato" : formatChartValue(value, unit)} · ${bucketLabel(bucket, true)}`;
}

function ComparisonLineChart({
  buckets,
  values,
  unit,
  description,
}: {
  buckets: NutritionComparisonChartBucket<NutritionReportDay>[];
  values: { current: Array<number | null>; previous: Array<number | null> };
  unit: ChartUnit;
  description: string;
}) {
  const domain = chartDomain([...values.current, ...values.previous], { nonNegative: true });
  const [selected, setSelected] = useState(() => firstSeriesSelectionIndex([
    { label: "Actual", values: values.current, className: "text-primary" },
    { label: "Anterior", values: values.previous, className: "text-muted-foreground" },
  ]));
  const [focused, setFocused] = useState<number | null>(null);
  const selectedIndex = Math.min(selected, Math.max(buckets.length - 1, 0));
  const selectedBucket = buckets[selectedIndex];

  if (!values.current.some((item) => item !== null) && !values.previous.some((item) => item !== null)) {
    return <p className="py-8 text-sm text-muted-foreground">No hay datos comparables para esta métrica.</p>;
  }

  return <div className="space-y-3">
    <ComparisonLegend />
    <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={description} style={{ touchAction: "pan-y" }}>
      <ChartGrid domain={domain} unit={unit} />
      {selectedBucket ? <line x1={chartX(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT)} x2={chartX(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT)} y1={TOP} y2={HEIGHT - BOTTOM} className="stroke-primary/35" strokeDasharray="2 3" pointerEvents="none" /> : null}
      {focused === null ? null : <line x1={chartX(focused, buckets.length, WIDTH, LEFT, RIGHT)} x2={chartX(focused, buckets.length, WIDTH, LEFT, RIGHT)} y1={TOP + 2} y2={HEIGHT - BOTTOM - 2} className="stroke-primary" strokeWidth="2" pointerEvents="none" />}
      {lineSegments(values.current, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={`current-${index}`} points={points(segment)} className="text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
      {lineSegments(values.previous, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={`previous-${index}`} points={points(segment)} className="text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
      {buckets.map((bucket, index) => {
        if (values.current[index] === null && values.previous[index] === null) return null;
        const hit = dateHitBounds(index, buckets.length);
        return <rect key={bucket.id} x={hit.x} y="0" width={hit.width} height={HEIGHT} fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" aria-label={`${bucket.label}. Ver valores de Actual y Anterior.`} onClick={() => setSelected(index)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} onKeyDown={(event) => keySelect(event, () => setSelected(index))} />;
      })}
      {values.current.map((value, index) => value === null ? null : <circle key={`current-${index}`} cx={chartX(index, buckets.length, WIDTH, LEFT, RIGHT)} cy={chartY(value, domain, HEIGHT, TOP, BOTTOM)} r={selectedIndex === index ? 4.5 : 2.5} className="text-primary" fill="currentColor" pointerEvents="none" />)}
      {values.previous.map((value, index) => value === null ? null : <circle key={`previous-${index}`} cx={chartX(index, buckets.length, WIDTH, LEFT, RIGHT)} cy={chartY(value, domain, HEIGHT, TOP, BOTTOM)} r={selectedIndex === index ? 4 : 2.5} className="text-muted-foreground" fill="var(--card)" stroke="currentColor" strokeWidth="1.5" pointerEvents="none" />)}
      {relativeTicks(buckets, (index) => chartX(index, buckets.length, WIDTH, LEFT, RIGHT))}
    </svg>
    <ChartDetail
      title={selectedBucket?.label ?? "Sin dato"}
      items={selectedBucket ? [
        { label: "Actual", value: comparisonDetailValue(values.current[selectedIndex] ?? null, unit, selectedBucket.current) },
        { label: "Anterior", value: comparisonDetailValue(values.previous[selectedIndex] ?? null, unit, selectedBucket.previous) },
      ] : []}
      description={selectedBucket?.current.includesToday ? "Hoy está en curso y no modifica el resumen comparativo." : undefined}
      className="min-h-24"
    />
  </div>;
}

function ComparisonBarChart({
  buckets,
  values,
  unit,
  balance = false,
  description,
}: {
  buckets: NutritionComparisonChartBucket<NutritionReportDay>[];
  values: { current: Array<number | null>; previous: Array<number | null> };
  unit: ChartUnit;
  balance?: boolean;
  description: string;
}) {
  const allValues = [...values.current, ...values.previous];
  const domain = chartDomain(allValues, balance ? true : { nonNegative: true });
  const [selected, setSelected] = useState(() => firstSeriesSelectionIndex([
    { label: "Actual", values: values.current, className: "text-primary" },
    { label: "Anterior", values: values.previous, className: "text-muted-foreground" },
  ]));
  const [focused, setFocused] = useState<number | null>(null);
  const selectedIndex = Math.min(selected, Math.max(buckets.length - 1, 0));
  const selectedBucket = buckets[selectedIndex];
  const baseline = chartY(0, domain, HEIGHT, TOP, BOTTOM);

  if (!allValues.some((item) => item !== null)) {
    return <p className="py-8 text-sm text-muted-foreground">No hay datos comparables para esta métrica.</p>;
  }

  return <div className="space-y-3">
    <ComparisonLegend bars />
    <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label={description} style={{ touchAction: "pan-y" }}>
      <ChartGrid domain={domain} unit={unit} ticks={balance ? balanceChartTicks(domain) : undefined} skipZeroGridLine={balance} />
      {balance ? <line x1={LEFT} x2={WIDTH - RIGHT} y1={baseline} y2={baseline} className="stroke-foreground/55" strokeDasharray="3 3" /> : null}
      {selectedBucket ? <line x1={chartBandGeometry(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT).center} x2={chartBandGeometry(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT).center} y1={TOP} y2={HEIGHT - BOTTOM} className="stroke-primary/35" strokeDasharray="2 3" pointerEvents="none" /> : null}
      {focused === null ? null : <line x1={chartBandGeometry(focused, buckets.length, WIDTH, LEFT, RIGHT).center} x2={chartBandGeometry(focused, buckets.length, WIDTH, LEFT, RIGHT).center} y1={TOP + 2} y2={HEIGHT - BOTTOM - 2} className="stroke-primary" strokeWidth="2" pointerEvents="none" />}
      {buckets.map((bucket, index) => {
        const band = chartBandGeometry(index, buckets.length, WIDTH, LEFT, RIGHT);
        const groupWidth = Math.max(6, Math.min(24, band.width - 2));
        const gap = Math.min(2, groupWidth * 0.12);
        const barWidth = Math.max(2, (groupWidth - gap) / 2);
        const start = band.center - groupWidth / 2;
        const bars = [
          { key: "current", value: values.current[index], x: start, className: bucket.current.includesToday ? "fill-primary/45" : "fill-primary", dashed: false },
          { key: "previous", value: values.previous[index], x: start + barWidth + gap, className: "fill-muted/40 stroke-muted-foreground", dashed: true },
        ] as const;
        return <g key={bucket.id}>
          {bars.map((bar) => {
            if (bar.value === null) return null;
            const y = chartY(bar.value, domain, HEIGHT, TOP, BOTTOM);
            return <rect key={bar.key} x={bar.x} y={Math.min(y, baseline)} width={barWidth} height={Math.max(1, Math.abs(y - baseline))} rx="1" className={bar.className} strokeWidth={bar.dashed ? "1" : undefined} strokeDasharray={bar.dashed ? "2 2" : undefined} pointerEvents="none" />;
          })}
          <rect x={band.start} y={TOP} width={band.width} height={HEIGHT - TOP - BOTTOM} fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" aria-label={`${bucket.label}. Ver valores de Actual y Anterior.`} onClick={() => setSelected(index)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} onKeyDown={(event) => keySelect(event, () => setSelected(index))} />
        </g>;
      })}
      {relativeTicks(buckets, (index) => chartBandGeometry(index, buckets.length, WIDTH, LEFT, RIGHT).center)}
    </svg>
    <ChartDetail
      title={selectedBucket?.label ?? "Sin dato"}
      items={selectedBucket ? [
        { label: "Actual", value: comparisonDetailValue(values.current[selectedIndex] ?? null, unit, selectedBucket.current) },
        { label: "Anterior", value: comparisonDetailValue(values.previous[selectedIndex] ?? null, unit, selectedBucket.previous) },
      ] : []}
      description={balance ? "Balance = consumo − gasto; no es la desviación contra el objetivo." : selectedBucket?.current.includesToday ? "Hoy está en curso y no modifica el resumen comparativo." : undefined}
      className="min-h-24"
    />
  </div>;
}

function provisionalValues(values: Array<number | null>, buckets: NutritionChartBucket<NutritionReportDay>[]) {
  const provisional = buckets.findIndex((bucket) => bucket.includesToday);
  if (provisional < 0 || values[provisional] === null) return values.map(() => null);
  let previous = provisional - 1;
  while (previous >= 0 && values[previous] === null) previous -= 1;
  return values.map((value, index) => index === provisional || index === previous ? value : null);
}

function LineChart({
  buckets,
  series,
  unit,
  description,
}: {
  buckets: NutritionChartBucket<NutritionReportDay>[];
  series: LineSeries[];
  unit: ChartUnit;
  description: string;
}) {
  const domain = chartDomain(series.flatMap((item) => item.values), { nonNegative: true });
  const [selected, setSelected] = useState(() => firstSeriesSelectionIndex(series));
  const selectedIndex = Math.min(selected, Math.max(buckets.length - 1, 0));
  const selectedBucket = buckets[selectedIndex];
  const bucketed = buckets.some((bucket) => bucket.start !== bucket.end);

  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">Fecha · {unit}{bucketed ? " · promedio diario por período" : ""}</p>
    <svg
      className="block h-auto w-full overflow-visible"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMidYMid meet"
      role="group"
      aria-label={description}
      style={{ touchAction: "pan-y" }}
    >
      <ChartGrid domain={domain} unit={unit} />
      {selectedBucket ? <line x1={chartX(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT)} x2={chartX(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT)} y1={TOP} y2={HEIGHT - BOTTOM} className="stroke-primary/35" strokeDasharray="2 3" pointerEvents="none" /> : null}
      {series.map((item) => {
        const complete = item.values.map((value, index) => buckets[index]?.includesToday ? null : value);
        return <g key={item.label}>
          {lineSegments(complete, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={index} points={points(segment)} className={item.className} fill="none" stroke="currentColor" strokeWidth={item.width ?? 2} strokeDasharray={item.dash} vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
          {lineSegments(provisionalValues(item.values, buckets), domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={`provisional-${index}`} points={points(segment)} className={item.className} fill="none" stroke="currentColor" strokeWidth={item.width ?? 2} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />)}
        </g>;
      })}
      {buckets.map((bucket, index) => {
        const known = series.some((item) => item.values[index] !== null);
        if (!known) return null;
        const hit = dateHitBounds(index, buckets.length);
        return <rect key={bucket.end} x={hit.x} y="0" width={hit.width} height={HEIGHT} fill="transparent" role="button" tabIndex={0} aria-label={`${bucketLabel(bucket, true)}${bucket.includesToday ? ". Hoy en curso." : ""} Ver valores de ${unit}.`} onClick={() => setSelected(index)} onKeyDown={(event) => keySelect(event, () => setSelected(index))} />;
      })}
      {series.map((item) => item.values.map((value, index) => value === null ? null : <circle key={`${item.label}-${index}`} cx={chartX(index, buckets.length, WIDTH, LEFT, RIGHT)} cy={chartY(value, domain, HEIGHT, TOP, BOTTOM)} r={selectedIndex === index ? 4.5 : 2.5} className={item.className} fill={buckets[index]?.includesToday ? "var(--card)" : "currentColor"} stroke="currentColor" strokeWidth={buckets[index]?.includesToday ? "2" : "1.25"} pointerEvents="none" />))}
      <DateTicks buckets={buckets} />
    </svg>
    <ChartDetail
      title={selectedBucket ? bucketLabel(selectedBucket, true) : "Sin dato"}
      items={series.map((item) => ({ label: item.label, value: item.values[selectedIndex] === null ? "Sin dato" : formatChartValue(item.values[selectedIndex]!, unit) }))}
      description={selectedBucket?.includesToday ? "Hoy · En curso. No modifica los resúmenes de días terminados." : bucketed ? "Cada punto muestra el promedio diario del período." : undefined}
      className="min-h-24"
    />
  </div>;
}

function BalanceChart({ buckets, values }: { buckets: NutritionChartBucket<NutritionReportDay>[]; values: Array<number | null> }) {
  const known = values.some((value) => value !== null);
  const [selected, setSelected] = useState(() => firstSelectableIndex(values));
  const [focused, setFocused] = useState<number | null>(null);
  if (!known) return <p className="py-8 text-sm text-muted-foreground">No hay días con balance energético comparable.</p>;
  const domain = chartDomain(values, true);
  const selectedIndex = Math.min(selected, buckets.length - 1);
  const selectedBucket = buckets[selectedIndex]!;
  const zeroY = chartY(0, domain, HEIGHT, TOP, BOTTOM);
  const value = values[selectedIndex];
  const semantic = value === null ? "Sin dato" : value < 0 ? `Déficit estimado: ${formatChartValue(Math.abs(value), "kcal")}` : value > 0 ? `Superávit estimado: ${formatChartValue(value, "kcal")}` : "Balance estimado: 0 kcal";
  const bucketed = buckets.some((bucket) => bucket.start !== bucket.end);

  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">Fecha · balance energético (kcal){bucketed ? " · promedio diario por período" : ""}</p>
    <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Balance diario. Debajo de cero es déficit estimado y arriba es superávit estimado." style={{ touchAction: "pan-y" }}>
      <ChartGrid domain={domain} unit="kcal" ticks={balanceChartTicks(domain)} skipZeroGridLine />
      <line x1={LEFT} x2={WIDTH - RIGHT} y1={zeroY} y2={zeroY} className="stroke-foreground/55" strokeDasharray="3 3" />
      <line x1={chartBandGeometry(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT).center} x2={chartBandGeometry(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT).center} y1={TOP} y2={HEIGHT - BOTTOM} className="stroke-primary/35" strokeDasharray="2 3" pointerEvents="none" />
      {focused === null ? null : <line x1={chartBandGeometry(focused, buckets.length, WIDTH, LEFT, RIGHT).center} x2={chartBandGeometry(focused, buckets.length, WIDTH, LEFT, RIGHT).center} y1={TOP + 2} y2={HEIGHT - BOTTOM - 2} className="stroke-primary" strokeWidth="2" pointerEvents="none" />}
      {values.map((item, index) => {
        if (item === null) return null;
        const band = chartBandGeometry(index, buckets.length, WIDTH, LEFT, RIGHT);
        const barWidth = Math.max(3, Math.min(18, band.width - 2));
        const x = band.center - barWidth / 2;
        const y = chartY(item, domain, HEIGHT, TOP, BOTTOM);
        return <g key={buckets[index]!.end}>
          <rect x={x} y={Math.min(y, zeroY)} width={barWidth} height={Math.max(1, Math.abs(y - zeroY))} rx="1" className={buckets[index]?.includesToday ? item < 0 ? "fill-primary/45" : "fill-foreground/30" : item < 0 ? "fill-primary" : "fill-foreground/55"} pointerEvents="none" />
          <rect x={band.start} y={TOP} width={band.width} height={HEIGHT - TOP - BOTTOM} fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" style={{ outline: "none" }} aria-label={`${bucketLabel(buckets[index]!, true)}. ${item < 0 ? "Déficit" : "Superávit"} estimado: ${formatChartValue(Math.abs(item), "kcal")}.`} onClick={() => setSelected(index)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} onKeyDown={(event) => keySelect(event, () => setSelected(index))} />
        </g>;
      })}
      <DateTicks buckets={buckets} position={(index) => chartBandGeometry(index, buckets.length, WIDTH, LEFT, RIGHT).center} />
    </svg>
    <ChartDetail title={bucketLabel(selectedBucket, true)} items={[{ label: "Balance", value: semantic }]} description={`${selectedBucket.includesToday ? "Hoy · En curso. " : ""}${bucketed ? "Promedio diario del período. " : ""}Balance = consumo − gasto; no es la desviación contra el objetivo.`} className="min-h-24" />
  </div>;
}

function StepsChart({ buckets, values }: { buckets: NutritionChartBucket<NutritionReportDay>[]; values: Array<number | null> }) {
  const known = values.some((value) => value !== null);
  const [selected, setSelected] = useState(() => firstSelectableIndex(values));
  const [focused, setFocused] = useState<number | null>(null);
  if (!known) return <p className="py-8 text-sm text-muted-foreground">Registrá pasos algunos días para ver la tendencia.</p>;
  const domain = chartDomain(values, { nonNegative: true });
  const selectedIndex = Math.min(selected, buckets.length - 1);
  const selectedBucket = buckets[selectedIndex]!;
  const baseline = chartY(0, domain, HEIGHT, TOP, BOTTOM);
  const bucketed = buckets.some((bucket) => bucket.start !== bucket.end);

  return <div className="space-y-3">
    <p className="text-xs text-muted-foreground">Fecha · pasos{bucketed ? " · promedio diario por período" : ""}</p>
    <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="Pasos registrados por fecha." style={{ touchAction: "pan-y" }}>
      <ChartGrid domain={domain} unit="pasos" />
      <line x1={chartBandGeometry(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT).center} x2={chartBandGeometry(selectedIndex, buckets.length, WIDTH, LEFT, RIGHT).center} y1={TOP} y2={HEIGHT - BOTTOM} className="stroke-primary/35" strokeDasharray="2 3" pointerEvents="none" />
      {focused === null ? null : <line x1={chartBandGeometry(focused, buckets.length, WIDTH, LEFT, RIGHT).center} x2={chartBandGeometry(focused, buckets.length, WIDTH, LEFT, RIGHT).center} y1={TOP + 2} y2={HEIGHT - BOTTOM - 2} className="stroke-primary" strokeWidth="2" pointerEvents="none" />}
      {values.map((value, index) => {
        if (value === null) return null;
        const band = chartBandGeometry(index, buckets.length, WIDTH, LEFT, RIGHT);
        const barWidth = Math.max(3, Math.min(18, band.width - 2));
        return <g key={buckets[index]!.end}>
          <rect x={band.center - barWidth / 2} y={chartY(value, domain, HEIGHT, TOP, BOTTOM)} width={barWidth} height={Math.max(1, baseline - chartY(value, domain, HEIGHT, TOP, BOTTOM))} rx="1" className={buckets[index]?.includesToday ? "fill-primary/45" : "fill-primary/75"} pointerEvents="none" />
          <rect x={band.start} y={TOP} width={band.width} height={HEIGHT - TOP - BOTTOM} fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" style={{ outline: "none" }} aria-label={`${bucketLabel(buckets[index]!, true)}. ${formatChartValue(value, "pasos")}.`} onClick={() => setSelected(index)} onFocus={() => setFocused(index)} onBlur={() => setFocused(null)} onKeyDown={(event) => keySelect(event, () => setSelected(index))} />
        </g>;
      })}
      <DateTicks buckets={buckets} position={(index) => chartBandGeometry(index, buckets.length, WIDTH, LEFT, RIGHT).center} />
    </svg>
    <ChartDetail title={bucketLabel(selectedBucket, true)} items={[{ label: "Pasos", value: values[selectedIndex] === null ? "Sin dato" : formatChartValue(values[selectedIndex]!, "pasos") }]} description={selectedBucket.includesToday ? "Hoy · En curso. No modifica los resúmenes de días terminados." : bucketed ? "Cada barra muestra el promedio diario del período." : undefined} className="min-h-24" />
  </div>;
}

export function NutritionReportCharts({
  days,
  comparison,
  comparisonMode,
  currentHref,
  previousHref,
}: {
  days: NutritionReportDay[];
  comparison: NutritionReportComparison | null;
  comparisonMode: NutritionReportComparisonMode;
  currentHref: string;
  previousHref: string;
}) {
  const [metric, setMetric] = useState<Metric>("energy");
  const chronological = useMemo(() => [...days].reverse(), [days]);
  const buckets = useMemo(() => bucketNutritionChartDays(chronological), [chronological]);
  const comparisonBuckets = useMemo(() => comparison
    ? alignNutritionComparisonBuckets([...comparison.currentDays].reverse(), [...comparison.previousDays].reverse())
    : [], [comparison]);
  const comparisonValues = useMemo(
    () => comparisonBucketValues(comparisonBuckets, metric),
    [comparisonBuckets, metric],
  );
  const energy = useMemo<LineSeries[]>(() => [
    { label: "Consumido", values: buckets.map((bucket) => averageBucketValue(bucket, (day) => day.hasNutrition ? day.calories : null)), className: "text-primary", width: 2.5 },
    { label: "Objetivo", values: buckets.map((bucket) => averageBucketValue(bucket, (day) => day.hasNutrition ? day.targetCalories : null)), className: "text-muted-foreground", dash: "5 4" },
    { label: "Gasto estimado", values: buckets.map((bucket) => averageBucketValue(bucket, (day) => day.hasNutrition ? day.expenditureKcal : null)), className: "text-foreground/70", dash: "1 3", width: 2.5 },
  ], [buckets]);
  const protein = useMemo<LineSeries[]>(() => [
    { label: "Consumida", values: buckets.map((bucket) => averageBucketValue(bucket, (day) => day.hasNutrition ? day.proteinG : null)), className: "text-primary", width: 2.5 },
    { label: "Objetivo", values: buckets.map((bucket) => averageBucketValue(bucket, (day) => day.hasNutrition ? day.targetProteinG : null)), className: "text-muted-foreground", dash: "5 4" },
  ], [buckets]);
  const water = useMemo<LineSeries[]>(() => [
    { label: "Agua", values: buckets.map((bucket) => averageBucketValue(bucket, (day) => day.waterL)), className: "text-primary", width: 2.5 },
    { label: "Objetivo", values: buckets.map((bucket) => averageBucketValue(bucket, (day) => day.targetWaterL)), className: "text-muted-foreground", dash: "5 4" },
  ], [buckets]);
  const balance = useMemo(() => buckets.map((bucket) => averageBucketValue(bucket, (day) => day.hasNutrition ? day.energyBalanceKcal : null)), [buckets]);
  const steps = useMemo(() => buckets.map((bucket) => averageBucketValue(bucket, (day) => day.steps)), [buckets]);
  const isPrevious = comparisonMode === "previous" && comparison !== null;
  const waterKnown = isPrevious
    ? comparisonValues.current.some((value) => value !== null) || comparisonValues.previous.some((value) => value !== null)
    : water.some((series) => series.values.some((value) => value !== null));
  const includesToday = buckets.some((bucket) => bucket.includesToday);
  const comparisonUnitValue = comparisonUnit(metric);

  return <section className="space-y-3" aria-labelledby="nutrition-trends-title">
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 id="nutrition-trends-title" className="text-lg font-semibold tracking-tight">Tendencias</h2>
        <p className="text-xs text-muted-foreground">Los huecos son datos no registrados. Hoy no altera los resúmenes finales.</p>
      </div>
      {includesToday ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Hoy · En curso</span> : null}
    </div>
    <div className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-lg border bg-muted/25 p-1" aria-label="Modo de tendencias">
      <Link scroll={false} href={currentHref} className={cn("flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", !isPrevious ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={!isPrevious ? "page" : undefined}>Actual</Link>
      <Link scroll={false} href={previousHref} className={cn("flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", isPrevious ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={isPrevious ? "page" : undefined}>Vs anterior</Link>
    </div>
    {isPrevious ? <NutritionReportComparisonSummary comparison={comparison} /> : null}
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Métrica de tendencias">
      {metricOptions.map((option) => <button key={option.id} type="button" role="tab" id={`nutrition-trend-tab-${option.id}`} aria-controls="nutrition-trend-workspace" aria-selected={metric === option.id} className={cn("h-10 shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", metric === option.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted")} onClick={() => setMetric(option.id)}>{option.label}</button>)}
    </div>
    <Card id="nutrition-trend-workspace" role="tabpanel" aria-labelledby={`nutrition-trend-tab-${metric}`} className="surface-elevated">
      <CardContent className="space-y-3 p-3 sm:p-4">
        {isPrevious ? <>
          {metric === "balance" || metric === "steps"
            ? <ComparisonBarChart buckets={comparisonBuckets} values={comparisonValues} unit={comparisonUnitValue} balance={metric === "balance"} description={`Comparación de ${metric === "balance" ? "balance energético" : "pasos"} entre el período actual y el anterior.`} />
            : metric === "water" && !waterKnown
              ? <p className="py-8 text-sm text-muted-foreground">No hay agua registrada en estos períodos.</p>
              : <ComparisonLineChart buckets={comparisonBuckets} values={comparisonValues} unit={comparisonUnitValue} description={`Comparación de ${metric === "energy" ? "calorías consumidas" : metric === "protein" ? "proteína" : "agua"} entre el período actual y el anterior.`} />}
          {metric === "energy" ? <p className="text-xs text-muted-foreground">El resumen compara también objetivo y gasto. El gráfico prioriza el consumo para mantener la lectura clara.</p> : null}
          {metric === "water" ? <p className="text-xs text-muted-foreground">El mate se mantiene separado del agua.</p> : null}
        </> : <>
          {metric === "energy" ? <><ChartLegend series={energy} /><LineChart buckets={buckets} series={energy} unit="kcal" description="Tendencia de energía. Eje horizontal: fecha. Eje vertical: calorías." /></> : null}
          {metric === "balance" ? <BalanceChart buckets={buckets} values={balance} /> : null}
          {metric === "protein" ? <><ChartLegend series={protein} /><LineChart buckets={buckets} series={protein} unit="g" description="Tendencia de proteína. Eje horizontal: fecha. Eje vertical: gramos." /></> : null}
          {metric === "water" ? waterKnown ? <><ChartLegend series={water} /><LineChart buckets={buckets} series={water} unit="L" description="Tendencia de agua. Eje horizontal: fecha. Eje vertical: litros." /><p className="text-xs text-muted-foreground">El mate se mantiene separado del agua.</p></> : <p className="py-8 text-sm text-muted-foreground">Registrá agua algunos días para ver la tendencia.</p> : null}
          {metric === "steps" ? <StepsChart buckets={buckets} values={steps} /> : null}
        </>}
      </CardContent>
    </Card>
  </section>;
}
