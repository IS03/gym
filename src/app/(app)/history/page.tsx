import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Dumbbell, Scale } from "lucide-react";
import { DailyHistoryDateNavigator } from "@/components/history/daily-history-date-navigator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { HistoricalMetricsEditor } from "./historical-metrics-editor";
import { BODY_MEASUREMENT_FIELDS, type BodyMeasurement } from "@/lib/body-measurements";
import { formatDailyMetricValue } from "@/lib/daily-metrics/core";
import { getDailyHistoryDetail, listDailyHistoryDays } from "@/lib/history/daily-history";
import {
  adjacentHistoryDate,
  dailyHistoryDetailHref,
  dailyHistoryReturnTarget,
  isHistoryDate,
  parseDailyHistoryOrigin,
} from "@/lib/history/daily-history-navigation";
import { todayInCordoba } from "@/lib/phase2/cordoba-date";
import { getVerifiedRequestContext } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
// El loader usa snapshots ya resueltos y getNutritionDay({ createIfMissing: false }).

const number = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const bodyLabels: Record<(typeof BODY_MEASUREMENT_FIELDS)[number], string> = {
  waist_cm: "Cintura", abdomen_cm: "Abdomen", chest_cm: "Pecho", arm_cm: "Brazo", arm_right_cm: "Brazo der.", arm_left_cm: "Brazo izq.", thigh_cm: "Muslo", thigh_right_cm: "Muslo der.", thigh_left_cm: "Muslo izq.", calf_right_cm: "Pantorrilla der.", calf_left_cm: "Pantorrilla izq.", hip_cm: "Cadera",
};

function formatKcal(value: number | null | undefined) { return typeof value === "number" ? `${integer.format(value)} kcal` : "—"; }
function formatGrams(value: number | null | undefined) { return typeof value === "number" ? `${number.format(value)} g` : "—"; }
function formatDuration(milliseconds: number | null) { if (milliseconds === null) return null; const minutes = Math.round(milliseconds / 60_000); const hours = Math.floor(minutes / 60); return hours ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${minutes} min`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`)); }
function energyBalanceLabel(value: number | null) { if (value === null) return "—"; if (value < 0) return `Déficit estimado: ${integer.format(Math.abs(value))} kcal`; if (value > 0) return `Superávit estimado: ${integer.format(value)} kcal`; return "Balance estimado: 0 kcal"; }
function originalTimeKnown(rawInput: string | null) { if (!rawInput) return true; try { return (JSON.parse(rawInput) as { originalTimeKnown?: boolean }).originalTimeKnown !== false; } catch { return true; } }

function BodySection({ weight, measurement }: { weight: number | null; measurement: BodyMeasurement | null }) {
  const values = [
    ...(weight === null ? [] : [{ label: "Peso", value: `${number.format(weight)} kg` }]),
    ...(measurement ? BODY_MEASUREMENT_FIELDS.flatMap((field) => {
      const value = measurement[field];
      return value === null ? [] : [{ label: bodyLabels[field], value: `${number.format(value)} cm` }];
    }) : []),
  ];
  if (!values.length && !measurement?.condition && !measurement?.notes && measurement?.quality_status !== "suspect" && !measurement?.legacy_import_source) return null;
  return (
    <section className="space-y-3" aria-labelledby="body-title">
      <div className="flex items-center gap-2"><Scale className="size-4 text-primary" aria-hidden /><h2 id="body-title" className="text-base font-semibold tracking-tight">Cuerpo</h2></div>
      <Card className="surface-elevated gap-0 py-0">
        <CardContent className="px-0">
          {values.length ? <div className="divide-y">{values.map((item) => <div key={item.label} className="flex min-h-12 items-center justify-between gap-4 px-4 py-3"><p className="text-sm text-muted-foreground">{item.label}</p><p className="metric-number text-right font-semibold">{item.value}</p></div>)}</div> : null}
          {measurement?.condition || measurement?.notes ? <div className={cn("space-y-2 px-4 py-3", values.length && "border-t")}>{measurement.condition ? <div><p className="text-xs text-muted-foreground">Condición</p><p className="text-sm">{measurement.condition}</p></div> : null}{measurement.notes ? <p className="text-sm text-muted-foreground">{measurement.notes}</p> : null}</div> : null}
          {measurement?.quality_status === "suspect" ? <p className="border-t px-4 py-3 text-sm text-destructive">Medición a revisar{measurement.quality_note ? `: ${measurement.quality_note}` : "."}</p> : null}
          {measurement?.legacy_import_source ? <p className="border-t px-4 py-3 text-xs text-muted-foreground">Histórico importado · {measurement.legacy_import_source}</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}

export default async function HistoryPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = (await searchParams) ?? {};
  const requestedDate = typeof sp.date === "string" ? sp.date : null;
  const origin = parseDailyHistoryOrigin(sp);
  const today = todayInCordoba();
  const auth = await getVerifiedRequestContext();
  if (!auth) redirect("/login");

  if (!requestedDate) {
    const days = await listDailyHistoryDays({ today, context: auth, limit: 60 });
    return <div className="space-y-6"><header className="space-y-3"><Link href="/progress" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden /> Progreso</Link><div><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial diario</h1><p className="mt-1 text-sm text-muted-foreground">Qué pasó cada día en nutrición, métricas, entrenamiento y cuerpo.</p></div></header><div className="space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-5 lg:space-y-0"><Card className="lg:order-2 lg:col-span-4 lg:sticky lg:top-8"><CardHeader className="pb-3"><CardTitle className="text-base">Ir a una fecha</CardTitle></CardHeader><CardContent><DailyHistoryDateNavigator value={today} today={today} origin={{ source: "history" }} adjacent={false} /></CardContent></Card><section className="space-y-3 lg:order-1 lg:col-span-8" aria-labelledby="recent-days-title"><h2 id="recent-days-title" className="text-base font-semibold tracking-tight">Últimos días</h2>{days.length === 0 ? <p className="text-sm text-muted-foreground">Todavía no hay información registrada.</p> : <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">{days.map((day) => { const hasNutrition = Boolean(day.dayLog && (day.dayLog.total_calories_consumed > 0 || day.dayLog.total_protein_g > 0)); return <Link key={day.date} href={dailyHistoryDetailHref(day.date, { source: "history" })} className="group block rounded-xl bg-card px-4 py-3 shadow-sm ring-1 ring-foreground/8 outline-none transition-[background-color,transform] hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold capitalize">{formatDate(day.date)}</p><div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">{hasNutrition ? <span>{formatKcal(day.dayLog?.total_calories_consumed)}{day.dayLog?.targetKcal == null ? "" : ` / ${integer.format(day.dayLog.targetKcal)}`}</span> : null}{hasNutrition && day.dayLog?.total_protein_g ? <span>{formatGrams(day.dayLog.total_protein_g)} proteína</span> : null}{day.workoutNames.length ? <span>Entrenamiento · {day.workoutNames.join(", ")}</span> : null}{day.metricCount ? <span>{day.metricCount} {day.metricCount === 1 ? "métrica" : "métricas"}</span> : null}{day.dayLog?.weight_kg !== null && day.dayLog?.weight_kg !== undefined ? <span>{number.format(day.dayLog.weight_kg)} kg</span> : null}{day.measurement ? <span>Medidas</span> : null}</div></div><ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden /></div></Link>; })}</div>}</section></div></div>;
  }

  if (!isHistoryDate(requestedDate) || requestedDate > today) redirect("/history");
  const returnTarget = dailyHistoryReturnTarget(origin);
  const { nutrition, sessions, measurement, events, metrics } = await getDailyHistoryDetail(requestedDate, auth);
  const { dayLog, context } = nutrition;
  const hasNutrition = nutrition.meals.some((meal) => meal.entry_kind === "meal" || meal.entry_kind === "legacy_daily_summary");
  const hasBody = Boolean((dayLog?.weight_kg !== null && dayLog?.weight_kg !== undefined) || measurement);
  const hasAnything = hasNutrition || Boolean(sessions.length || metrics.recorded.length || measurement || events.length || (dayLog?.weight_kg !== null && dayLog?.weight_kg !== undefined));
  const summary = [
    dayLog && context && hasNutrition ? { label: "Calorías", value: context.targets.calories === null ? formatKcal(dayLog.total_calories_consumed) : `${integer.format(dayLog.total_calories_consumed)} / ${integer.format(context.targets.calories)} kcal` } : null,
    dayLog && context && hasNutrition ? { label: "Proteína", value: context.targets.proteinG === null ? formatGrams(dayLog.total_protein_g) : `${number.format(dayLog.total_protein_g)} / ${number.format(context.targets.proteinG)} g` } : null,
    sessions.length ? { label: "Entrenamiento", value: sessions.map((session) => session.name).join(", ") } : null,
    metrics.recorded.length ? { label: "Métricas", value: `${metrics.recorded.length} ${metrics.recorded.length === 1 ? "registrada" : "registradas"}` } : null,
  ].filter((value): value is { label: string; value: string } => value !== null);

  return <div className="space-y-6 pb-2"><header className="space-y-3"><Link href={returnTarget.href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"><ArrowLeft className="size-4" aria-hidden /> {returnTarget.label}</Link><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial diario</h1>{requestedDate === today ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">En curso</span> : null}</div><DailyHistoryDateNavigator value={requestedDate} today={today} origin={origin} /></header>{!hasAnything ? <Card><CardContent className="py-6"><p className="text-sm text-muted-foreground">No hay registros para esta fecha.</p></CardContent></Card> : <>{summary.length ? <section aria-labelledby="summary-title"><Card className="surface-elevated"><CardHeader className="pb-1"><CardTitle id="summary-title">Resumen del día</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-4">{summary.map((item) => <div key={item.label} className="min-w-0"><p className="text-xs text-muted-foreground">{item.label}</p><p className="metric-number mt-1 break-words font-semibold">{item.value}</p></div>)}</CardContent></Card></section> : null}
    {dayLog && context && hasNutrition ? <section className="space-y-3" aria-labelledby="nutrition-title"><h2 id="nutrition-title" className="text-base font-semibold tracking-tight">Nutrición</h2><Card className="surface-elevated"><CardContent className="grid gap-4 sm:grid-cols-2"><div className="space-y-3"><div><p className="text-xs text-muted-foreground">Consumidas / objetivo</p><p className="metric-number text-xl font-semibold">{formatKcal(dayLog.total_calories_consumed)}{context.targets.calories === null ? "" : ` / ${integer.format(context.targets.calories)}`}</p>{dayLog.nutrition_target_override_kcal !== null ? <p className="mt-1 text-xs text-muted-foreground">Ajustado para este día</p> : null}</div><div className="grid grid-cols-3 gap-3 border-t pt-3"><div><p className="text-xs text-muted-foreground">Proteína</p><p className="metric-number font-semibold">{formatGrams(dayLog.total_protein_g)}</p></div><div><p className="text-xs text-muted-foreground">Carbos</p><p className="metric-number font-semibold">{formatGrams(dayLog.total_carbs_g)}</p></div><div><p className="text-xs text-muted-foreground">Grasas</p><p className="metric-number font-semibold">{formatGrams(dayLog.total_fat_g)}</p></div></div></div><div className="space-y-3 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0"><div><p className="text-xs text-muted-foreground">Desviación vs objetivo</p><p className="font-semibold">{context.metrics.deltaVsNutritionTarget === null ? "—" : `${context.metrics.deltaVsNutritionTarget >= 0 ? "+" : ""}${integer.format(context.metrics.deltaVsNutritionTarget)} kcal`}</p></div><div><p className="text-xs text-muted-foreground">Gasto estimado</p><p className="metric-number font-semibold">{formatKcal(context.expenditureKcal)}</p>{dayLog.expenditure_override_kcal !== null ? <p className="mt-1 text-xs text-muted-foreground">Ajustado para este día</p> : null}</div><div><p className="text-xs text-muted-foreground">Balance energético</p><p className="font-semibold">{energyBalanceLabel(context.metrics.energyBalanceKcal)}</p></div></div></CardContent></Card>
      <div className="space-y-2"><h3 className="text-sm font-semibold">Comidas</h3><Card className="surface-elevated gap-0 py-0"><CardContent className="divide-y px-0">{nutrition.meals.map((meal) => { const legacy = meal.entry_kind === "legacy_daily_summary"; const hasDetail = Boolean(meal.description || legacy || !originalTimeKnown(meal.raw_input)); const row = <div className="flex min-w-0 flex-1 items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-medium leading-snug">{legacy ? "Resumen diario histórico" : meal.title || "Comida"}</p><p className="metric-number mt-1 text-xs text-muted-foreground">P {formatGrams(meal.final_protein_g)} · C {formatGrams(meal.final_carbs_g)} · G {formatGrams(meal.final_fat_g)}</p></div><p className="metric-number shrink-0 text-right text-xs text-muted-foreground">{formatKcal(meal.final_calories)}</p></div>; return hasDetail ? <details key={meal.id} className="group/meal"><summary className="flex min-h-16 cursor-pointer list-none items-center gap-2 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">{row}<ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open/meal:rotate-90 motion-reduce:transition-none" aria-hidden /></summary><div className="space-y-1 border-t bg-muted/20 px-4 py-3">{legacy ? <p className="text-xs text-muted-foreground">Sin desglose de comidas disponible.</p> : null}{!legacy && !originalTimeKnown(meal.raw_input) ? <p className="text-xs text-muted-foreground">Horario no informado.</p> : null}{meal.description ? <p className="text-sm leading-relaxed text-muted-foreground">{meal.description}</p> : null}</div></details> : <div key={meal.id} className="flex min-h-16 items-center px-4 py-3">{row}</div>; })}</CardContent></Card></div></section> : null}
    {metrics.recorded.length ? <section className="space-y-3" aria-labelledby="metrics-title"><div className="flex items-center justify-between gap-3"><h2 id="metrics-title" className="text-base font-semibold tracking-tight">Métricas del día</h2><HistoricalMetricsEditor date={requestedDate} metrics={metrics.editable} /></div><Card className="surface-elevated gap-0 py-0"><CardContent className="divide-y px-0">{metrics.recorded.map((metric) => <div key={metric.id} className="flex min-h-12 items-center justify-between gap-4 px-4 py-3"><p className="min-w-0 break-words text-sm text-muted-foreground">{metric.name}</p><p className="metric-number shrink-0 text-right font-semibold">{formatDailyMetricValue(metric.value, metric)}</p></div>)}</CardContent></Card></section> : null}
    {sessions.length ? <section className="space-y-3" aria-labelledby="training-title"><div className="flex items-center gap-2"><Dumbbell className="size-4 text-primary" aria-hidden /><h2 id="training-title" className="text-base font-semibold tracking-tight">Entrenamiento</h2></div><div className="space-y-2">{sessions.map((session) => <Link key={session.id} href={`/train/session/${session.id}`} className="group block rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/8 outline-none transition-colors hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Ver sesión ${session.name}`}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words font-semibold">{session.name}</p><p className="mt-1 text-xs text-muted-foreground">{[formatDuration(session.durationMilliseconds), `${session.completedSets} ${session.completedSets === 1 ? "serie" : "series"}`, `${session.completedExercises} ${session.completedExercises === 1 ? "ejercicio" : "ejercicios"}`, session.volumeKg > 0 ? `${integer.format(session.volumeKg)} kg volumen` : null].filter(Boolean).join(" · ")}</p></div><ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden /></div></Link>)}</div></section> : null}
    {hasBody ? <BodySection weight={dayLog?.weight_kg ?? null} measurement={measurement} /> : null}
    {events.length ? <section className="space-y-3" aria-labelledby="events-title"><h2 id="events-title" className="text-base font-semibold tracking-tight">Eventos / contexto</h2>{events.map((event) => <Card key={event.id} size="sm"><CardContent className="space-y-1"><div className="flex items-baseline justify-between gap-3"><p className="font-medium">{event.event_type}</p>{event.intensity ? <span className="text-xs text-muted-foreground">{event.intensity}</span> : null}</div><p className="text-xs text-muted-foreground">Planificado: {event.planned == null ? "No informado" : event.planned ? "Sí" : "No"} · Alcohol: {event.alcohol == null ? "No informado" : event.alcohol ? "Sí" : "No"}</p>{event.context ? <p className="text-sm text-muted-foreground">{event.context}</p> : null}{event.notes ? <p className="text-sm text-muted-foreground">{event.notes}</p> : null}</CardContent></Card>)}</section> : null}</>}
    <nav className="grid grid-cols-2 gap-2 pt-1" aria-label="Navegación por fecha al final del día"><Link href={dailyHistoryDetailHref(adjacentHistoryDate(requestedDate, -1), origin)} scroll={false} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Día anterior</Link>{requestedDate < today ? <Link href={dailyHistoryDetailHref(adjacentHistoryDate(requestedDate, 1), origin)} scroll={false} className={cn(buttonVariants({ variant: "outline" }), "h-11")}>Día siguiente</Link> : <span aria-disabled="true" className={cn(buttonVariants({ variant: "outline" }), "h-11 cursor-not-allowed opacity-50")}>Día siguiente</span>}</nav>
  </div>;
}
