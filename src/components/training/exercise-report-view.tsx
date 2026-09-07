"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartDetail } from "@/components/ui/chart-detail";
import { TrainingComparisonWorkspace, TrainingSelfComparisonContent } from "@/components/training/training-comparison-workspace";
import {
  chartTickIndexes,
  chartX,
  chartY,
  chartYAxisTicks,
  fittedNonNegativeChartDomain,
  formatChartValue,
  lineSegments,
  nonNegativeChartDomain,
  type ChartUnit,
} from "@/lib/chart-core";
import { formatTrainingVolumeKg } from "@/lib/phase2/training-analysis";
import type { TrainingComparison } from "@/lib/phase2/training-comparison";
import {
  buildExerciseReportPoints,
  buildExercisePerformance,
  completedExerciseSets,
  selectedExerciseReportPointIndex,
  summarizeExerciseReport,
  type ExercisePerformanceMark,
  type ExerciseReportPoint,
  type ExerciseReportSession,
} from "@/lib/phase2/exercise-insights";
import { cn } from "@/lib/utils";

type ChartMetric = "weight" | "reps" | "volume";

const ADJUSTMENT_LABELS = { maintain: "Mantener", increase_weight: "+ Peso", increase_reps: "+ Repeticiones", custom: "Personalizado" };
const PERIOD_OPTIONS = [{ value: "1w", label: "1 semana" }, { value: "2w", label: "2 semanas" }, { value: "3w", label: "3 semanas" }, { value: "4w", label: "4 semanas" }, { value: "8w", label: "8 semanas" }, { value: "3m", label: "3 meses" }, { value: "6m", label: "6 meses" }, { value: "1y", label: "1 año" }, { value: "all", label: "Todo" }];

function number(value: number | null, suffix = "") { return value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`; }
function date(value: string, year = true) { return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "America/Argentina/Cordoba" }).format(new Date(`${value}T12:00:00Z`)).replace(".", ""); }
function rangeLabel(range: { start: string; end: string } | null) { return range ? `${date(range.start, false)}–${date(range.end, false)}` : null; }
function metricValue(point: ExerciseReportPoint, metric: ChartMetric) { return metric === "weight" ? point.bestWeightKg : metric === "reps" ? point.bestReps : point.volumeKg; }
function metricLabel(metric: ChartMetric) { return metric === "weight" ? "Peso" : metric === "reps" ? "Reps" : "Volumen"; }
function metricDisplay(value: number | null, metric: ChartMetric) { return value === null ? "—" : metric === "weight" ? number(value, " kg") : metric === "volume" ? formatTrainingVolumeKg(value) : number(value); }
function chartUnit(metric: ChartMetric): ChartUnit { return metric === "weight" || metric === "volume" ? "kg" : "reps"; }

function performanceValue(mark: ExercisePerformanceMark): string {
  if (mark.kind === "weight") return number(mark.weightKg, " kg");
  if (mark.kind === "volume") return formatTrainingVolumeKg(mark.value);
  return mark.reps === null || mark.weightKg === null ? "—" : `${number(mark.reps)} reps × ${number(mark.weightKg)} kg`;
}

function performanceDescription(mark: ExercisePerformanceMark): string {
  const when = date(mark.logDate);
  if (mark.kind === "weight") return mark.reps === null ? when : `${number(mark.reps)} reps · ${when}`;
  if (mark.kind === "volume") return `${mark.completedSets ?? 0} ${(mark.completedSets ?? 0) === 1 ? "serie" : "series"} · ${when}`;
  return when;
}

function performanceLabel(mark: ExercisePerformanceMark): string {
  if (mark.kind === "weight") return "Mejor peso";
  if (mark.kind === "volume") return "Mejor volumen";
  return "Mejores reps con carga";
}

function ExercisePerformanceSection({ sessions }: { sessions: ExerciseReportSession[] }) {
  const performance = useMemo(() => buildExercisePerformance(sessions), [sessions]);
  const marks = [performance.bestWeight, performance.bestVolume, performance.bestReps].filter((mark): mark is ExercisePerformanceMark => mark !== null);
  if (marks.length === 0) return null;

  return <section className="space-y-3" aria-labelledby="exercise-performance-title">
    <div><h2 id="exercise-performance-title" className="text-lg font-semibold">Rendimiento</h2><p className="mt-1 text-sm text-muted-foreground">Marcas personales de sesiones finalizadas.</p></div>
    <dl className="overflow-hidden rounded-xl border divide-y divide-border/70">
      {marks.map((mark) => <div key={mark.kind} className="flex min-h-14 items-center justify-between gap-4 px-3 py-3"><dt className="min-w-0 text-sm text-muted-foreground">{performanceLabel(mark)}<span className="mt-0.5 block text-xs">{performanceDescription(mark)}</span></dt><dd className="metric-number shrink-0 text-right text-sm font-semibold">{performanceValue(mark)}</dd></div>)}
    </dl>
    {performance.recentMarks.length > 0 && <div className="space-y-1"><h3 className="text-sm font-semibold">Marcas recientes</h3><ul className="divide-y divide-border/70">{performance.recentMarks.map((mark) => <li key={`${mark.kind}-${mark.sessionId}`} className="flex min-h-10 items-center justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate text-muted-foreground">{date(mark.logDate)} · {performanceLabel(mark)}</span><span className="metric-number shrink-0 font-medium">{performanceValue(mark)}</span></li>)}</ul></div>}
  </section>;
}

function EvolutionChart({ points, metric }: { points: ExerciseReportPoint[]; metric: ChartMetric }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const visible = points.filter((point) => metricValue(point, metric) !== null);
  if (visible.length === 0) return <div className="flex h-48 items-center justify-center rounded-xl border border-dashed px-5 text-center text-sm text-muted-foreground">No hay datos de {metricLabel(metric).toLocaleLowerCase("es-AR")} para este período.</div>;

  const values = visible.map((point) => metricValue(point, metric)!);
  const unit = chartUnit(metric);
  const isBar = metric === "volume";
  const domain = metric === "weight" || metric === "reps" ? fittedNonNegativeChartDomain(values) : nonNegativeChartDomain(values);
  const selectedIndex = selectedExerciseReportPointIndex(visible, selectedSessionId);
  const coordinates = isBar ? [] : lineSegments(values, domain, 320, 160, 46, 12, 12, 28)[0] ?? [];
  const maximum = Math.max(...values);
  const summary = `Evolución de ${metricLabel(metric).toLocaleLowerCase("es-AR")}. Eje horizontal: sesiones reales. Eje vertical: ${unit}. Primera: ${metricDisplay(values[0]!, metric)}. Última: ${metricDisplay(values.at(-1) ?? null, metric)}. Máxima: ${metricDisplay(maximum, metric)}.`;
  const band = 262 / visible.length;
  const baselineY = chartY(0, domain, 160, 12, 28);

  return <div className="space-y-2"><p className="text-xs text-muted-foreground">Sesiones reales · {unit}</p><p className="sr-only">{summary}</p><svg viewBox="0 0 320 160" role="group" aria-label={summary} className="h-48 w-full overflow-visible lg:h-64">{chartYAxisTicks(domain, metric === "weight" || metric === "reps" ? 5 : 4).map((value) => { const y = chartY(value, domain, 160, 12, 28); return <g key={value}><line x1="46" x2="308" y1={y} y2={y} className="stroke-border" strokeDasharray="2 3"/><text x="40" y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{formatChartValue(value, unit)}</text></g>; })}{!isBar && <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" className="stroke-primary" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}{visible.map((point, index) => { const x = chartX(index, visible.length, 320, 46, 12); const y = chartY(values[index]!, domain, 160, 12, 28); const selected = selectedIndex === index; const barWidth = Math.max(6, Math.min(24, band * 0.6)); return <g key={point.sessionId}>{isBar && <rect x={x - barWidth / 2} y={y} width={barWidth} height={Math.max(0, baselineY - y)} rx="4" className={selected ? "fill-primary" : "fill-primary/60"} pointerEvents="none" />}{isBar ? <rect x={46 + band * index} y="12" width={band} height="120" fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" aria-label={`${date(point.logDate)}. ${metricLabel(metric)}: ${metricDisplay(values[index]!, metric)}.`} onClick={() => setSelectedSessionId(point.sessionId)} onFocus={() => setSelectedSessionId(point.sessionId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSessionId(point.sessionId); } }} /> : <><circle cx={x} cy={y} r="10" fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" aria-label={`${date(point.logDate)}. ${metricLabel(metric)}: ${metricDisplay(values[index]!, metric)}.`} onClick={() => setSelectedSessionId(point.sessionId)} onFocus={() => setSelectedSessionId(point.sessionId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSessionId(point.sessionId); } }} /><circle cx={x} cy={y} r={selected ? 4.5 : 3} className="fill-primary stroke-background" strokeWidth="1.4" pointerEvents="none" /></>}</g>; })}</svg><div className="relative h-4 text-[10px] text-muted-foreground" aria-hidden>{chartTickIndexes(visible.length).map((index) => <span key={visible[index]!.sessionId} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(chartX(index, visible.length, 320, 46, 12) / 320) * 100}%` }}>{date(visible[index]!.logDate, false)}</span>)}</div><ChartDetail title={date(visible[selectedIndex]!.logDate)} items={[{ label: metric === "reps" ? "Repeticiones" : metricLabel(metric), value: metricDisplay(values[selectedIndex]!, metric) }]} /></div>;
}

function ReportSessions({ sessions }: { sessions: ExerciseReportSession[] }) {
  const [open, setOpen] = useState<string | null>(sessions[0]?.sessionId ?? null);
  return <div className="space-y-2">{sessions.map((session) => {
    const isOpen = open === session.sessionId;
    const summary = summarizeExerciseReport([session]);
    const completed = completedExerciseSets(session.sets);
    return <Card key={session.sessionId} className="overflow-hidden"><button type="button" className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setOpen(isOpen ? null : session.sessionId)} aria-expanded={isOpen}>
      <span className="min-w-0"><span className="block text-sm font-semibold">{date(session.logDate)} · {session.routineName}</span><span className="metric-number mt-1 block text-xs text-muted-foreground">{completed.length} {completed.length === 1 ? "serie" : "series"} · mejor {number(summary.bestWeightKg, " kg")} · volumen {number(summary.totalVolumeKg, " kg")}</span></span>
      {isOpen ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </button>{isOpen && <CardContent className="space-y-2 border-t py-3">{completed.length === 0 ? <p className="text-sm text-muted-foreground">No hay series completadas en esta sesión.</p> : completed.map((set) => <div key={set.id} className="grid grid-cols-[2rem_1fr] gap-x-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="font-semibold">S{set.set_number}</span><div><p><span className="text-muted-foreground">Real </span>{set.actual_reps ?? "—"} × {set.actual_weight_kg ?? "—"} kg</p><p className="mt-0.5 text-xs text-muted-foreground">Objetivo {set.target_reps ?? "—"} × {set.target_weight_kg ?? "—"}{set.target_rir !== null ? ` · RIR ${set.target_rir}` : ""}</p></div></div>)}<Link href={`/train/session/${session.sessionId}`} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">Ver sesión completa</Link></CardContent>}</Card>;
  })}</div>;
}

function EvolutionMode({ isPrevious, currentHref, previousHref }: { isPrevious: boolean; currentHref: string; previousHref: string | null }) {
  return <div className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-lg border bg-muted/25 p-1" aria-label="Modo de evolución"><Link scroll={false} href={currentHref} className={cn("flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", !isPrevious ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={!isPrevious ? "page" : undefined}>Actual</Link>{previousHref ? <Link scroll={false} href={previousHref} className={cn("flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", isPrevious ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={isPrevious ? "page" : undefined}>Vs anterior</Link> : <span className="flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium text-muted-foreground/60">Vs anterior</span>}</div>;
}

export function ExerciseReportView({
  exerciseId, exerciseName, muscleLabel, period, routineId, routines, sessions, performanceSessions, backHref, backLabel, source, progressContext, range, comparison,
}: {
  exerciseId: string; exerciseName: string; muscleLabel: string | null; period: string; routineId: string | null; routines: Array<{ id: string; nombre: string }>; sessions: ExerciseReportSession[]; performanceSessions: ExerciseReportSession[]; backHref: string; backLabel: string; source: "progress" | "history"; range: { start: string; end: string } | null; comparison?: TrainingComparison | null; progressContext?: { view: string; routineId: string | null; muscleKey: string | null; query: string | null; routineFilter: string | null; muscleFilter: string | null };
}) {
  const summary = useMemo(() => summarizeExerciseReport(sessions), [sessions]);
  const points = useMemo(() => buildExerciseReportPoints(sessions), [sessions]);
  const router = useRouter();
  const [metric, setMetric] = useState<ChartMetric>(points.some((point) => point.bestWeightKg !== null) ? "weight" : "reps");
  const currentRoutine = routineId ?? "all";
  const reportParams = (nextPeriod: string, nextRoutine: string, compareMode: "previous" | "exercises" | null = null) => {
    const params = new URLSearchParams({ period: nextPeriod });
    if (nextRoutine !== "all") params.set("routine_id", nextRoutine);
    params.set("from", source);
    if (source === "progress" && progressContext) {
      params.set("view", progressContext.view);
      if (progressContext.routineId) params.set("routine", progressContext.routineId);
      if (progressContext.muscleKey) params.set("muscle", progressContext.muscleKey);
      if (progressContext.query) params.set("query", progressContext.query);
      if (progressContext.routineFilter) params.set("routine_filter", progressContext.routineFilter);
      if (progressContext.muscleFilter) params.set("muscle_filter", progressContext.muscleFilter);
    }
    if (compareMode) {
      params.set("compare", compareMode);
      if (compareMode === "exercises") {
        params.set("a", comparison?.mode === "cross" ? comparison.a?.id ?? exerciseId : exerciseId);
        if (comparison?.mode === "cross" && comparison.b?.id) params.set("b", comparison.b.id);
      }
    }
    return params;
  };
  const updateFilter = (nextPeriod: string, nextRoutine: string) => {
    const compareMode = comparison?.kind === "previous" && nextPeriod !== "all" ? "previous" : comparison?.kind === "exercises" ? "exercises" : null;
    router.push(`?${reportParams(nextPeriod, nextRoutine, compareMode).toString()}`);
  };
  const comparisonExitHref = `?${reportParams(period, currentRoutine).toString()}`;
  const selfComparisonHref = period === "all" ? null : `?${reportParams(period, currentRoutine, "previous").toString()}`;
  const crossComparisonHref = period === "all" ? null : `?${reportParams(period, currentRoutine, "exercises").toString()}`;
  const comparisonSelectionPath = `/train/history/${exerciseId}?${reportParams(period, currentRoutine, "exercises").toString()}`;
  const latest = points.at(-1);
  const previous = points.at(-2);
  const difference = latest && previous && latest.bestWeightKg !== null && previous.bestWeightKg !== null ? latest.bestWeightKg - previous.bestWeightKg : null;
  const selfComparison = comparison?.mode === "self" ? comparison : null;
  const crossComparison = comparison?.mode === "cross" ? comparison : null;
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Período";

  return <div className="space-y-5 lg:mx-auto lg:max-w-6xl">
    <div className="space-y-3"><Link href={backHref} className="inline-flex items-center text-sm font-medium text-primary hover:underline">← {backLabel}</Link><div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{exerciseName}</h1><p className="mt-1 text-sm text-muted-foreground">{muscleLabel ?? "Sin grupo"}</p><p className="mt-1 text-sm font-medium text-muted-foreground">{rangeLabel(range) ? `${periodLabel} · ${rangeLabel(range)}` : periodLabel}</p></div><div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium text-muted-foreground">Período<select value={period} onChange={(event) => updateFilter(event.target.value, currentRoutine)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{PERIOD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{!crossComparison && <label className="space-y-1 text-xs font-medium text-muted-foreground">Rutina histórica<select value={currentRoutine} onChange={(event) => updateFilter(period, event.target.value)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todas las rutinas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.nombre}</option>)}</select></label>}</div></div>
    {crossComparison ? <TrainingComparisonWorkspace comparison={crossComparison} backLabel={exerciseName} exitHref={comparisonExitHref} selectionPath={comparisonSelectionPath} /> : <>{sessions.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hay sesiones completadas para este período.</CardContent></Card> : <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen del ejercicio">{[{ label: "Sesiones", value: String(summary.sessions) }, { label: "Mejor peso", value: number(summary.bestWeightKg, " kg") }, { label: "Mejor última sesión", value: number(summary.latestBestWeightKg, " kg") }, { label: "Volumen del período", value: formatTrainingVolumeKg(summary.totalVolumeKg) }].map((item) => <Card key={item.label}><CardContent className="py-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="metric-number mt-1 text-lg font-semibold">{item.value}</p></CardContent></Card>)}</section>}
      <ExercisePerformanceSection sessions={performanceSessions} />
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]"><Card><CardContent className="space-y-4 pt-5"><div className="space-y-3"><div><h2 className="text-lg font-semibold">Evolución</h2><p className="text-sm text-muted-foreground">Mejor peso, máximas reps o volumen por sesión.</p></div><EvolutionMode isPrevious={Boolean(selfComparison)} currentHref={comparisonExitHref} previousHref={selfComparisonHref} /></div>{selfComparison ? <TrainingSelfComparisonContent comparison={selfComparison} /> : <><div className="mx-auto grid w-full max-w-sm grid-cols-3 rounded-lg border bg-muted/25 p-1" aria-label="Métrica del gráfico">{(["weight", "reps", "volume"] as ChartMetric[]).map((value) => <Button key={value} type="button" size="sm" className="h-9 min-w-0 px-1 text-[11px] sm:text-xs" variant={metric === value ? "default" : "ghost"} onClick={() => setMetric(value)}>{metricLabel(value)}</Button>)}</div><EvolutionChart points={points} metric={metric} /></>}</CardContent></Card><Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Próxima sesión</p><p className="mt-2 text-lg font-semibold">{summary.latestDecision ? ADJUSTMENT_LABELS[summary.latestDecision] : "—"}</p>{summary.latestDecision && <p className="mt-1 text-xs text-muted-foreground">Según la decisión registrada en la última sesión.</p>}{difference !== null && <p className="metric-number mt-3 text-sm text-muted-foreground">{difference > 0 ? `+${number(difference)} kg` : difference < 0 ? `${number(difference)} kg` : "Mismo peso"} vs sesión anterior</p>}</CardContent></Card></section>
      {sessions.length > 0 && <section className="space-y-3"><div><h2 className="text-lg font-semibold">Sesiones</h2><p className="text-sm text-muted-foreground">La más reciente queda abierta; los objetivos son el snapshot de cada día.</p></div><ReportSessions sessions={sessions} /></section>}
      {crossComparisonHref && <section className="space-y-1 border-t border-border/70 pt-4"><h2 className="text-base font-semibold tracking-tight">Otras comparaciones</h2><Link href={crossComparisonHref} className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">Comparar con otro ejercicio</Link></section>}</>}
  </div>;
}
