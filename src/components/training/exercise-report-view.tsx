"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartDetail } from "@/components/ui/chart-detail";
import { ComparisonSummary } from "@/components/progress/comparison-summary";
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
  completedExerciseSets,
  selectedExerciseReportPointIndex,
  type ExerciseReportPoint,
  type ExerciseReportSession,
} from "@/lib/phase2/exercise-insights";
import type { TrainingExerciseDetailAnalytics, TrainingExerciseMark } from "@/lib/progress/training-exercises";
import type { TrainingPerformanceStatus } from "@/lib/progress/training-performance";
import { cn } from "@/lib/utils";

type ChartMetric = "weight" | "reps" | "volume";

const ADJUSTMENT_LABELS = { maintain: "Mantener", increase_weight: "Subir peso", increase_reps: "Subir repeticiones", custom: "Recordatorio personalizado" };
const PERIOD_OPTIONS = [{ value: "1w", label: "1 semana" }, { value: "2w", label: "2 semanas" }, { value: "3w", label: "3 semanas" }, { value: "4w", label: "4 semanas" }, { value: "8w", label: "8 semanas" }, { value: "3m", label: "3 meses" }, { value: "6m", label: "6 meses" }, { value: "1y", label: "1 año" }];

function number(value: number | null, suffix = "") { return value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`; }
function date(value: string, year = true) { return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "America/Argentina/Cordoba" }).format(new Date(`${value}T12:00:00Z`)).replace(".", ""); }
function rangeLabel(range: { start: string; end: string } | null) { return range ? `${date(range.start, false)}–${date(range.end, false)}` : null; }
function metricValue(point: ExerciseReportPoint, metric: ChartMetric) { return metric === "weight" ? point.bestWeightKg : metric === "reps" ? point.bestReps : point.volumeKg; }
function isMode(weightMode: string | null, value: string) { return weightMode?.trim().toLocaleLowerCase("es-AR") === value; }
function metricLabel(metric: ChartMetric, weightMode: string | null) { if (metric === "weight") return isMode(weightMode, "lingotes (no kg)") ? "Lingotes" : "Peso"; if (metric === "reps") return isMode(weightMode, "tiempo (segundos)") ? "Tiempo" : "Reps"; return "Volumen"; }
function metricDisplay(value: number | null, metric: ChartMetric, weightMode: string | null) { if (value === null) return "—"; if (metric === "weight") return number(value, isMode(weightMode, "lingotes (no kg)") ? " lingotes" : " kg"); if (metric === "volume") return formatTrainingVolumeKg(value); return number(value, isMode(weightMode, "tiempo (segundos)") ? " s" : " reps"); }
function chartUnit(metric: ChartMetric, weightMode: string | null): ChartUnit { if (metric === "weight") return isMode(weightMode, "lingotes (no kg)") ? "lingotes" : "kg"; if (metric === "volume") return "kg"; return isMode(weightMode, "tiempo (segundos)") ? "s" : "reps"; }

const PERFORMANCE_LABELS: Record<TrainingPerformanceStatus, string> = {
  improved: "Mejoró en este período",
  stable: "Sin cambio claro",
  declined: "Bajó en este período",
  insufficient_data: "Sin suficiente comparación",
};

function PerformanceSection({ analytics }: { analytics: TrainingExerciseDetailAnalytics }) {
  const performance = analytics.performance;
  return <section className="space-y-3" aria-labelledby="exercise-performance-title">
    <div><p className="text-xs font-semibold uppercase tracking-[0.11em] text-primary">Rendimiento</p><h2 id="exercise-performance-title" className="mt-1 text-2xl font-semibold tracking-tight">{PERFORMANCE_LABELS[performance.status]}</h2></div>
    {performance.signal ? <div className="rounded-xl border bg-card px-4 py-4"><p className="text-base font-semibold">{performance.signal.description}</p>{performance.primarySampleSize > 0 && performance.referenceSampleSize > 0 ? <p className="mt-1 text-xs text-muted-foreground">{performance.primarySampleSize} series actuales · {performance.referenceSampleSize} de referencia · mismo ejercicio y weight_mode.</p> : null}</div> : <p className="rounded-xl border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">Necesitás registrar este mismo ejercicio y modo de carga en ambos períodos. La ausencia de historial no se trata como cero.</p>}
  </section>;
}

function FindingsSection({ analytics }: { analytics: TrainingExerciseDetailAnalytics }) {
  const finding = analytics.performance.signal && analytics.performance.signal.kind !== "stable" ? analytics.performance.signal.description : null;
  return <section className="space-y-2" aria-labelledby="exercise-findings-title"><h2 id="exercise-findings-title" className="text-lg font-semibold tracking-tight">Qué cambió</h2>{finding ? <div className="rounded-xl border bg-card px-4 py-3"><p className="text-sm font-medium">{finding}</p>{analytics.performance.isPersonalRecord ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">Nueva marca real</p> : null}</div> : <p className="text-sm text-muted-foreground">No hubo cambios claros con evidencia comparable en este ejercicio.</p>}</section>;
}

function markValue(mark: TrainingExerciseMark) {
  if (mark.kind === "best_volume") return formatTrainingVolumeKg(mark.value);
  return `${number(mark.value)} ${mark.unit}`;
}

function MarksSection({ marks }: { marks: TrainingExerciseMark[] }) {
  if (!marks.length) return null;
  return <section className="space-y-3" aria-labelledby="exercise-marks-title"><div><h2 id="exercise-marks-title" className="text-lg font-semibold tracking-tight">Marcas</h2><p className="mt-1 text-sm text-muted-foreground">Máximos reales derivados del historial; cada hito aparece una sola vez.</p></div><dl className="divide-y rounded-xl border bg-card px-3">{marks.map((mark) => <div key={mark.kind} className="flex min-h-14 items-center justify-between gap-4 py-3"><dt className="min-w-0 text-sm text-muted-foreground">{mark.label}<span className="mt-0.5 block text-xs">{[mark.context, date(mark.logDate)].filter(Boolean).join(" · ")}</span></dt><dd className="metric-number shrink-0 text-right text-sm font-semibold">{markValue(mark)}</dd></div>)}</dl></section>;
}

function LoadSection({ analytics }: { analytics: TrainingExerciseDetailAnalytics }) {
  return <section className="space-y-3" aria-labelledby="exercise-load-title"><div><h2 id="exercise-load-title" className="text-lg font-semibold tracking-tight">Carga del ejercicio</h2><p className="mt-1 text-sm text-muted-foreground">Sesiones, series y volumen describen cuánto lo entrenaste; no sustituyen el rendimiento.</p></div><ComparisonSummary report={analytics.loadComparison} /></section>;
}

function NextSessionSection({ analytics }: { analytics: TrainingExerciseDetailAnalytics }) {
  if (!analytics.latestDecision) return null;
  return <section className="space-y-2" aria-labelledby="exercise-next-title"><h2 id="exercise-next-title" className="text-lg font-semibold tracking-tight">Próxima sesión</h2><div className="rounded-xl border bg-card px-4 py-3"><p className="text-base font-semibold">{ADJUSTMENT_LABELS[analytics.latestDecision]}</p><p className="mt-1 text-sm text-muted-foreground">{analytics.latestDecisionNote ?? "Decisión registrada en la última sesión; no es una recomendación generada."}</p></div></section>;
}

function EvolutionChart({ points, metric, weightMode }: { points: ExerciseReportPoint[]; metric: ChartMetric; weightMode: string | null }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const visible = points.filter((point) => metricValue(point, metric) !== null);
  if (visible.length === 0) return <div className="flex h-48 items-center justify-center rounded-xl border border-dashed px-5 text-center text-sm text-muted-foreground">No hay datos de {metricLabel(metric, weightMode).toLocaleLowerCase("es-AR")} para este período.</div>;

  const values = visible.map((point) => metricValue(point, metric)!);
  const unit = chartUnit(metric, weightMode);
  const isBar = metric === "volume";
  const domain = metric === "weight" || metric === "reps" ? fittedNonNegativeChartDomain(values) : nonNegativeChartDomain(values);
  const selectedIndex = selectedExerciseReportPointIndex(visible, selectedSessionId);
  const coordinates = isBar ? [] : lineSegments(values, domain, 320, 160, 46, 12, 12, 28)[0] ?? [];
  const maximum = Math.max(...values);
  const summary = `Evolución de ${metricLabel(metric, weightMode).toLocaleLowerCase("es-AR")}. Eje horizontal: sesiones reales. Eje vertical: ${unit}. Primera: ${metricDisplay(values[0]!, metric, weightMode)}. Última: ${metricDisplay(values.at(-1) ?? null, metric, weightMode)}. Máxima: ${metricDisplay(maximum, metric, weightMode)}.`;
  const band = 262 / visible.length;
  const baselineY = chartY(0, domain, 160, 12, 28);

  return <div className="space-y-2"><p className="text-xs text-muted-foreground">Sesiones reales · {unit}</p><p className="sr-only">{summary}</p><svg viewBox="0 0 320 160" role="group" aria-label={summary} className="h-48 w-full overflow-visible lg:h-64">{chartYAxisTicks(domain, metric === "weight" || metric === "reps" ? 5 : 4).map((value) => { const y = chartY(value, domain, 160, 12, 28); return <g key={value}><line x1="46" x2="308" y1={y} y2={y} className="stroke-border" strokeDasharray="2 3"/><text x="40" y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{formatChartValue(value, unit)}</text></g>; })}{!isBar && <polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" className="stroke-primary" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}{visible.map((point, index) => { const x = chartX(index, visible.length, 320, 46, 12); const y = chartY(values[index]!, domain, 160, 12, 28); const selected = selectedIndex === index; const barWidth = Math.max(6, Math.min(24, band * 0.6)); const pointLabel = `${date(point.logDate)}. ${metricLabel(metric, weightMode)}: ${metricDisplay(values[index]!, metric, weightMode)}.`; return <g key={point.sessionId}>{isBar && <rect x={x - barWidth / 2} y={y} width={barWidth} height={Math.max(0, baselineY - y)} rx="4" className={selected ? "fill-primary" : "fill-primary/60"} pointerEvents="none" />}{isBar ? <rect x={46 + band * index} y="12" width={band} height="120" fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" aria-label={pointLabel} onClick={() => setSelectedSessionId(point.sessionId)} onFocus={() => setSelectedSessionId(point.sessionId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSessionId(point.sessionId); } }} /> : <><circle cx={x} cy={y} r="10" fill="transparent" role="button" tabIndex={0} className="outline-none focus:outline-none" aria-label={pointLabel} onClick={() => setSelectedSessionId(point.sessionId)} onFocus={() => setSelectedSessionId(point.sessionId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSessionId(point.sessionId); } }} /><circle cx={x} cy={y} r={selected ? 4.5 : 3} className="fill-primary stroke-background" strokeWidth="1.4" pointerEvents="none" /></>}</g>; })}</svg><div className="relative h-4 text-[10px] text-muted-foreground" aria-hidden>{chartTickIndexes(visible.length).map((index) => <span key={visible[index]!.sessionId} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(chartX(index, visible.length, 320, 46, 12) / 320) * 100}%` }}>{date(visible[index]!.logDate, false)}</span>)}</div><ChartDetail title={date(visible[selectedIndex]!.logDate)} items={[{ label: metricLabel(metric, weightMode), value: metricDisplay(values[selectedIndex]!, metric, weightMode) }]} /></div>;
}

function setDisplay(reps: number | null, load: number | null, weightMode: string | null) {
  if (isMode(weightMode, "tiempo (segundos)")) return `${reps ?? "—"} s`;
  if (isMode(weightMode, "peso corporal")) return `${reps ?? "—"} reps · peso corporal`;
  const unit = isMode(weightMode, "lingotes (no kg)") ? "lingotes" : "kg";
  return `${load ?? "—"} ${unit} × ${reps ?? "—"}`;
}

function ReportSessions({ sessions, weightMode }: { sessions: ExerciseReportSession[]; weightMode: string | null }) {
  const [open, setOpen] = useState<string | null>(sessions[0]?.sessionId ?? null);
  return <div className="space-y-2">{sessions.map((session) => {
    const isOpen = open === session.sessionId;
    const sessionWeightMode = session.weightMode ?? weightMode;
    const completed = completedExerciseSets(session.sets);
    const bestSet = completed.reduce<(typeof completed)[number] | null>((best, set) => !best || (set.actual_weight_kg ?? 0) > (best.actual_weight_kg ?? 0) || ((set.actual_weight_kg ?? 0) === (best.actual_weight_kg ?? 0) && (set.actual_reps ?? 0) > (best.actual_reps ?? 0)) ? set : best, null);
    return <Card key={session.sessionId} className="overflow-hidden"><button type="button" className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setOpen(isOpen ? null : session.sessionId)} aria-expanded={isOpen}>
      <span className="min-w-0"><span className="block text-sm font-semibold">{date(session.logDate)} · {session.routineName}</span><span className="metric-number mt-1 block text-xs text-muted-foreground">{completed.length} {completed.length === 1 ? "serie" : "series"}{bestSet ? ` · mejor ${setDisplay(bestSet.actual_reps, bestSet.actual_weight_kg, sessionWeightMode)}` : ""}</span></span>
      {isOpen ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </button>{isOpen && <CardContent className="space-y-2 border-t py-3">{completed.length === 0 ? <p className="text-sm text-muted-foreground">No hay series completadas en esta sesión.</p> : completed.map((set) => <div key={set.id} className="grid grid-cols-[2rem_1fr] gap-x-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="font-semibold">S{set.set_number}</span><div><p><span className="text-muted-foreground">Real </span>{setDisplay(set.actual_reps, set.actual_weight_kg, sessionWeightMode)}</p><p className="mt-0.5 text-xs text-muted-foreground">Objetivo {setDisplay(set.target_reps, set.target_weight_kg, sessionWeightMode)}{set.target_rir !== null ? ` · RIR ${set.target_rir}` : ""}</p></div></div>)}<Link href={`/train/session/${session.sessionId}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">Ver sesión completa</Link></CardContent>}</Card>;
  })}</div>;
}

function EvolutionMode({ isPrevious, currentHref, previousHref }: { isPrevious: boolean; currentHref: string; previousHref: string | null }) {
  return <div className="mx-auto grid w-full max-w-xs grid-cols-2 rounded-lg border bg-muted/25 p-1" aria-label="Modo de evolución"><Link scroll={false} href={currentHref} className={cn("flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", !isPrevious ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={!isPrevious ? "page" : undefined}>Actual</Link>{previousHref ? <Link scroll={false} href={previousHref} className={cn("flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", isPrevious ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={isPrevious ? "page" : undefined}>Vs anterior</Link> : <span className="flex h-9 items-center justify-center rounded-md px-2 text-xs font-medium text-muted-foreground/60">Vs anterior</span>}</div>;
}

export function ExerciseReportView({
  exerciseId, exerciseName, muscleLabel, weightMode, period, routineId, routines, sessions, backHref, backLabel, source, progressContext, range, comparison, analytics,
}: {
  exerciseId: string; exerciseName: string; muscleLabel: string | null; weightMode: string | null; period: string; routineId: string | null; routines: Array<{ id: string; nombre: string }>; sessions: ExerciseReportSession[]; backHref: string; backLabel: string; source: "progress" | "history"; range: { start: string; end: string } | null; comparison?: TrainingComparison | null; analytics: TrainingExerciseDetailAnalytics | null; progressContext?: { view: string; routineId: string | null; muscleKey: string | null; muscleZoneKey?: string | null; query: string | null; routineFilter: string | null; muscleFilter: string | null; periodFrom?: string | null; periodTo?: string | null };
}) {
  const points = useMemo(() => buildExerciseReportPoints(sessions), [sessions]);
  const chartMetrics = useMemo<ChartMetric[]>(() => {
    if (isMode(weightMode, "tiempo (segundos)") || isMode(weightMode, "peso corporal")) return ["reps"];
    if (isMode(weightMode, "lingotes (no kg)")) return ["weight", "reps"];
    return points.some((point) => point.bestWeightKg !== null) ? ["weight", "reps", "volume"] : ["reps"];
  }, [points, weightMode]);
  const router = useRouter();
  const [metric, setMetric] = useState<ChartMetric>(chartMetrics[0] ?? "reps");
  const currentRoutine = routineId ?? "all";
  const reportParams = (nextPeriod: string, nextRoutine: string, compareMode: "previous" | "exercises" | null = null) => {
    const params = new URLSearchParams({ period: nextPeriod });
    if (nextRoutine !== "all") params.set("routine_id", nextRoutine);
    params.set("from", source);
    if (source === "progress" && progressContext) {
      params.set("view", progressContext.view);
      if (nextPeriod === "custom" && progressContext.periodFrom && progressContext.periodTo) {
        params.set("period_from", progressContext.periodFrom);
        params.set("period_to", progressContext.periodTo);
      }
      if (progressContext.routineId) params.set("routine", progressContext.routineId);
      if (progressContext.muscleKey) params.set("muscle", progressContext.muscleKey);
      if (progressContext.muscleZoneKey) params.set("zone", progressContext.muscleZoneKey);
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
  const selfComparison = comparison?.mode === "self" ? comparison : null;
  const crossComparison = comparison?.mode === "cross" ? comparison : null;
  const periodLabel = PERIOD_OPTIONS.find((option) => option.value === period)?.label ?? "Período";

  return <div className="space-y-5 lg:mx-auto lg:max-w-6xl">
    <div className="space-y-3"><Link href={backHref} className="inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">← {backLabel}</Link><div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{exerciseName}</h1><p className="mt-1 text-sm text-muted-foreground">{[muscleLabel ?? "Sin grupo", weightMode].filter(Boolean).join(" · ")}</p><p className="mt-1 text-sm font-medium text-muted-foreground">{rangeLabel(range) ? `${periodLabel} · ${rangeLabel(range)}` : periodLabel}</p></div><div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium text-muted-foreground">Período<select value={period} onChange={(event) => updateFilter(event.target.value, currentRoutine)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{period === "custom" ? <option value="custom">Personalizado</option> : null}{PERIOD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>{!crossComparison && <label className="space-y-1 text-xs font-medium text-muted-foreground">Rutina histórica<select value={currentRoutine} onChange={(event) => updateFilter(period, event.target.value)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todas las rutinas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.nombre}</option>)}</select></label>}</div></div>
    {crossComparison ? <TrainingComparisonWorkspace comparison={crossComparison} backLabel={exerciseName} exitHref={comparisonExitHref} selectionPath={comparisonSelectionPath} /> : !analytics ? <div className="rounded-xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">No hay historial suficiente para construir este reporte.</div> : <>
      <PerformanceSection analytics={analytics} />
      <FindingsSection analytics={analytics} />
      <section className="space-y-4" aria-labelledby="exercise-evolution-title"><div><h2 id="exercise-evolution-title" className="text-lg font-semibold tracking-tight">Evolución</h2><p className="mt-1 text-sm text-muted-foreground">Cada punto representa el mejor registro o el volumen de una sesión real.</p></div><EvolutionMode isPrevious={Boolean(selfComparison)} currentHref={comparisonExitHref} previousHref={selfComparisonHref} />{selfComparison ? analytics.referenceSessions.length === 0 ? <div className="rounded-xl border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">No hay suficiente historial para comparar este período.</div> : <TrainingSelfComparisonContent comparison={selfComparison} /> : <><div className={cn("mx-auto grid w-full max-w-sm rounded-lg border bg-muted/25 p-1", chartMetrics.length === 1 ? "grid-cols-1" : chartMetrics.length === 2 ? "grid-cols-2" : "grid-cols-3")} aria-label="Métrica del gráfico">{chartMetrics.map((value) => <Button key={value} type="button" size="sm" className="min-h-11 min-w-0 px-1 text-xs" variant={metric === value ? "default" : "ghost"} onClick={() => setMetric(value)}>{metricLabel(value, weightMode)}</Button>)}</div><EvolutionChart points={points} metric={chartMetrics.includes(metric) ? metric : chartMetrics[0] ?? "reps"} weightMode={weightMode} /></>}</section>
      <MarksSection marks={analytics.marks} />
      <LoadSection analytics={analytics} />
      <NextSessionSection analytics={analytics} />
      {sessions.length > 0 ? <section className="space-y-3"><div><h2 className="text-lg font-semibold">Historial de sesiones</h2><p className="text-sm text-muted-foreground">La más reciente queda abierta; cada fila conserva sus series y objetivos reales.</p></div><ReportSessions sessions={sessions} weightMode={weightMode} /></section> : <div className="rounded-xl border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">No hay sesiones completadas para este período.</div>}
      {crossComparisonHref && <section className="space-y-1 border-t border-border/70 pt-4"><h2 className="text-base font-semibold tracking-tight">Otras comparaciones</h2><Link href={crossComparisonHref} className="inline-flex min-h-10 items-center text-sm font-medium text-primary hover:underline">Comparar con otro ejercicio</Link></section>}</>}
  </div>;
}
