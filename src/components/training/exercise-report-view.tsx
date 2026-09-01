"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChartDetail } from "@/components/ui/chart-detail";
import { chartTickIndexes, chartX, chartY, chartYAxisTicks, fittedNonNegativeChartDomain, formatChartValue, lineSegments, nonNegativeChartDomain, type ChartUnit } from "@/lib/chart-core";
import {
  buildExerciseReportPoints,
  completedExerciseSets,
  selectedExerciseReportPointIndex,
  summarizeExerciseReport,
  type ExerciseReportPoint,
  type ExerciseReportSession,
} from "@/lib/phase2/exercise-insights";

type ChartMetric = "weight" | "reps" | "volume";

const ADJUSTMENT_LABELS = { maintain: "Mantener", increase_weight: "+ Peso", increase_reps: "+ Repeticiones", custom: "Personalizado" };
const PERIOD_OPTIONS = [{ value: "4w", label: "4 semanas" }, { value: "8w", label: "8 semanas" }, { value: "3m", label: "3 meses" }, { value: "6m", label: "6 meses" }, { value: "1y", label: "1 año" }, { value: "all", label: "Todo" }];

function number(value: number | null, suffix = "") { return value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`; }
function date(value: string, year = true) { return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "America/Argentina/Cordoba" }).format(new Date(`${value}T12:00:00Z`)).replace(".", ""); }
function metricValue(point: ExerciseReportPoint, metric: ChartMetric) { return metric === "weight" ? point.bestWeightKg : metric === "reps" ? point.bestReps : point.volumeKg; }
function metricLabel(metric: ChartMetric) { return metric === "weight" ? "Peso" : metric === "reps" ? "Reps" : "Volumen"; }
function metricDisplay(value: number | null, metric: ChartMetric) { return metric === "weight" ? number(value, " kg") : metric === "volume" ? number(value, " kg") : number(value); }
function chartUnit(metric: ChartMetric): ChartUnit { return metric === "weight" || metric === "volume" ? "kg" : "reps"; }

function EvolutionChart({ points, metric }: { points: ExerciseReportPoint[]; metric: ChartMetric }) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const visible = points.filter((point) => metricValue(point, metric) !== null);
  if (visible.length === 0) return <div className="flex h-48 items-center justify-center rounded-xl border border-dashed px-5 text-center text-sm text-muted-foreground">No hay datos de {metricLabel(metric).toLocaleLowerCase("es-AR")} para este período.</div>;
  const values = visible.map((point) => metricValue(point, metric)!); const unit = chartUnit(metric); const domain = metric === "weight" ? fittedNonNegativeChartDomain(values) : nonNegativeChartDomain(values); const selectedIndex = selectedExerciseReportPointIndex(visible, selectedSessionId);
  const coordinates = lineSegments(values, domain, 320, 160, 46, 12, 12, 28)[0] ?? [];
  const maximum = Math.max(...values); const summary = `Evolución de ${metricLabel(metric).toLocaleLowerCase("es-AR")}. Eje horizontal: fecha. Eje vertical: ${unit}. Primera: ${metricDisplay(values[0]!, metric)}. Última: ${metricDisplay(values.at(-1) ?? null, metric)}. Máxima: ${metricDisplay(maximum, metric)}.`;
  return <div className="space-y-2"><p className="text-xs text-muted-foreground">Fecha · {unit}</p><p className="sr-only">{summary}</p><svg viewBox="0 0 320 160" role="group" aria-label={summary} className="h-48 w-full overflow-visible lg:h-64">{chartYAxisTicks(domain, metric === "weight" ? 5 : 4).map((value) => { const y = chartY(value, domain, 160, 12, 28); return <g key={value}><line x1="46" x2="308" y1={y} y2={y} className="stroke-border" strokeDasharray="2 3"/><text x="40" y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{formatChartValue(value, unit)}</text></g>; })}<polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" className="stroke-primary" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />{coordinates.map(({ index, x, y }) => <g key={visible[index]!.sessionId}><circle cx={x} cy={y} r="10" fill="transparent" role="button" tabIndex={0} aria-label={`${date(visible[index]!.logDate)}. ${metricLabel(metric)}: ${metricDisplay(values[index]!, metric)}.`} onClick={() => setSelectedSessionId(visible[index]!.sessionId)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedSessionId(visible[index]!.sessionId); } }} /><circle cx={x} cy={y} r={selectedIndex === index ? 4.5 : 3} className="fill-primary stroke-background" strokeWidth="1.4" pointerEvents="none" /></g>)}</svg><div className="relative h-4 text-[10px] text-muted-foreground" aria-hidden>{chartTickIndexes(visible.length).map((index) => <span key={visible[index]!.sessionId} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${(chartX(index, visible.length, 320, 46, 12) / 320) * 100}%` }}>{date(visible[index]!.logDate, false)}</span>)}</div><ChartDetail title={date(visible[selectedIndex]!.logDate)} items={[{ label: metric === "reps" ? "Repeticiones" : metricLabel(metric), value: metricDisplay(values[selectedIndex]!, metric) }]} /></div>;
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

export function ExerciseReportView({
  exerciseName, muscleLabel, period, routineId, routines, sessions, backHref, backLabel, source, progressContext,
}: {
  exerciseName: string; muscleLabel: string | null; period: string; routineId: string | null; routines: Array<{ id: string; nombre: string }>; sessions: ExerciseReportSession[]; backHref: string; backLabel: string; source: "progress" | "history"; progressContext?: { view: string; routineId: string | null; muscleKey: string | null; query: string | null; routineFilter: string | null; muscleFilter: string | null };
}) {
  const summary = useMemo(() => summarizeExerciseReport(sessions), [sessions]);
  const points = useMemo(() => buildExerciseReportPoints(sessions), [sessions]);
  const router = useRouter();
  const [metric, setMetric] = useState<ChartMetric>(points.some((point) => point.bestWeightKg !== null) ? "weight" : "reps");
  const currentRoutine = routineId ?? "all";
  const updateFilter = (nextPeriod: string, nextRoutine: string) => {
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
    router.push(`?${params.toString()}`);
  };
  const latest = points.at(-1);
  const previous = points.at(-2);
  const difference = latest && previous && latest.bestWeightKg !== null && previous.bestWeightKg !== null ? latest.bestWeightKg - previous.bestWeightKg : null;
  return <div className="space-y-5 lg:mx-auto lg:max-w-6xl">
    <div className="space-y-3"><Link href={backHref} className="inline-flex items-center text-sm font-medium text-primary hover:underline">← {backLabel}</Link><div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{exerciseName}</h1><p className="mt-1 text-sm text-muted-foreground">{muscleLabel ?? "Sin grupo"}</p></div><div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium text-muted-foreground">Período<select value={period} onChange={(event) => updateFilter(event.target.value, currentRoutine)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{PERIOD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Rutina histórica<select value={currentRoutine} onChange={(event) => updateFilter(period, event.target.value)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todas las rutinas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.nombre}</option>)}</select></label></div></div>
    {sessions.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hay sesiones completadas para este período.</CardContent></Card> : <><section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen del ejercicio">{[{ label: "Sesiones", value: String(summary.sessions) }, { label: "Mejor peso", value: number(summary.bestWeightKg, " kg") }, { label: "Mejor última sesión", value: number(summary.latestBestWeightKg, " kg") }, { label: "Volumen del período", value: number(summary.totalVolumeKg, " kg") }].map((item) => <Card key={item.label}><CardContent className="py-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="metric-number mt-1 text-lg font-semibold">{item.value}</p></CardContent></Card>)}</section>
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]"><Card><CardContent className="pt-5"><div className="mb-4 space-y-3"><div><h2 className="text-lg font-semibold">Evolución</h2><p className="text-sm text-muted-foreground">Mejor peso, máximas reps o volumen por sesión.</p></div><div className="mx-auto grid w-full max-w-sm grid-cols-3 rounded-lg border bg-muted/25 p-1" aria-label="Métrica del gráfico">{(["weight", "reps", "volume"] as ChartMetric[]).map((value) => <Button key={value} type="button" size="sm" className="h-9 min-w-0 px-1 text-[11px] sm:text-xs" variant={metric === value ? "default" : "ghost"} onClick={() => setMetric(value)}>{metricLabel(value)}</Button>)}</div></div><EvolutionChart points={points} metric={metric} /></CardContent></Card><Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Próxima sesión</p><p className="mt-2 text-lg font-semibold">{summary.latestDecision ? ADJUSTMENT_LABELS[summary.latestDecision] : "—"}</p>{summary.latestDecision && <p className="mt-1 text-xs text-muted-foreground">Según la decisión registrada en la última sesión.</p>}{difference !== null && <p className="metric-number mt-3 text-sm text-muted-foreground">{difference > 0 ? `+${number(difference)} kg` : difference < 0 ? `${number(difference)} kg` : "Mismo peso"} vs sesión anterior</p>}</CardContent></Card></section>
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Sesiones</h2><p className="text-sm text-muted-foreground">La más reciente queda abierta; los objetivos son el snapshot de cada día.</p></div><ReportSessions sessions={sessions} /></section></>}
  </div>;
}
