"use client";

import Link from "next/link";
import { ChevronRight, Settings2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { ChartDetail } from "@/components/ui/chart-detail";
import { formatDurationMinutes } from "@/lib/daily-metrics/core";
import type { MetricReportComparison, MetricReportDay, MetricReportDefinition, MetricReportSummary } from "@/lib/daily-metrics/reports-core";
import { comparisonInsufficientMessage, type ProgressComparisonMetricResult, type ProgressComparisonReport } from "@/lib/progress/comparisons";
import { chartDomain, chartTickIndexes, chartX, chartY, lineSegments } from "@/lib/nutrition/report-chart-core";
import { cn } from "@/lib/utils";

const WIDTH = 320;
const HEIGHT = 188;
const LEFT = 50;
const RIGHT = 12;
const TOP = 14;
const BOTTOM = 28;
const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`)).replace(" de ", " ").replace(".", "");
}

function formatValue(value: number | null, metric: MetricReportDefinition) {
  if (value === null) return "—";
  if (metric.value_type === "duration") return formatDurationMinutes(Math.round(value));
  const formatted = metric.value_type === "integer" ? integer.format(value) : number.format(value);
  return `${formatted}${metric.unit ? ` ${metric.unit}` : ""}`;
}

function formatDelta(result: ProgressComparisonMetricResult, metric: MetricReportDefinition) {
  if (result.eligibility.status !== "comparable" || result.deltaAbsolute === null) return "Sin comparación suficiente";
  const sign = result.deltaAbsolute > 0 ? "+" : result.deltaAbsolute < 0 ? "−" : "";
  return `${sign}${formatValue(Math.abs(result.deltaAbsolute), metric)}`;
}

function coverageLabel(result: ProgressComparisonMetricResult) {
  const { registeredCount, eligibleCount, coverageRatio } = result.primary.coverage;
  const count = eligibleCount === null ? `${registeredCount} registros` : `${registeredCount} de ${eligibleCount} días`;
  return coverageRatio === null ? count : `${count} · ${percent.format(coverageRatio * 100)}%`;
}

function metricId(result: ProgressComparisonMetricResult) {
  return String(result.metric.metadata?.definitionId ?? "");
}

function SectionTitle({ id, title, detail }: { id: string; title: string; detail?: string }) {
  return <div><h2 id={id} className="text-lg font-semibold tracking-tight">{title}</h2>{detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}</div>;
}

function MetricEvolution({ result, definition, referenceLabel }: { result: ProgressComparisonMetricResult; definition: MetricReportDefinition; referenceLabel: string }) {
  const [compare, setCompare] = useState(true);
  const points = result.alignedSeries;
  const current = points.map((point) => point.primary?.value ?? null);
  const reference = points.map((point) => point.reference?.value ?? null);
  const domain = chartDomain([...current, ...(compare ? reference : []), compare ? null : definition.target_value], { nonNegative: true });
  const [selected, setSelected] = useState(() => Math.max(current.findLastIndex((value) => value !== null), 0));
  const selectedIndex = Math.min(selected, Math.max(points.length - 1, 0));
  const yTicks = [domain.max, domain.max * 2 / 3, domain.max / 3, 0];
  const comparisonLabel = result.reference.type === "goal" ? result.reference.goal.label : referenceLabel;
  const targetY = !compare && definition.target_value !== null ? chartY(definition.target_value, domain, HEIGHT, TOP, BOTTOM) : null;

  if (!current.some((value) => value !== null) && !reference.some((value) => value !== null)) {
    return <p className="py-10 text-sm text-muted-foreground">No hay registros suficientes para graficar este período.</p>;
  }

  return <div className="space-y-3">
    <div className="grid grid-cols-2 rounded-lg border bg-muted/25 p-1">
      <button type="button" onClick={() => setCompare(false)} className={cn("min-h-11 rounded-md text-xs font-medium", !compare ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>Actual</button>
      <button type="button" onClick={() => setCompare(true)} className={cn("min-h-11 rounded-md text-xs font-medium", compare ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>{result.reference.type === "goal" ? "Vs objetivo" : "Vs anterior"}</button>
    </div>
    {compare && result.eligibility.status !== "comparable" ? <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{comparisonInsufficientMessage(result.eligibility)}</p> : null}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-primary" />Actual</span>
      {compare ? <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-muted-foreground" />{comparisonLabel}</span> : null}
      {!compare && definition.target_value !== null ? <span className="flex items-center gap-1.5"><span className="w-5 border-t border-dashed border-muted-foreground" />Objetivo actual</span> : null}
    </div>
    <svg className="block h-auto w-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={`Evolución de ${definition.name}`} style={{ touchAction: "pan-y" }}>
      {yTicks.map((tick) => <g key={tick}><line x1={LEFT} x2={WIDTH - RIGHT} y1={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} y2={chartY(tick, domain, HEIGHT, TOP, BOTTOM)} className="stroke-border" strokeDasharray="2 3" /><text x={LEFT - 6} y={chartY(tick, domain, HEIGHT, TOP, BOTTOM) + 3} textAnchor="end" className="fill-muted-foreground text-[8px]">{formatValue(tick, definition)}</text></g>)}
      {targetY === null ? null : <line x1={LEFT} x2={WIDTH - RIGHT} y1={targetY} y2={targetY} className="stroke-muted-foreground" strokeDasharray="5 4" />}
      {lineSegments(current, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={`current-${index}`} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" className="text-primary" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}
      {compare ? lineSegments(reference, domain, WIDTH, HEIGHT, LEFT, RIGHT, TOP, BOTTOM).map((segment, index) => <polyline key={`reference-${index}`} points={segment.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" className="text-muted-foreground" stroke="currentColor" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />) : null}
      {current.map((value, index) => value === null ? null : <circle key={index} cx={chartX(index, current.length, WIDTH, LEFT, RIGHT)} cy={chartY(value, domain, HEIGHT, TOP, BOTTOM)} r={selectedIndex === index ? 4 : 2.5} className="fill-primary" />)}
      {points.map((point, index) => <rect key={point.index} x={Math.max(LEFT, chartX(index, points.length, WIDTH, LEFT, RIGHT) - 14)} y={TOP} width="28" height={HEIGHT - TOP - BOTTOM} fill="transparent" role="button" tabIndex={0} aria-label={`Bloque ${index + 1}. Ver detalle.`} onClick={() => setSelected(index)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelected(index); }} />)}
      {chartTickIndexes(points.length, 4).map((index) => <text key={index} x={chartX(index, points.length, WIDTH, LEFT, RIGHT)} y={HEIGHT - 5} textAnchor="middle" className="fill-muted-foreground text-[9px]">D{index + 1}</text>)}
    </svg>
    <ChartDetail title={`Bloque ${selectedIndex + 1}`} items={[{ label: "Actual", value: formatValue(current[selectedIndex] ?? null, definition) }, ...(compare ? [{ label: comparisonLabel, value: formatValue(reference[selectedIndex] ?? null, definition) }] : [])]} className="min-h-20" />
  </div>;
}

function MetricRows({ results, definitions, hrefFor }: { results: ProgressComparisonMetricResult[]; definitions: Map<string, MetricReportDefinition>; hrefFor: (id: string) => string }) {
  return <div className="divide-y overflow-hidden rounded-xl border bg-card surface-elevated">{results.map((result) => {
    const definition = definitions.get(metricId(result));
    if (!definition) return null;
    return <Link key={result.metric.key} href={hrefFor(definition.id)} className="flex min-h-16 items-center gap-3 px-4 py-3 outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block font-semibold">{definition.name}</span><span className="metric-number mt-0.5 block text-sm">{formatValue(result.valueA, definition)}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatDelta(result, definition)}</span></span><ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /></Link>;
  })}</div>;
}

export function DailyMetricReport({ definitions, metric, days, summary, defaultComparison, progressComparison, isDetail }: {
  definitions: MetricReportDefinition[];
  metric: MetricReportDefinition;
  days: MetricReportDay[];
  summary: MetricReportSummary;
  comparison: MetricReportComparison | null;
  defaultComparison: ProgressComparisonReport;
  progressComparison: ProgressComparisonReport | null;
  isDetail: boolean;
}) {
  const searchParams = useSearchParams();
  const report = progressComparison ?? defaultComparison;
  const definitionsById = useMemo(() => new Map(definitions.map((definition) => [definition.id, definition])), [definitions]);
  const activeResults = report.results.filter((result) => result.metric.metadata?.isActive !== false);
  const visibleResults = activeResults.filter((result) => result.primary.coverage.sampleSize > 0);
  const [chartMetricKey, setChartMetricKey] = useState(() => report.activeMetricKey ?? visibleResults[0]?.metric.key ?? "");
  const chartResult = report.results.find((result) => result.metric.key === chartMetricKey) ?? visibleResults[0] ?? null;
  const selectedResult = report.results.find((result) => metricId(result) === metric.id) ?? defaultComparison.results.find((result) => metricId(result) === metric.id) ?? null;

  function hrefFor(metricIdValue: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("metric", metricIdValue);
    return `/progress/metrics?${next.toString()}`;
  }

  if (!isDetail) {
    const insights = report.insights.filter((insight) => activeResults.some((result) => result.metric.key === insight.metricKey)).slice(0, 3);
    const objectiveResults = activeResults.filter((result) => definitionsById.get(metricId(result))?.target_value !== null);
    return <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="activity-overview-title"><SectionTitle id="activity-overview-title" title="Cómo venís" detail="Tus métricas activas con registros útiles en el período." />{visibleResults.length ? <MetricRows results={visibleResults} definitions={definitionsById} hrefFor={hrefFor} /> : <Card><CardContent className="py-8 text-sm text-muted-foreground">Todavía no hay registros suficientes en las métricas activas para resumir este período.</CardContent></Card>}</section>
      <section className="space-y-3" aria-labelledby="activity-changes-title"><SectionTitle id="activity-changes-title" title="Qué cambió" /><div className="divide-y overflow-hidden rounded-xl border bg-card surface-elevated">{insights.length ? insights.map((insight) => <div key={insight.metricKey} className="px-4 py-3"><p className="font-semibold">{insight.title}</p><p className="mt-0.5 text-sm text-muted-foreground">{insight.description}</p></div>) : <p className="px-4 py-6 text-sm text-muted-foreground">No hubo cambios relevantes con cobertura suficiente en las métricas activas.</p>}</div></section>
      {visibleResults.length ? <section className="space-y-3" aria-labelledby="activity-consistency-title"><SectionTitle id="activity-consistency-title" title="Consistencia" detail="Cobertura de registro; no representa cumplimiento del objetivo." /><div className="divide-y overflow-hidden rounded-xl border bg-card surface-elevated">{visibleResults.map((result) => <div key={result.metric.key} className="flex items-center justify-between gap-3 px-4 py-3"><span className="font-medium">{result.metric.label}</span><span className="metric-number text-sm text-muted-foreground">{coverageLabel(result)}</span></div>)}</div></section> : null}
      {objectiveResults.length ? <section className="space-y-3" aria-labelledby="activity-goals-title"><SectionTitle id="activity-goals-title" title="Objetivos" detail="Referencias actuales; la definición todavía no indica mínimo, máximo o rango." /><div className="divide-y overflow-hidden rounded-xl border bg-card surface-elevated">{objectiveResults.map((result) => { const definition = definitionsById.get(metricId(result))!; return <div key={result.metric.key} className="flex items-center justify-between gap-3 px-4 py-3"><span className="font-medium">{definition.name}</span><span className="metric-number text-sm">{formatValue(definition.target_value, definition)}</span></div>; })}</div></section> : null}
      {chartResult ? <section className="space-y-3" aria-labelledby="activity-evolution-title"><SectionTitle id="activity-evolution-title" title="Evolución" detail="Una métrica por escala; los huecos no se convierten en cero." /><label className="block"><span className="sr-only">Métrica del gráfico</span><select value={chartResult.metric.key} onChange={(event) => setChartMetricKey(event.target.value)} className="h-11 w-full rounded-xl border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">{visibleResults.map((result) => <option key={result.metric.key} value={result.metric.key}>{result.metric.label}</option>)}</select></label><Card className="surface-elevated"><CardContent className="p-3 sm:p-4"><MetricEvolution result={chartResult} definition={definitionsById.get(metricId(chartResult))!} referenceLabel={report.reference.label} /></CardContent></Card></section> : null}
      <Link href="/settings/metrics" className="flex min-h-11 items-center justify-between rounded-xl border bg-card px-4 py-3 font-medium outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center gap-2"><Settings2 className="size-4 text-primary" aria-hidden />Gestionar métricas</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></Link>
    </div>;
  }

  if (!selectedResult) return <Card><CardContent className="py-8 text-sm text-muted-foreground">Esta métrica no está disponible para el período seleccionado.</CardContent></Card>;
  const registered = days.filter((day) => day.value !== null).slice(0, 7);
  const insight = report.insights.find((item) => item.metricKey === selectedResult.metric.key);
  const summaryReferenceLabel = selectedResult.reference.type === "goal" ? "Objetivo" : report.reference.label;
  return <div className="space-y-6">
    <section className="space-y-3" aria-labelledby="metric-summary-title"><div className="flex items-center justify-between gap-3"><SectionTitle id="metric-summary-title" title={metric.name} detail="Resumen del período" />{!metric.is_active ? <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-semibold text-muted-foreground">Archivada</span> : null}</div><Card className="surface-elevated"><CardContent className="grid grid-cols-2 gap-4 p-4"><div><p className="text-xs text-muted-foreground">Promedio diario</p><p className="metric-number mt-1 text-xl font-semibold">{formatValue(selectedResult.valueA, metric)}</p></div><div><p className="text-xs text-muted-foreground">{summaryReferenceLabel}</p><p className="metric-number mt-1 text-xl font-semibold">{formatValue(selectedResult.valueB, metric)}</p></div><div><p className="text-xs text-muted-foreground">Cambio</p><p className="metric-number mt-1 font-semibold">{formatDelta(selectedResult, metric)}</p></div><div><p className="text-xs text-muted-foreground">Cobertura</p><p className="metric-number mt-1 font-semibold">{coverageLabel(selectedResult)}</p></div>{metric.target_value !== null ? <div className="col-span-2 border-t pt-3"><p className="text-xs text-muted-foreground">Objetivo actual · referencia sin dirección configurada</p><p className="metric-number mt-1 font-semibold">{formatValue(metric.target_value, metric)}</p></div> : null}</CardContent></Card></section>
    <section className="space-y-3" aria-labelledby="metric-change-title"><SectionTitle id="metric-change-title" title="Qué cambió" /><Card><CardContent className="py-4"><p className="font-semibold">{insight?.title ?? metric.name}</p><p className="mt-1 text-sm text-muted-foreground">{insight?.description ?? (selectedResult.eligibility.status === "comparable" ? selectedResult.change === "stable" ? "El promedio se mantuvo prácticamente estable." : `Cambio del período: ${formatDelta(selectedResult, metric)}.` : comparisonInsufficientMessage(selectedResult.eligibility))}</p></CardContent></Card></section>
    <section className="space-y-3" aria-labelledby="metric-evolution-title"><SectionTitle id="metric-evolution-title" title="Evolución" detail="Los huecos representan días sin registro." /><Card className="surface-elevated"><CardContent className="p-3 sm:p-4"><MetricEvolution result={selectedResult} definition={metric} referenceLabel={report.reference.label} /></CardContent></Card></section>
    {summary.registeredDays >= 3 ? <section className="space-y-3" aria-labelledby="metric-distribution-title"><SectionTitle id="metric-distribution-title" title="Distribución" detail={`${summary.registeredDays} registros elegibles`} /><div className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-card surface-elevated"><div className="p-3"><p className="text-xs text-muted-foreground">Mínimo</p><p className="metric-number mt-1 font-semibold">{formatValue(summary.minimum, metric)}</p></div><div className="p-3"><p className="text-xs text-muted-foreground">Mediana</p><p className="metric-number mt-1 font-semibold">{formatValue(summary.median, metric)}</p></div><div className="p-3"><p className="text-xs text-muted-foreground">Máximo</p><p className="metric-number mt-1 font-semibold">{formatValue(summary.maximum, metric)}</p></div></div></section> : null}
    <section className="space-y-3" aria-labelledby="metric-history-title"><SectionTitle id="metric-history-title" title="Registros recientes" />{registered.length ? <div className="divide-y overflow-hidden rounded-xl border bg-card surface-elevated">{registered.map((day) => <div key={day.date} className="flex items-center justify-between gap-3 px-4 py-3 text-sm"><span className="capitalize text-muted-foreground">{dateLabel(day.date)}{day.isToday ? " · Hoy" : ""}</span><span className="metric-number font-semibold">{formatValue(day.value, metric)}</span></div>)}</div> : <Card><CardContent className="py-8 text-sm text-muted-foreground">No registraste {metric.name} en este período.</CardContent></Card>}</section>
    <Link href="/settings/metrics" className="flex min-h-11 items-center justify-between rounded-xl border bg-card px-4 py-3 font-medium outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"><span className="flex items-center gap-2"><Settings2 className="size-4 text-primary" aria-hidden />Editar métrica</span><ChevronRight className="size-4 text-muted-foreground" aria-hidden /></Link>
  </div>;
}
