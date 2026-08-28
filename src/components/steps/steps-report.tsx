"use client";

import { useMemo, useState } from "react";
import { chartDomain, chartTickIndexes, chartX, chartY, chartYAxisTicks, formatChartValue } from "@/lib/chart-core";
import { ChartDetail } from "@/components/ui/chart-detail";
import type { StepsReportDay, StepsReportSummary } from "@/lib/nutrition/steps-report-core";

const WIDTH = 320;
const HEIGHT = 188;
const LEFT = 46;
const RIGHT = 12;
const TOP = 16;
const BOTTOM = 34;
const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const shortDateFormatter = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" });

function formattedDate(date: string, short = false) {
  return (short ? shortDateFormatter : dateFormatter).format(new Date(`${date}T00:00:00Z`));
}

function dayLabel(day: StepsReportDay, short = false) {
  return day.isToday ? `Hoy · ${formattedDate(day.date, short)}` : formattedDate(day.date, short);
}

function StepChart({ days }: { days: StepsReportDay[] }) {
  const timeline = useMemo(() => [...days].reverse(), [days]);
  const known = timeline.filter((day) => day.steps !== null);
  const [selectedDate, setSelectedDate] = useState(known.at(-1)?.date ?? null);
  const selected = timeline.find((day) => day.date === selectedDate) ?? known.at(-1) ?? null;
  const domain = chartDomain(timeline.map((day) => day.steps), true);
  const ticks = chartYAxisTicks(domain);
  const xTicks = chartTickIndexes(timeline.length);
  const barWidth = Math.min(18, Math.max(4, (WIDTH - LEFT - RIGHT) / Math.max(timeline.length, 1) - 4));
  const baseline = chartY(0, domain, HEIGHT, TOP, BOTTOM);
  const hitWidth = (WIDTH - LEFT - RIGHT) / Math.max(timeline.length - 1, 1);

  if (known.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Todavía no hay pasos registrados en este período.</p>;

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="min-w-[320px] w-full" role="img" aria-label="Evolución de pasos por fecha">
          {ticks.map((tick) => {
            const y = chartY(tick, domain, HEIGHT, TOP, BOTTOM);
            return <g key={tick}><line x1={LEFT} x2={WIDTH - RIGHT} y1={y} y2={y} className="stroke-border" strokeDasharray="2 3" /><text x={LEFT - 6} y={y + 3} textAnchor="end" className="fill-muted-foreground text-[9px]">{formatter.format(Math.round(tick))}</text></g>;
          })}
          {timeline.map((day, index) => {
            if (day.steps === null) return null;
            const x = chartX(index, timeline.length, WIDTH, LEFT, RIGHT);
            const y = chartY(day.steps, domain, HEIGHT, TOP, BOTTOM);
            const top = Math.min(y, baseline);
            const height = Math.max(Math.abs(baseline - y), 1);
            const label = `${dayLabel(day)}: ${formatChartValue(day.steps, "pasos")}${day.isToday ? ", parcial" : ""}`;
            const hitLeft = Math.max(LEFT, x - hitWidth / 2);
            const hitRight = Math.min(WIDTH - RIGHT, x + hitWidth / 2);
            return <g key={day.date}>
              <rect x={x - barWidth / 2} y={top} width={barWidth} height={height} rx="2" className={selectedDate === day.date ? "fill-primary" : "fill-primary/65"} />
              <rect x={hitLeft} y={TOP} width={Math.max(1, hitRight - hitLeft)} height={HEIGHT - TOP - BOTTOM} fill="transparent" role="button" tabIndex={0} aria-label={label} onClick={() => setSelectedDate(day.date)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedDate(day.date); } }} />
            </g>;
          })}
          {xTicks.map((index) => <text key={timeline[index].date} x={chartX(index, timeline.length, WIDTH, LEFT, RIGHT)} y={HEIGHT - 10} textAnchor="middle" className="fill-muted-foreground text-[9px]">{dayLabel(timeline[index], true)}</text>)}
        </svg>
      </div>
      {selected ? <ChartDetail title={dayLabel(selected)} items={[{ label: "Pasos", value: formatChartValue(selected.steps as number, "pasos") }]} description={selected.isToday ? "El día de hoy todavía es parcial." : undefined} /> : null}
    </div>
  );
}

function SummaryValue({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="metric-number mt-1 text-lg font-semibold">{value}</p>{detail ? <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p> : null}</div>;
}

export function StepsReport({ days, summary }: { days: StepsReportDay[]; summary: StepsReportSummary }) {
  const known = days.filter((day) => day.steps !== null);
  return <div className="space-y-6">
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumen de pasos">
      <SummaryValue label="Promedio" value={summary.averageSteps === null ? "—" : `${formatter.format(summary.averageSteps)} pasos`} />
      <SummaryValue label="Mejor día" value={summary.bestDay === null ? "—" : `${formatter.format(summary.bestDay.steps as number)} pasos`} detail={summary.bestDay ? dayLabel(summary.bestDay, true) : undefined} />
      <SummaryValue label="Días con dato" value={String(summary.daysWithData)} detail="Sólo días completos" />
      <SummaryValue label="Último registro" value={summary.lastRecord === null ? "—" : `${formatter.format(summary.lastRecord.steps as number)} pasos`} detail={summary.lastRecord ? dayLabel(summary.lastRecord, true) : undefined} />
    </section>
    <section className="space-y-3"><h2 className="text-base font-semibold">Evolución</h2><StepChart days={days} /></section>
    <section className="space-y-3"><h2 className="text-base font-semibold">Historial</h2>{known.length === 0 ? <p className="text-sm text-muted-foreground">No hay pasos registrados en este período.</p> : <div className="divide-y rounded-lg border">{known.map((day) => <div key={day.date} className="flex items-center justify-between gap-3 px-3 py-3 text-sm"><div><p className="font-medium">{dayLabel(day)}</p>{day.isToday ? <p className="text-xs text-muted-foreground">El día todavía puede cambiar.</p> : null}</div><p className="metric-number shrink-0 font-semibold">{formatter.format(day.steps as number)}</p></div>)}</div>}</section>
  </div>;
}
