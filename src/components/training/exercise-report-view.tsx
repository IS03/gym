"use client";

import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildExerciseReportPoints,
  completedExerciseSets,
  summarizeExerciseReport,
  type ExerciseReportPoint,
  type ExerciseReportSession,
} from "@/lib/phase2/exercise-insights";

type ChartMetric = "weight" | "reps" | "volume";

const ADJUSTMENT_LABELS = { maintain: "Mantener", increase_weight: "+ Peso", increase_reps: "+ Repeticiones", custom: "Personalizado" };
const PERIOD_OPTIONS = [{ value: "30d", label: "30 días" }, { value: "90d", label: "90 días" }, { value: "6m", label: "6 meses" }, { value: "all", label: "Todo" }];

function number(value: number | null, suffix = "") { return value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value)}${suffix}`; }
function date(value: string, year = true) { return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "America/Argentina/Cordoba" }).format(new Date(`${value}T12:00:00Z`)).replace(".", ""); }
function metricValue(point: ExerciseReportPoint, metric: ChartMetric) { return metric === "weight" ? point.bestWeightKg : metric === "reps" ? point.bestReps : point.volumeKg; }
function metricLabel(metric: ChartMetric) { return metric === "weight" ? "Peso" : metric === "reps" ? "Reps" : "Volumen"; }
function metricDisplay(value: number | null, metric: ChartMetric) { return metric === "weight" ? number(value, " kg") : metric === "volume" ? number(value, " kg") : number(value); }

function EvolutionChart({ points, metric }: { points: ExerciseReportPoint[]; metric: ChartMetric }) {
  const visible = points.filter((point) => metricValue(point, metric) !== null);
  if (visible.length === 0) return <div className="flex h-48 items-center justify-center rounded-xl border border-dashed px-5 text-center text-sm text-muted-foreground">No hay datos de {metricLabel(metric).toLocaleLowerCase("es-AR")} para este período.</div>;
  const values = visible.map((point) => metricValue(point, metric) ?? 0);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
  const coordinates = visible.map((point, index) => {
    const value = metricValue(point, metric) ?? 0;
    return { point, value, x: visible.length === 1 ? 50 : 6 + (index / (visible.length - 1)) * 88, y: 86 - ((value - min) / span) * 68 };
  });
  const summary = `Evolución de ${metricLabel(metric).toLocaleLowerCase("es-AR")} en ${visible.length} sesiones. Primera: ${metricDisplay(values[0], metric)}. Última: ${metricDisplay(values.at(-1) ?? null, metric)}. Máxima: ${metricDisplay(max, metric)}.`;
  return <div className="space-y-2"><p className="sr-only">{summary}</p><svg viewBox="0 0 100 100" role="img" aria-label={summary} className="h-48 w-full overflow-visible lg:h-64"><line x1="6" y1="86" x2="94" y2="86" className="stroke-border" strokeWidth="0.6" /><polyline points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} fill="none" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{coordinates.map(({ point, value, x, y }) => <g key={point.sessionId}><circle cx={x} cy={y} r="2.8" className="fill-primary stroke-background" strokeWidth="1.4"><title>{`${date(point.logDate, false)} · ${metricDisplay(value, metric)}`}</title></circle></g>)}</svg><div className="flex justify-between text-[11px] text-muted-foreground"><span>{date(visible[0].logDate, false)}</span><span>{date(visible.at(-1)?.logDate ?? visible[0].logDate, false)}</span></div></div>;
}

function ReportSessions({ sessions }: { sessions: ExerciseReportSession[] }) {
  const [open, setOpen] = useState<string | null>(sessions[0]?.sessionId ?? null);
  return <div className="space-y-2">{sessions.map((session) => {
    const isOpen = open === session.sessionId;
    const summary = summarizeExerciseReport([session]);
    const completed = completedExerciseSets(session.sets);
    return <Card key={session.sessionId} className="overflow-hidden"><button type="button" className="flex min-h-16 w-full items-center justify-between gap-3 px-4 py-3 text-left outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setOpen(isOpen ? null : session.sessionId)} aria-expanded={isOpen}>
      <span className="min-w-0"><span className="block text-sm font-semibold">{date(session.logDate)} · {session.routineName}</span><span className="metric-number mt-1 block text-xs text-muted-foreground">{completed.length} {completed.length === 1 ? "serie" : "series"} · mejor {number(summary.bestWeightKg, " kg")} · {number(summary.totalVolumeKg, " kg")}</span></span>
      {isOpen ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </button>{isOpen && <CardContent className="space-y-2 border-t py-3">{completed.length === 0 ? <p className="text-sm text-muted-foreground">No hay series completadas en esta sesión.</p> : completed.map((set) => <div key={set.id} className="grid grid-cols-[2rem_1fr] gap-x-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="font-semibold">S{set.set_number}</span><div><p><span className="text-muted-foreground">Real </span>{set.actual_reps ?? "—"} × {set.actual_weight_kg ?? "—"} kg</p><p className="mt-0.5 text-xs text-muted-foreground">Objetivo {set.target_reps ?? "—"} × {set.target_weight_kg ?? "—"}{set.target_rir !== null ? ` · RIR ${set.target_rir}` : ""}</p></div></div>)}<Link href={`/train/session/${session.sessionId}`} className="mt-1 inline-block text-sm font-medium text-primary hover:underline">Ver sesión completa</Link></CardContent>}</Card>;
  })}</div>;
}

export function ExerciseReportView({
  exerciseName, muscleLabel, period, routineId, routines, sessions, backHref, backLabel, source,
}: {
  exerciseName: string; muscleLabel: string | null; period: string; routineId: string | null; routines: Array<{ id: string; nombre: string }>; sessions: ExerciseReportSession[]; backHref: string; backLabel: string; source: "progress" | "history";
}) {
  const summary = useMemo(() => summarizeExerciseReport(sessions), [sessions]);
  const points = useMemo(() => buildExerciseReportPoints(sessions), [sessions]);
  const [metric, setMetric] = useState<ChartMetric>(points.some((point) => point.bestWeightKg !== null) ? "weight" : "reps");
  const currentRoutine = routineId ?? "all";
  const updateFilter = (nextPeriod: string, nextRoutine: string) => {
    const params = new URLSearchParams({ period: nextPeriod });
    if (nextRoutine !== "all") params.set("routine_id", nextRoutine);
    params.set("from", source);
    window.location.assign(`?${params.toString()}`);
  };
  const latest = points.at(-1);
  const previous = points.at(-2);
  const difference = latest && previous && latest.bestWeightKg !== null && previous.bestWeightKg !== null ? latest.bestWeightKg - previous.bestWeightKg : null;
  return <div className="space-y-5 lg:mx-auto lg:max-w-6xl">
    <div className="space-y-3"><Link href={backHref} className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground">← {backLabel}</Link><div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{exerciseName}</h1><p className="mt-1 text-sm text-muted-foreground">{muscleLabel ?? "Sin grupo"}</p></div><div className="grid gap-2 sm:grid-cols-2"><label className="space-y-1 text-xs font-medium text-muted-foreground">Período<select value={period} onChange={(event) => updateFilter(event.target.value, currentRoutine)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring">{PERIOD_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><label className="space-y-1 text-xs font-medium text-muted-foreground">Rutina histórica<select value={currentRoutine} onChange={(event) => updateFilter(period, event.target.value)} className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="all">Todas las rutinas</option>{routines.map((routine) => <option key={routine.id} value={routine.id}>{routine.nombre}</option>)}</select></label></div></div>
    {sessions.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No hay sesiones completadas para este período.</CardContent></Card> : <><section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen del ejercicio">{[{ label: "Sesiones", value: String(summary.sessions) }, { label: "Mejor peso", value: number(summary.bestWeightKg, " kg") }, { label: "Mejor última sesión", value: number(summary.latestBestWeightKg, " kg") }, { label: "Volumen", value: number(summary.totalVolumeKg, " kg") }].map((item) => <Card key={item.label}><CardContent className="py-4"><p className="text-xs text-muted-foreground">{item.label}</p><p className="metric-number mt-1 text-lg font-semibold">{item.value}</p></CardContent></Card>)}</section>
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]"><Card><CardContent className="pt-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Evolución</h2><p className="text-sm text-muted-foreground">Mejor peso, máximas reps o volumen por sesión.</p></div><div className="flex rounded-lg border p-1" aria-label="Métrica del gráfico">{(["weight", "reps", "volume"] as ChartMetric[]).map((value) => <Button key={value} type="button" size="sm" variant={metric === value ? "secondary" : "ghost"} onClick={() => setMetric(value)}>{metricLabel(value)}</Button>)}</div></div><EvolutionChart points={points} metric={metric} /></CardContent></Card><Card><CardContent className="pt-5"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Próxima vez</p><p className="mt-2 text-lg font-semibold">{summary.latestDecision ? ADJUSTMENT_LABELS[summary.latestDecision] : "—"}</p>{difference !== null && <p className="metric-number mt-3 text-sm text-muted-foreground">{difference > 0 ? `+${number(difference)} kg` : difference < 0 ? `${number(difference)} kg` : "Mismo peso"} vs sesión anterior</p>}</CardContent></Card></section>
    <section className="space-y-3"><div><h2 className="text-lg font-semibold">Sesiones</h2><p className="text-sm text-muted-foreground">La más reciente queda abierta; los objetivos son el snapshot de cada día.</p></div><ReportSessions sessions={sessions} /></section></>}
  </div>;
}
