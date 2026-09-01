"use client";

import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { ChartDetail } from "@/components/ui/chart-detail";
import { Input } from "@/components/ui/input";
import { chartTickIndexes, chartY, chartYAxisTicks, nonNegativeChartDomain } from "@/lib/chart-core";
import {
  TRAINING_ANALYSIS_PERIODS,
  filterTrainingAnalysisExercises,
  formatTrainingAnalysisMetric,
  trainingAnalysisMetricValue,
  type TrainingAnalysis,
  type TrainingAnalysisMetric,
  type TrainingAnalysisMuscle,
  type TrainingAnalysisRoutine,
  type TrainingAnalysisSummary,
  type TrainingAnalysisTimelinePoint,
} from "@/lib/phase2/training-analysis";
import {
  trainingAnalysisExercisePath,
  trainingAnalysisWorkspacePath,
  type TrainingAnalysisNavigationState,
  type TrainingAnalysisView,
} from "@/lib/phase2/training-analysis-navigation";
import { cn } from "@/lib/utils";

type WorkspaceState = TrainingAnalysisNavigationState;

const METRIC_META: Record<TrainingAnalysisMetric, { label: string; shortLabel: string }> = {
  volume: { label: "Volumen", shortLabel: "Volumen" },
  sets: { label: "Series", shortLabel: "Series" },
  sessions: { label: "Entrenamientos", shortLabel: "Entrenamientos" },
  minutes: { label: "Duración", shortLabel: "Duración" },
};

function formatNumber(value: number, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits }).format(value);
}

function shortDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Cordoba" })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "");
}

function rangeLabel(point: TrainingAnalysisTimelinePoint): string {
  return point.start === point.end ? shortDate(point.start) : `${shortDate(point.start)}–${shortDate(point.end)}`;
}

function metricAxisValue(value: number, metric: TrainingAnalysisMetric): string {
  if (metric === "volume") {
    return formatTrainingAnalysisMetric(value, metric);
  }
  if (metric === "minutes") return value >= 60 ? `${Math.round(value / 60)} h` : `${Math.round(value)} min`;
  return formatNumber(Math.max(0, value));
}

function summaryMetricValue(summary: TrainingAnalysisSummary, metric: TrainingAnalysisMetric): string {
  return formatTrainingAnalysisMetric(trainingAnalysisMetricValue(summary, metric), metric);
}

function EmptyState({ children }: { children: import("react").ReactNode }) {
  return <div className="rounded-xl border border-dashed px-4 py-7 text-center text-sm text-muted-foreground">{children}</div>;
}

function ContextTabs({ state }: { state: WorkspaceState }) {
  const contexts: Array<{ value: TrainingAnalysisView; label: string }> = [
    { value: "general", label: "General" },
    { value: "routines", label: "Rutinas" },
    { value: "muscles", label: "Músculos" },
    { value: "exercises", label: "Ejercicios" },
  ];
  return <nav className="grid grid-cols-4 rounded-xl border bg-muted/35 p-1" aria-label="Contexto de análisis">{contexts.map((context) => {
    const selected = state.view === context.value;
    return <Link key={context.value} href={trainingAnalysisWorkspacePath({ view: context.value, period: state.period, routineId: null, muscleKey: null })} className={cn("flex h-10 min-w-0 items-center justify-center rounded-lg px-1 text-center text-xs font-medium transition-colors sm:text-sm", selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={selected ? "page" : undefined}>{context.label}</Link>;
  })}</nav>;
}

function PeriodSelector({ state }: { state: WorkspaceState }) {
  return <div className="grid grid-cols-5 gap-1 rounded-xl border bg-muted/25 p-1" aria-label="Período de análisis">{TRAINING_ANALYSIS_PERIODS.map((period) => {
    const selected = period.value === state.period;
    const compact = period.value === "4w" ? "4 sem" : period.value === "8w" ? "8 sem" : period.label;
    return <Link key={period.value} href={trainingAnalysisWorkspacePath({ ...state, period: period.value })} className={cn("flex h-9 min-w-0 items-center justify-center rounded-lg px-1 text-center text-[11px] font-medium whitespace-nowrap transition-colors sm:text-xs", selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} aria-current={selected ? "page" : undefined}>{compact}</Link>;
  })}</div>;
}

function MetricGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-4">{items.map((item) => <div key={item.label} className="bg-card px-3 py-3 sm:px-4"><dt className="text-[11px] text-muted-foreground">{item.label}</dt><dd className="metric-number mt-0.5 text-lg font-semibold tracking-tight">{item.value}</dd></div>)}</dl>;
}

function WeeklyComparison({ comparison }: { comparison: TrainingAnalysis["weekComparison"] }) {
  if (!comparison) return null;
  const metrics: TrainingAnalysisMetric[] = ["sessions", "sets", "minutes", "volume"];
  return <section className="border-t border-border/70 pt-4" aria-label="Comparación simple con la semana anterior"><div className="flex items-baseline justify-between gap-3"><div><h2 className="text-base font-semibold tracking-tight">Esta semana</h2><p className="mt-0.5 text-xs text-muted-foreground">{shortDate(comparison.current.start)}–{shortDate(comparison.current.end)} · frente a la anterior</p></div><span className="text-xs text-muted-foreground">Comparación breve</span></div><dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">{metrics.map((metric) => {
    const current = trainingAnalysisMetricValue(comparison.current, metric);
    const previous = trainingAnalysisMetricValue(comparison.previous, metric);
    const difference = current - previous;
    const delta = difference === 0 ? "Sin cambios" : `${difference > 0 ? "+" : "−"}${formatTrainingAnalysisMetric(Math.abs(difference), metric)}`;
    return <div key={metric}><dt className="text-xs text-muted-foreground">{METRIC_META[metric].shortLabel}</dt><dd className="metric-number mt-0.5 text-sm font-medium">{summaryMetricValue(comparison.current, metric)}</dd><p className={cn("mt-0.5 text-xs", difference === 0 ? "text-muted-foreground" : difference > 0 ? "text-primary" : "text-muted-foreground")}>{delta}</p></div>;
  })}</dl></section>;
}

function AnalysisChart({
  title,
  description,
  points,
  metrics,
  defaultMetric,
}: {
  title: string;
  description: string;
  points: TrainingAnalysisTimelinePoint[];
  metrics: TrainingAnalysisMetric[];
  defaultMetric: TrainingAnalysisMetric;
}) {
  const [metric, setMetric] = useState<TrainingAnalysisMetric>(defaultMetric);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const values = points.map((point) => Math.max(0, trainingAnalysisMetricValue(point, metric)));
  const hasValues = values.some((value) => value > 0);
  const selectedIndex = selectedId
    ? Math.max(0, points.findIndex((point) => point.id === selectedId))
    : Math.max(0, points.length - 1);
  const selected = points[selectedIndex] ?? null;
  const domain = nonNegativeChartDomain(values);
  const width = 340;
  const height = 194;
  const left = 48;
  const right = 12;
  const top = 12;
  const bottom = 34;
  const plotHeight = height - top - bottom;
  const plotWidth = width - left - right;
  const band = points.length ? plotWidth / points.length : plotWidth;
  const summary = `${title}. ${description} ${points.map((point, index) => `${rangeLabel(point)}: ${metricAxisValue(values[index] ?? 0, metric)}`).join(". ")}.`;

  return <section className="space-y-4" aria-labelledby="training-analysis-chart-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 id="training-analysis-chart-title" className="text-lg font-semibold tracking-tight">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{metrics.length > 1 && <div className={cn("grid rounded-lg border p-1", metrics.length === 4 ? "grid-cols-2" : "grid-cols-3")} aria-label="Métrica de evolución">{metrics.map((option) => <button key={option} type="button" onClick={() => { setMetric(option); setSelectedId(null); }} className={cn("h-8 rounded-md px-2 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", metric === option ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground")} aria-pressed={metric === option}>{METRIC_META[option].shortLabel}</button>)}</div>}</div>
    {!hasValues ? <EmptyState>No hay {METRIC_META[metric].label.toLocaleLowerCase("es-AR")} registradas para este período.</EmptyState> : <><p className="sr-only">{summary}</p><svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={summary} className="h-56 w-full overflow-visible" preserveAspectRatio="none">{chartYAxisTicks(domain, 4).map((value) => {
      const y = chartY(value, domain, height, top, bottom);
      return <g key={value}><line x1={left} x2={width - right} y1={y} y2={y} className="stroke-border" strokeDasharray="2 3" /><text x={left - 7} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{metricAxisValue(value, metric)}</text></g>;
    })}{selected && <line x1={left + band * selectedIndex + band / 2} x2={left + band * selectedIndex + band / 2} y1={top} y2={top + plotHeight} className="stroke-primary/55" strokeDasharray="3 3" />}{points.map((point, index) => {
      const value = values[index] ?? 0;
      const center = left + band * index + band / 2;
      const barWidth = Math.max(8, Math.min(24, band * 0.58));
      const barY = chartY(value, domain, height, top, bottom);
      const isSelected = selectedIndex === index;
      return <g key={point.id}><rect x={left + band * index} y={top} width={band} height={plotHeight} fill="transparent" role="button" tabIndex={0} aria-label={`${rangeLabel(point)}. ${METRIC_META[metric].label}: ${metricAxisValue(value, metric)}.`} aria-pressed={isSelected} onClick={() => setSelectedId(point.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(point.id); } }} /><rect x={center - barWidth / 2} y={barY} width={barWidth} height={Math.max(0, top + plotHeight - barY)} rx="4" className={cn("transition-[fill] duration-150 motion-reduce:transition-none", isSelected ? "fill-primary" : "fill-primary/55")} pointerEvents="none" /></g>;
    })}{chartTickIndexes(points.length, 4).map((index) => <text key={points[index]!.id} x={left + band * index + band / 2} y={height - 12} textAnchor="middle" className="fill-muted-foreground text-[9px]">{shortDate(points[index]!.start)}</text>)}</svg><ChartDetail title={rangeLabel(selected!)} items={[{ label: METRIC_META[metric].label, value: summaryMetricValue(selected!, metric) }]} /></>}
  </section>;
}

function AnalysisRow({ href, title, description, value }: { href: string; title: string; description: string; value: string }) {
  return <Link href={href} className="group flex min-h-14 items-center gap-3 border-b border-border/70 py-3 outline-none last:border-b-0 focus-visible:ring-2 focus-visible:ring-ring"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{description}</span></span><span className="metric-number shrink-0 text-right text-sm font-medium">{value}</span><ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden /></Link>;
}

function Breakdown({
  title,
  empty,
  rows,
  moreHref,
  moreLabel,
}: {
  title: string;
  empty: string;
  rows: Array<{ href: string; title: string; description: string; value: string }>;
  moreHref?: string;
  moreLabel?: string;
}) {
  return <section className="space-y-2" aria-label={title}><div className="flex items-baseline justify-between gap-3"><h2 className="text-lg font-semibold tracking-tight">{title}</h2>{moreHref && rows.length > 0 && <Link href={moreHref} className="text-sm font-medium text-primary hover:underline">{moreLabel ?? "Ver todo"}</Link>}</div>{rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <div>{rows.map((row) => <AnalysisRow key={row.href} {...row} />)}</div>}</section>;
}

function GeneralView({ analysis, state }: { analysis: TrainingAnalysis; state: WorkspaceState }) {
  const activeMuscles = analysis.muscles.filter((muscle) => muscle.summary.hasData).slice(0, 5);
  const activeRoutines = analysis.routines.filter((routine) => routine.summary.hasData).slice(0, 5);
  if (!analysis.summary.hasData) return <EmptyState>Todavía no registraste entrenamientos finalizados en las últimas {analysis.range.label.toLocaleLowerCase("es-AR")}.</EmptyState>;
  return <div className="space-y-6"><MetricGrid items={[{ label: "Entrenamientos", value: summaryMetricValue(analysis.summary, "sessions") }, { label: "Series", value: summaryMetricValue(analysis.summary, "sets") }, { label: "Duración", value: summaryMetricValue(analysis.summary, "minutes") }, { label: "Volumen", value: summaryMetricValue(analysis.summary, "volume") }]} /><WeeklyComparison comparison={analysis.weekComparison} /><AnalysisChart title="Evolución" description={`Por semana o tramo · ${analysis.range.label.toLocaleLowerCase("es-AR")}.`} points={analysis.timeline} metrics={["volume", "sets", "sessions", "minutes"]} defaultMetric="volume" /><div className="grid gap-6 lg:grid-cols-2"><Breakdown title="Músculos" empty="No hay series musculares para este período." moreHref={trainingAnalysisWorkspacePath({ view: "muscles", period: state.period, routineId: null, muscleKey: null })} moreLabel="Ver músculos" rows={activeMuscles.map((muscle) => ({ href: trainingAnalysisWorkspacePath({ view: "muscles", period: state.period, routineId: null, muscleKey: muscle.key }), title: muscle.label, description: `${muscle.summary.sessions} ${muscle.summary.sessions === 1 ? "sesión" : "sesiones"}`, value: summaryMetricValue(muscle.summary, "sets") }))} /><Breakdown title="Rutinas" empty="No hay rutinas finalizadas para este período." moreHref={trainingAnalysisWorkspacePath({ view: "routines", period: state.period, routineId: null, muscleKey: null })} moreLabel="Ver rutinas" rows={activeRoutines.map((routine) => ({ href: trainingAnalysisWorkspacePath({ view: "routines", period: state.period, routineId: routine.id, muscleKey: null }), title: routine.name, description: `${routine.summary.sets} ${routine.summary.sets === 1 ? "serie" : "series"}`, value: summaryMetricValue(routine.summary, "sessions") }))} /></div></div>;
}

function RoutineList({ analysis, state }: { analysis: TrainingAnalysis; state: WorkspaceState }) {
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold tracking-tight">Elegí una rutina</h2><p className="mt-1 text-sm text-muted-foreground">Cada rutina se analiza con sus sesiones y ejercicios históricos.</p></div>{analysis.routines.length === 0 ? <EmptyState>Todavía no hay rutinas para analizar.</EmptyState> : <div>{analysis.routines.map((routine) => <AnalysisRow key={routine.id} href={trainingAnalysisWorkspacePath({ view: "routines", period: state.period, routineId: routine.id, muscleKey: null })} title={routine.name} description={routine.summary.hasData ? `${routine.summary.sets} ${routine.summary.sets === 1 ? "serie" : "series"} · ${routine.summary.exerciseCount} ${routine.summary.exerciseCount === 1 ? "ejercicio" : "ejercicios"}` : `Sin sesiones en ${analysis.range.label.toLocaleLowerCase("es-AR")}`} value={routine.summary.hasData ? summaryMetricValue(routine.summary, "sessions") : "Sin datos"} />)}</div>}</section>;
}

function RoutineView({ analysis, routine, state }: { analysis: TrainingAnalysis; routine: TrainingAnalysisRoutine; state: WorkspaceState }) {
  const exercises = analysis.exercises.filter((exercise) => exercise.routineIds.includes(routine.id));
  if (!routine.summary.hasData) return <div className="space-y-5"><div><h2 className="text-xl font-semibold tracking-tight">{routine.name}</h2><p className="mt-1 text-sm text-muted-foreground">{analysis.range.label}</p></div><EmptyState>No hay sesiones finalizadas de esta rutina en este período.</EmptyState></div>;
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold tracking-tight">{routine.name}</h2><p className="mt-1 text-sm text-muted-foreground">{analysis.range.label} · datos de sesiones finalizadas.</p></div><MetricGrid items={[{ label: "Sesiones", value: summaryMetricValue(routine.summary, "sessions") }, { label: "Series", value: summaryMetricValue(routine.summary, "sets") }, { label: "Duración", value: summaryMetricValue(routine.summary, "minutes") }, { label: "Volumen", value: summaryMetricValue(routine.summary, "volume") }]} /><AnalysisChart title="Evolución" description="Por semana o tramo de la rutina." points={routine.timeline} metrics={["volume", "sets", "minutes"]} defaultMetric="volume" /><Breakdown title="Músculos trabajados" empty="No hay series musculares registradas para esta rutina." rows={routine.muscles.map((muscle) => ({ href: trainingAnalysisWorkspacePath({ view: "muscles", period: state.period, routineId: null, muscleKey: muscle.key }), title: muscle.label, description: "Abrir análisis muscular", value: `${muscle.sets} ${muscle.sets === 1 ? "serie" : "series"}` }))} /><ExerciseRows title="Ejercicios de esta rutina" empty="No hay ejercicios históricos con series realizadas." exercises={exercises} state={state} /></div>;
}

function MuscleList({ analysis, state }: { analysis: TrainingAnalysis; state: WorkspaceState }) {
  return <section className="space-y-3"><div><h2 className="text-lg font-semibold tracking-tight">Elegí un músculo</h2><p className="mt-1 text-sm text-muted-foreground">Las series realizadas son la métrica principal de este contexto.</p></div><div>{analysis.muscles.map((muscle) => <AnalysisRow key={muscle.key} href={trainingAnalysisWorkspacePath({ view: "muscles", period: state.period, routineId: null, muscleKey: muscle.key })} title={muscle.label} description={muscle.summary.hasData ? `${muscle.summary.sessions} ${muscle.summary.sessions === 1 ? "sesión" : "sesiones"} · ${muscle.summary.exerciseCount} ${muscle.summary.exerciseCount === 1 ? "ejercicio" : "ejercicios"}` : `Sin series en ${analysis.range.label.toLocaleLowerCase("es-AR")}`} value={muscle.summary.hasData ? summaryMetricValue(muscle.summary, "sets") : "Sin datos"} />)}</div></section>;
}

function MuscleView({ analysis, muscle, state }: { analysis: TrainingAnalysis; muscle: TrainingAnalysisMuscle; state: WorkspaceState }) {
  const exercises = analysis.exercises.filter((exercise) => muscle.exerciseIds.includes(exercise.id));
  if (!muscle.summary.hasData) return <div className="space-y-5"><div><h2 className="text-xl font-semibold tracking-tight">{muscle.label}</h2><p className="mt-1 text-sm text-muted-foreground">{analysis.range.label}</p></div><EmptyState>No hay series realizadas para este músculo en este período.</EmptyState></div>;
  const average = muscle.summary.sessions > 0 ? muscle.summary.sets / muscle.summary.sessions : null;
  return <div className="space-y-6"><div><h2 className="text-xl font-semibold tracking-tight">{muscle.label}</h2><p className="mt-1 text-sm text-muted-foreground">{analysis.range.label} · series realizadas.</p></div><MetricGrid items={[{ label: "Series", value: summaryMetricValue(muscle.summary, "sets") }, { label: "Sesiones", value: summaryMetricValue(muscle.summary, "sessions") }, { label: "Promedio por sesión", value: average === null ? "—" : `${formatNumber(average, 1)} series` }, { label: "Ejercicios", value: formatNumber(muscle.summary.exerciseCount) }]} /><AnalysisChart title="Evolución" description="Series realizadas por semana o tramo." points={muscle.timeline} metrics={["sets"]} defaultMetric="sets" /><ExerciseRows title={`Ejercicios de ${muscle.label.toLocaleLowerCase("es-AR")}`} empty="No hay ejercicios históricos con series realizadas." exercises={exercises} state={state} /></div>;
}

function ExerciseRows({ title, empty, exercises, state }: { title: string; empty: string; exercises: TrainingAnalysis["exercises"]; state: WorkspaceState }) {
  return <section className="space-y-2"><h2 className="text-lg font-semibold tracking-tight">{title}</h2>{exercises.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : <div>{exercises.map((exercise) => <AnalysisRow key={exercise.id} href={trainingAnalysisExercisePath(exercise.id, state)} title={exercise.name} description={`${exercise.muscleLabel} · ${shortDate(exercise.lastDate)} · ${exercise.sessions} ${exercise.sessions === 1 ? "sesión" : "sesiones"}`} value={exercise.bestWeightKg === null ? `${exercise.sets} series` : `${formatNumber(exercise.bestWeightKg, 1)} kg`} />)}</div>}</section>;
}

function ExercisesView({ analysis, state }: { analysis: TrainingAnalysis; state: WorkspaceState }) {
  const [query, setQuery] = useState("");
  const [routineId, setRoutineId] = useState("all");
  const [muscleKey, setMuscleKey] = useState("all");
  const [showAll, setShowAll] = useState(false);
  const visible = useMemo(() => filterTrainingAnalysisExercises(analysis.exercises, { query, routineId, muscleKey }), [analysis.exercises, muscleKey, query, routineId]);
  const rendered = showAll || query || routineId !== "all" || muscleKey !== "all" ? visible : visible.slice(0, 6);
  return <section className="space-y-4"><div><h2 className="text-lg font-semibold tracking-tight">Encontrá un ejercicio</h2><p className="mt-1 text-sm text-muted-foreground">Abrí su reporte completo de peso, reps, volumen y sesiones.</p></div><label className="relative block"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /><Input value={query} onChange={(event) => { setQuery(event.target.value); setShowAll(true); }} placeholder="Buscar ejercicio" className="h-11 pl-9" aria-label="Buscar ejercicio" /></label><div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium text-muted-foreground">Rutina<select value={routineId} onChange={(event) => { setRoutineId(event.target.value); setShowAll(true); }} className="h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todas las rutinas</option>{analysis.routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Músculo<select value={muscleKey} onChange={(event) => { setMuscleKey(event.target.value); setShowAll(true); }} className="h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todos los músculos</option>{analysis.muscles.map((muscle) => <option key={muscle.key} value={muscle.key}>{muscle.label}</option>)}</select></label></div><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><span>{rendered.length === visible.length ? `${visible.length} ${visible.length === 1 ? "ejercicio" : "ejercicios"}` : `${visible.length} ejercicios recientes`}</span>{!showAll && visible.length > rendered.length && <button type="button" onClick={() => setShowAll(true)} className="min-h-9 text-sm font-medium text-primary hover:underline">Ver todos</button>}</div>{rendered.length === 0 ? <EmptyState>No encontramos ejercicios con esos filtros.</EmptyState> : <div>{rendered.map((exercise) => <AnalysisRow key={exercise.id} href={trainingAnalysisExercisePath(exercise.id, state)} title={exercise.name} description={`${exercise.muscleLabel} · última sesión ${shortDate(exercise.lastDate)} · ${exercise.sessions} ${exercise.sessions === 1 ? "sesión" : "sesiones"}`} value={exercise.bestWeightKg === null ? `${exercise.sets} series` : `${formatNumber(exercise.bestWeightKg, 1)} kg`} />)}</div>}</section>;
}

export function TrainingAnalysisWorkspace({ analysis, view, routineId, muscleKey }: { analysis: TrainingAnalysis; view: TrainingAnalysisView; routineId: string | null; muscleKey: string | null }) {
  const state: WorkspaceState = { view, period: analysis.period, routineId, muscleKey };
  const selectedRoutine = routineId ? analysis.routines.find((routine) => routine.id === routineId) ?? null : null;
  const selectedMuscle = muscleKey ? analysis.muscles.find((muscle) => muscle.key === muscleKey) ?? null : null;
  return <div className="space-y-6"><div className="space-y-3"><ContextTabs state={state} /><PeriodSelector state={state} /></div>{view === "general" && <GeneralView analysis={analysis} state={state} />}{view === "routines" && (selectedRoutine ? <RoutineView analysis={analysis} routine={selectedRoutine} state={state} /> : <RoutineList analysis={analysis} state={state} />)}{view === "muscles" && (selectedMuscle ? <MuscleView analysis={analysis} muscle={selectedMuscle} state={state} /> : <MuscleList analysis={analysis} state={state} />)}{view === "exercises" && <ExercisesView analysis={analysis} state={state} />}</div>;
}
