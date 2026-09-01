"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChartDetail } from "@/components/ui/chart-detail";
import { chartTickIndexes, chartY, chartYAxisTicks, fittedNonNegativeChartDomain, lineSegments, nonNegativeChartDomain } from "@/lib/chart-core";
import {
  comparisonDelta,
  trainingComparisonMetricValue,
  type TrainingComparison,
  type TrainingComparisonMetric,
} from "@/lib/phase2/training-comparison";
import {
  trainingAnalysisComparisonPath,
  trainingAnalysisWorkspacePath,
  type TrainingAnalysisNavigationState,
} from "@/lib/phase2/training-analysis-navigation";
import { formatTrainingAnalysisMetric, formatTrainingVolumeKg } from "@/lib/phase2/training-analysis";
import { cn } from "@/lib/utils";

const METRIC_LABELS: Record<TrainingComparisonMetric, string> = {
  volume: "Volumen",
  sets: "Series",
  sessions: "Sesiones",
  minutes: "Duración",
  averageSets: "Promedio por sesión",
  exerciseCount: "Ejercicios distintos",
  bestWeight: "Mejor peso",
  bestReps: "Máximas reps",
};

function number(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(value);
}

function date(value: string): string {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Cordoba" })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function dateRange(range: { start: string; end: string } | null): string {
  if (!range) return "Sin período comparable";
  return range.start === range.end ? date(range.start) : `${date(range.start)}–${date(range.end)}`;
}

function metricValue(value: number | null, metric: TrainingComparisonMetric): string {
  if (value === null || !Number.isFinite(value)) return "—";
  if (metric === "bestWeight") return `${number(value, 1)} kg`;
  if (metric === "bestReps") return number(value, 1);
  if (metric === "averageSets") return `${number(value, 1)} series`;
  if (metric === "exerciseCount") return `${number(value)} ejercicios`;
  return formatTrainingAnalysisMetric(value, metric);
}

function signedMetricValue(value: number, metric: TrainingComparisonMetric): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${metricValue(Math.abs(value), metric)}`;
}

function metricAxisValue(value: number, metric: TrainingComparisonMetric): string {
  if (metric === "volume") return formatTrainingVolumeKg(value, { compactAxis: true });
  if (metric === "minutes") return value >= 60 ? `${Math.round(value / 60)} h` : `${Math.round(value)} min`;
  if (metric === "bestWeight") return `${number(value, 1)} kg`;
  if (metric === "averageSets") return number(value, 1);
  return number(value, metric === "bestReps" ? 1 : 0);
}

function EmptyState({ children }: { children: import("react").ReactNode }) {
  return <div className="rounded-xl border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">{children}</div>;
}

function ComparisonSelectors({ comparison, state, selectionPath }: { comparison: TrainingComparison; state?: TrainingAnalysisNavigationState; selectionPath?: string }) {
  const router = useRouter();
  const hasSecondOption = comparison.options.length > 1;
  const update = (side: "a" | "b", value: string) => {
    const a = side === "a" ? value : comparison.a?.id ?? null;
    const b = side === "b" ? value : comparison.b?.id ?? null;
    if (selectionPath) {
      const [pathname, search = ""] = selectionPath.split("?");
      const params = new URLSearchParams(search);
      if (a) params.set("a", a); else params.delete("a");
      if (b) params.set("b", b); else params.delete("b");
      router.push(`${pathname}?${params.toString()}`);
      return;
    }
    if (state && comparison.kind !== "previous") router.push(trainingAnalysisComparisonPath(state, comparison.kind, { a, b }));
  };
  if (comparison.mode === "self") {
    return <div className="grid grid-cols-2 gap-2" aria-label="Períodos comparados"><div className="rounded-lg border border-primary/30 bg-primary/8 px-3 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-primary">Actual</p><p className="mt-1 text-sm font-medium">{dateRange(comparison.rangeA)}</p></div><div className="rounded-lg border border-dashed px-3 py-2.5"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Anterior</p><p className="mt-1 text-sm font-medium">{dateRange(comparison.rangeB)}</p></div></div>;
  }
  return <div className="grid gap-2 sm:grid-cols-2" aria-label="Objetos comparados"><label className="space-y-1 text-xs font-medium text-muted-foreground">A<select value={comparison.a?.id ?? ""} onChange={(event) => update("a", event.target.value)} className="h-11 w-full rounded-lg border bg-background px-3 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Objeto A">{comparison.options.map((option) => <option key={option.id} value={option.id} disabled={option.id === comparison.b?.id}>{option.label}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">B<select value={comparison.b?.id ?? ""} onChange={(event) => update("b", event.target.value)} disabled={!hasSecondOption} className="h-11 w-full rounded-lg border bg-background px-3 text-sm font-medium text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-ring" aria-label="Objeto B">{!comparison.b && <option value="">Sin segunda opción</option>}{comparison.options.map((option) => <option key={option.id} value={option.id} disabled={option.id === comparison.a?.id}>{option.label}</option>)}</select></label></div>;
}

function ComparisonSummary({ comparison }: { comparison: TrainingComparison }) {
  if (!comparison.a || !comparison.b) return null;
  const currentLabel = comparison.mode === "self" ? "Actual" : `A · ${comparison.a.label}`;
  const previousLabel = comparison.mode === "self" ? "Anterior" : `B · ${comparison.b.label}`;
  const previousHasData = comparison.b.summary.hasData;
  return <section className="space-y-3" aria-label="Resumen comparativo"><div className="grid grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.95fr))] gap-1.5 text-[10px] sm:text-xs"><span aria-hidden /><p className="truncate text-right font-semibold text-primary">{currentLabel}</p><p className="truncate border-l border-dashed pl-1.5 text-right font-semibold text-foreground">{previousLabel}</p><p className="text-right font-semibold text-muted-foreground">Cambio</p></div><dl className="overflow-hidden rounded-xl border divide-y divide-border/70">{comparison.metrics.map((metric) => {
    const a = trainingComparisonMetricValue(comparison.a!, metric);
    const b = trainingComparisonMetricValue(comparison.b!, metric);
    const delta = comparisonDelta(a, b);
    const deltaLabel = delta.absolute === null
      ? "—"
      : delta.absolute === 0
        ? "0"
        : `${signedMetricValue(delta.absolute, metric)}${comparison.mode === "cross" && delta.percentage !== null ? ` · ${delta.percentage > 0 ? "+" : ""}${number(delta.percentage, 1)}%` : ""}`;
    return <div key={metric} className="grid grid-cols-[minmax(0,1.05fr)_repeat(3,minmax(0,0.95fr))] gap-1.5 px-3 py-3"><dt className="self-center text-[11px] text-muted-foreground sm:text-xs">{METRIC_LABELS[metric]}</dt><dd className="metric-number min-w-0 text-right text-xs font-semibold sm:text-sm">{metricValue(a, metric)}</dd><dd className="metric-number min-w-0 border-l border-dashed pl-1.5 text-right text-xs font-semibold sm:text-sm">{metricValue(b, metric)}</dd><dd className="metric-number min-w-0 text-right text-xs text-muted-foreground sm:text-sm">{deltaLabel}</dd></div>;
  })}</dl>{comparison.mode === "self" && !previousHasData && <p className="text-xs text-muted-foreground">No hay registros en el período anterior; se muestran diferencias absolutas.</p>}</section>;
}

function ComparisonChart({ comparison }: { comparison: TrainingComparison }) {
  const [metric, setMetric] = useState<TrainingComparisonMetric>(comparison.chartMetrics[0] ?? "sets");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!comparison.a || !comparison.b || comparison.timeline.length === 0 || comparison.chartMetrics.length === 0) return null;
  const aValues = comparison.timeline.map((point) => point.a[metric]);
  const bValues = comparison.timeline.map((point) => point.b[metric]);
  const finiteValues = [...aValues, ...bValues].filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (finiteValues.length === 0) return <EmptyState>No hay datos de {METRIC_LABELS[metric].toLocaleLowerCase("es-AR")} para comparar.</EmptyState>;
  const domain = metric === "bestWeight" || metric === "bestReps" ? fittedNonNegativeChartDomain(finiteValues) : nonNegativeChartDomain(finiteValues);
  const width = 340;
  const height = 196;
  const left = 48;
  const right = 12;
  const top = 12;
  const bottom = 34;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const band = plotWidth / comparison.timeline.length;
  const selectedIndex = selectedId ? Math.max(0, comparison.timeline.findIndex((point) => point.id === selectedId)) : comparison.timeline.length - 1;
  const selected = comparison.timeline[selectedIndex]!;
  const aCoordinates = lineSegments(aValues, domain, width, height, left, right, top, bottom);
  const bCoordinates = lineSegments(bValues, domain, width, height, left, right, top, bottom);
  const currentLabel = comparison.mode === "self" ? "Actual" : `A · ${comparison.a.label}`;
  const previousLabel = comparison.mode === "self" ? "Anterior" : `B · ${comparison.b.label}`;
  const summary = `Evolución comparativa de ${METRIC_LABELS[metric].toLocaleLowerCase("es-AR")}. ${currentLabel}; ${previousLabel}.`;
  const compactTimelineLabel = (label: string) => label.replace("Tramo ", "T").replace("Día ", "D").replace("Semana ", "S").replace("Sesión ", "S");
  return <section className="space-y-4" aria-labelledby="training-comparison-chart-title"><div className="space-y-3"><div><h3 id="training-comparison-chart-title" className="text-lg font-semibold tracking-tight">Evolución</h3><p className="mt-1 text-sm text-muted-foreground">{comparison.mode === "self" ? "Los períodos se alinean por posición relativa; el detalle conserva sus fechas reales." : "Ambos objetos comparten el mismo período y los mismos tramos."}</p></div>{comparison.chartMetrics.length > 1 && <div className={cn("mx-auto grid w-full rounded-lg border bg-muted/25 p-1", comparison.chartMetrics.length === 4 ? "max-w-xl grid-cols-4" : "max-w-sm grid-cols-3")} aria-label="Métrica comparativa">{comparison.chartMetrics.map((option) => <button key={option} type="button" onClick={() => { setMetric(option); setSelectedId(null); }} className={cn("h-9 min-w-0 rounded-md px-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:text-xs", metric === option ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-pressed={metric === option}>{METRIC_LABELS[option]}</button>)}</div>}</div><div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda"><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 bg-primary" aria-hidden />{currentLabel}</span><span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 border-t-2 border-dashed border-muted-foreground" aria-hidden />{previousLabel}</span></div><p className="sr-only">{summary}</p><svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={summary} className="h-56 w-full overflow-visible" preserveAspectRatio="none">{chartYAxisTicks(domain, metric === "bestWeight" || metric === "bestReps" ? 5 : 4).map((value) => { const y = chartY(value, domain, height, top, bottom); return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} className="stroke-border" strokeDasharray="2 3" /><text x={left - 7} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{metricAxisValue(value, metric)}</text></g>; })}{aCoordinates.map((segment, index) => <polyline key={index} points={segment.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" className="stroke-primary" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />)}{bCoordinates.map((segment, index) => <polyline key={index} points={segment.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" className="stroke-muted-foreground" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />)}<line x1={left + band * selectedIndex + band / 2} x2={left + band * selectedIndex + band / 2} y1={top} y2={top + plotHeight} className="stroke-primary/55" strokeDasharray="3 3" />{comparison.timeline.map((point, index) => { const center = left + band * index + band / 2; const aValue = point.a[metric]; const bValue = point.b[metric]; const aY = typeof aValue === "number" ? chartY(aValue, domain, height, top, bottom) : null; const bY = typeof bValue === "number" ? chartY(bValue, domain, height, top, bottom) : null; return <g key={point.id}><rect x={left + band * index} y={top} width={band} height={plotHeight} fill="transparent" role="button" tabIndex={0} aria-label={`${point.label}. ${currentLabel}: ${metricValue(aValue, metric)}. ${previousLabel}: ${metricValue(bValue, metric)}.`} aria-pressed={selectedIndex === index} onClick={() => setSelectedId(point.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(point.id); } }} />{aY !== null && <circle cx={center} cy={aY} r={selectedIndex === index ? 4.5 : 3} className="fill-primary stroke-background" strokeWidth="1.4" pointerEvents="none" />}{bY !== null && <circle cx={center} cy={bY} r={selectedIndex === index ? 4.5 : 3} className="fill-background stroke-muted-foreground" strokeWidth="1.7" pointerEvents="none" />}</g>; })}{chartTickIndexes(comparison.timeline.length, 4).map((index) => <text key={comparison.timeline[index]!.id} x={left + band * index + band / 2} y={height - 12} textAnchor="middle" className="fill-muted-foreground text-[9px]">{compactTimelineLabel(comparison.timeline[index]!.label)}</text>)}</svg><ChartDetail title={selected.label} items={[{ label: currentLabel, value: metricValue(selected.a[metric], metric) }, { label: `${currentLabel} · fecha`, value: dateRange(selected.rangeA) }, { label: previousLabel, value: metricValue(selected.b[metric], metric) }, { label: `${previousLabel} · fecha`, value: dateRange(selected.rangeB) }]} /></section>;
}

export function TrainingComparisonWorkspace({ comparison, state, backLabel, exitHref: explicitExitHref, selectionPath }: { comparison: TrainingComparison; state?: TrainingAnalysisNavigationState; backLabel: string; exitHref?: string; selectionPath?: string }) {
  const exitHref = explicitExitHref ?? (state ? trainingAnalysisWorkspacePath({ ...state, comparison: undefined, comparisonA: null, comparisonB: null, comparisonSubjectType: null, comparisonSubject: null }) : "/train/progress");
  const hasPair = Boolean(comparison.a && comparison.b);
  const hasAnyData = Boolean(comparison.a?.summary.hasData || comparison.b?.summary.hasData);
  return <div className="space-y-6"><section className="space-y-4"><Link href={exitHref} className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden />{backLabel}</Link><div><h2 className="text-xl font-semibold tracking-tight">{comparison.title}</h2>{comparison.subjectLabel && <p className="mt-1 text-base font-medium">{comparison.subjectLabel}</p>}<p className="mt-1 text-sm text-muted-foreground">{comparison.mode === "self" ? "Mismo objeto en dos períodos equivalentes, usando sesiones finalizadas." : "Dos objetos durante el mismo período. Las diferencias son neutrales y se expresan como A − B."}</p></div><ComparisonSelectors comparison={comparison} state={state} selectionPath={selectionPath} /></section>{!hasPair ? <EmptyState>Necesitás al menos dos opciones distintas para comparar en este período.</EmptyState> : !hasAnyData ? <EmptyState>No hay sesiones finalizadas en ninguno de los dos períodos.</EmptyState> : <><ComparisonSummary comparison={comparison} /><ComparisonChart comparison={comparison} /></>}</div>;
}
