"use client";

import { useMemo, useState } from "react";

import { ChartDetail } from "@/components/ui/chart-detail";
import {
  chartDomain,
  chartTickIndexes,
  chartX,
  chartY,
  chartYAxisTicks,
  lineSegments,
} from "@/lib/chart-core";
import { formatProgressMetricValue } from "@/lib/progress/analytics";
import type { ProgressComparisonMetricResult, ProgressComparisonReport } from "@/lib/progress/comparisons";

const WIDTH = 320;
const HEIGHT = 190;
const LEFT = 48;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 28;

function axisLabel(value: number, result: ProgressComparisonMetricResult) {
  if (result.metric.metadata?.valueType === "duration") {
    const hours = value / 60;
    return `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: hours >= 10 ? 0 : 1 }).format(hours)} h`;
  }
  return new Intl.NumberFormat("es-AR", {
    notation: Math.abs(value) >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: result.metric.format.maximumFractionDigits,
  }).format(value);
}

function relativeLabel(index: number, bucket: ProgressComparisonReport["bucket"]) {
  const prefix = bucket === "day" ? "D" : bucket === "week" ? "S" : "M";
  return `${prefix}${index + 1}`;
}

export function ComparisonEvolution({
  report,
  activeMetricKey,
  onMetricChange,
  showReference = true,
}: {
  report: ProgressComparisonReport;
  activeMetricKey: string | null;
  onMetricChange: (key: string) => void;
  showReference?: boolean;
}) {
  const result = report.results.find((item) => item.metric.key === activeMetricKey) ?? report.results[0] ?? null;
  const [selected, setSelected] = useState<number | null>(null);
  const values = useMemo(() => result?.alignedSeries.map((point) => point.primary?.value ?? null) ?? [], [result]);
  const referenceValues = useMemo(() => result?.alignedSeries.map((point) => showReference ? point.reference?.value ?? null : null) ?? [], [result, showReference]);
  const lastAvailable = Math.max(...values.map((value, index) => value !== null ? index : -1), 0);
  const selectedIndex = Math.min(selected ?? lastAvailable, Math.max(values.length - 1, 0));

  if (!result) return <p className="py-8 text-sm text-muted-foreground">Elegí al menos una métrica comparable.</p>;
  const allValues = [...values, ...referenceValues];
  const hasSemanticZero = result.metric.comparison?.signSemantic === "energy_balance";
  const includeZero = hasSemanticZero || allValues.some((value) => typeof value === "number" && value < 0);
  const domain = chartDomain(allValues, includeZero);
  const primarySegments = lineSegments(values, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM);
  const referenceSegments = lineSegments(referenceValues, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM);
  const referenceLabel = report.reference.type === "goal" ? "Objetivo" : "Comparación";
  const primaryHasData = values.some((value) => value !== null);
  const cannotRender = showReference ? result.eligibility.status !== "comparable" : !primaryHasData;

  return <div className="space-y-4">
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Métrica</span>
      <select value={result.metric.key} onChange={(event) => { setSelected(null); onMetricChange(event.target.value); }} className="h-11 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {report.results.map((item) => <option key={item.metric.key} value={item.metric.key}>{item.metric.label}</option>)}
      </select>
    </label>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-primary" />Principal</span>
      {showReference ? <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-muted-foreground" />{referenceLabel}</span> : null}
    </div>
    {cannotRender ? <p className="rounded-xl border bg-muted/20 px-4 py-6 text-sm text-muted-foreground">{showReference ? "No hay suficientes datos para graficar esta comparación." : "No hay datos para graficar este período."}</p> : <>
      <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Evolución comparada de ${result.metric.label}`} style={{ touchAction: "pan-y" }}>
        {chartYAxisTicks(domain).map((tick) => <g key={tick}>
          <line x1={LEFT} x2={WIDTH - RIGHT} y1={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} y2={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} className="stroke-border" strokeDasharray="2 3" />
          <text x={LEFT - 6} y={chartY(tick, domain, HEIGHT, TOP, BOTTOM) + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">{axisLabel(tick, result)}</text>
        </g>)}
        {hasSemanticZero ? <line x1={LEFT} x2={WIDTH - RIGHT} y1={chartY(0, domain, HEIGHT, TOP, BOTTOM)} y2={chartY(0, domain, HEIGHT, TOP, BOTTOM)} className="stroke-foreground/55" strokeDasharray="3 3" /> : null}
        {primarySegments.map((segment, index) => <polyline key={`a-${index}`} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" className="text-primary" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
        {showReference ? referenceSegments.map((segment, index) => <polyline key={`b-${index}`} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" className="text-muted-foreground" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />) : null}
        {values.map((value, index) => value === null ? null : <circle key={index} cx={chartX(index, values.length, WIDTH, LEFT, RIGHT)} cy={chartY(value, domain, HEIGHT, TOP, BOTTOM)} r={selectedIndex === index ? 4 : 2.5} className="fill-primary" />)}
        {values.map((_, index) => <rect key={`hit-${index}`} x={Math.max(LEFT, chartX(index, values.length, WIDTH, LEFT, RIGHT) - 18)} y={TOP} width="36" height={HEIGHT - TOP - BOTTOM} fill="transparent" role="button" tabIndex={0} aria-label={`${relativeLabel(index, report.bucket)}. Ver detalle.`} onClick={() => setSelected(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(index); }} />)}
        {chartTickIndexes(values.length, 4).map((index) => <text key={index} x={chartX(index, values.length, WIDTH, LEFT, RIGHT)} y={HEIGHT - 5} textAnchor="middle" className="fill-muted-foreground text-[9px]">{relativeLabel(index, report.bucket)}</text>)}
      </svg>
      <ChartDetail title={relativeLabel(selectedIndex, report.bucket)} items={[
        { label: "Principal", value: formatProgressMetricValue(values[selectedIndex] ?? null, result.metric) },
        ...(showReference ? [{ label: referenceLabel, value: formatProgressMetricValue(referenceValues[selectedIndex] ?? null, result.metric) }] : []),
      ]} className="min-h-20" />
    </>}
  </div>;
}
