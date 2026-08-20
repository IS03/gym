"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { NutritionReportDay } from "@/lib/nutrition/reports-core";
import { chartDomain, chartTickIndexes, chartX, chartY, lineSegments } from "@/lib/nutrition/report-chart-core";

const WIDTH = 320;
const HEIGHT = 152;
type LineSeries = {
  label: string;
  values: Array<number | null>;
  className: string;
  dash?: string;
  width?: number;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${value}T12:00:00Z`));
}

function points(values: ReturnType<typeof lineSegments>[number]) {
  return values.map((point) => `${point.x},${point.y}`).join(" ");
}

function ChartLegend({ series }: { series: LineSeries[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Leyenda">
      {series.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <svg className={`h-2.5 w-5 ${item.className}`} viewBox="0 0 20 10" aria-hidden>
            <path d="M1 5h18" fill="none" stroke="currentColor" strokeWidth={item.width ?? 2} strokeDasharray={item.dash} />
          </svg>
          {item.label}{item.dash ? " (línea discontinua)" : ""}
        </li>
      ))}
    </ul>
  );
}

function DateLabels({ dates }: { dates: string[] }) {
  const indexes = chartTickIndexes(dates.length);
  return (
    <div className="relative mt-1 h-4 text-[10px] text-muted-foreground" aria-hidden>
      {indexes.map((index) => (
        <span
          key={dates[index]}
          className="absolute -translate-x-1/2 whitespace-nowrap"
          style={{ left: `${(chartX(index, dates.length, WIDTH) / WIDTH) * 100}%` }}
        >
          {dateLabel(dates[index])}
        </span>
      ))}
    </div>
  );
}

function LineChart({ description, dates, series }: { description: string; dates: string[]; series: LineSeries[] }) {
  const domain = chartDomain(series.flatMap((item) => item.values));
  return (
    <>
      <div className="h-40 min-w-0" role="img" aria-label={description}>
        <svg className="size-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden>
          {[0.25, 0.5, 0.75].map((step) => {
            const y = 16 + (HEIGHT - 32) * step;
            return <line key={step} x1="18" x2={WIDTH - 18} y1={y} y2={y} className="stroke-border" strokeDasharray="2 3" />;
          })}
          {series.map((item) => lineSegments(item.values, domain, WIDTH, HEIGHT).map((segment, index) => (
            <polyline
              key={`${item.label}-${index}`}
              points={points(segment)}
              className={item.className}
              fill="none"
              stroke="currentColor"
              strokeWidth={item.width ?? 2}
              strokeDasharray={item.dash}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )))}
        </svg>
      </div>
      <DateLabels dates={dates} />
    </>
  );
}

function BalanceChart({ days }: { days: NutritionReportDay[] }) {
  const values = days.map((day) => day.isComplete ? day.energyBalanceKcal : null);
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return <p className="py-8 text-sm text-muted-foreground">No hay días terminados con balance energético comparable.</p>;
  const domain = chartDomain(values, true);
  const zeroY = chartY(0, domain, HEIGHT);
  const barWidth = Math.max(2, Math.min(18, (WIDTH - 36) / Math.max(days.length, 1) - 2));
  return (
    <>
      <div className="h-40 min-w-0" role="img" aria-label="Barras de balance diario: negativas representan déficit estimado y positivas superávit estimado.">
        <svg className="size-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden>
          <line x1="18" x2={WIDTH - 18} y1={zeroY} y2={zeroY} className="stroke-foreground/55" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          {values.map((value, index) => {
            if (value === null) return null;
            const x = chartX(index, days.length, WIDTH) - barWidth / 2;
            const y = chartY(value, domain, HEIGHT);
            return <rect key={days[index].date} x={x} y={Math.min(y, zeroY)} width={barWidth} height={Math.max(1, Math.abs(y - zeroY))} rx="1" className={value < 0 ? "fill-primary" : "fill-foreground/55"} />;
          })}
        </svg>
      </div>
      <DateLabels dates={days.map((day) => day.date)} />
      <p className="mt-2 text-xs text-muted-foreground">Base 0 · barras hacia abajo: déficit estimado · hacia arriba: superávit estimado.</p>
    </>
  );
}

function StepsChart({ days }: { days: NutritionReportDay[] }) {
  const values = days.map((day) => day.isComplete ? day.steps : null);
  const known = values.filter((value): value is number => value !== null);
  if (known.length === 0) return <p className="py-8 text-sm text-muted-foreground">Registrá pasos algunos días para ver la tendencia.</p>;
  const domain = chartDomain(values, true);
  const baseline = chartY(0, domain, HEIGHT);
  const barWidth = Math.max(2, Math.min(18, (WIDTH - 36) / Math.max(days.length, 1) - 2));
  return (
    <>
      <div className="h-40 min-w-0" role="img" aria-label="Barras de pasos registrados por día.">
        <svg className="size-full overflow-visible" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" aria-hidden>
          {values.map((value, index) => {
            if (value === null) return null;
            const y = chartY(value, domain, HEIGHT);
            return <rect key={days[index].date} x={chartX(index, days.length, WIDTH) - barWidth / 2} y={y} width={barWidth} height={Math.max(1, baseline - y)} rx="1" className="fill-primary/75" />;
          })}
        </svg>
      </div>
      <DateLabels dates={days.map((day) => day.date)} />
    </>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return <Card className={`surface-elevated ${className}`}><CardHeader className="pb-1"><CardTitle>{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
}

export function NutritionReportCharts({ days }: { days: NutritionReportDay[] }) {
  const chronological = [...days].reverse();
  const dates = chronological.map((day) => day.date);
  const energy: LineSeries[] = [
    { label: "Consumido", values: chronological.map((day) => day.hasNutrition ? day.calories : null), className: "text-primary", width: 2.5 },
    { label: "Objetivo", values: chronological.map((day) => day.hasNutrition ? day.targetCalories : null), className: "text-muted-foreground", dash: "5 4" },
    { label: "Gasto estimado", values: chronological.map((day) => day.hasNutrition ? day.expenditureKcal : null), className: "text-foreground/70", dash: "1 3", width: 2.5 },
  ];
  const protein: LineSeries[] = [
    { label: "Consumida", values: chronological.map((day) => day.hasNutrition ? day.proteinG : null), className: "text-primary", width: 2.5 },
    { label: "Objetivo", values: chronological.map((day) => day.hasNutrition ? day.targetProteinG : null), className: "text-muted-foreground", dash: "5 4" },
  ];
  const water: LineSeries[] = [
    { label: "Agua", values: chronological.map((day) => day.isComplete ? day.waterL : null), className: "text-primary", width: 2.5 },
    { label: "Objetivo", values: chronological.map((day) => day.isComplete ? day.targetWaterL : null), className: "text-muted-foreground", dash: "5 4" },
  ];
  const waterKnown = water.some((series) => series.values.some((value) => value !== null));

  return (
    <section className="space-y-4" aria-labelledby="nutrition-trends-title">
      <div>
        <div className="flex flex-wrap items-center gap-2"><h2 id="nutrition-trends-title" className="text-lg font-semibold tracking-tight">Tendencias</h2>{chronological.some((day) => day.isToday) ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Hoy · En curso</span> : null}</div>
        <p className="text-xs text-muted-foreground">Los huecos representan días sin dato; hoy no altera los resúmenes finales.</p>
      </div>
      <ChartCard title="Tendencia de energía">
        <div className="space-y-3"><ChartLegend series={energy} /><LineChart dates={dates} series={energy} description="Tendencia de energía: calorías consumidas, objetivo y gasto estimado por día." /></div>
      </ChartCard>
      <ChartCard title="Balance diario"><BalanceChart days={chronological} /></ChartCard>
      <ChartCard title="Proteína"><div className="space-y-3"><ChartLegend series={protein} /><LineChart dates={dates} series={protein} description="Tendencia de proteína consumida y objetivo por día." /></div></ChartCard>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Agua">
          {waterKnown ? <div className="space-y-3"><ChartLegend series={water} /><LineChart dates={dates} series={water} description="Tendencia de agua registrada y objetivo por día. El mate no se suma." /><p className="text-xs text-muted-foreground">El mate se mantiene separado del agua.</p></div> : <p className="py-8 text-sm text-muted-foreground">Registrá agua algunos días para ver la tendencia.</p>}
        </ChartCard>
        <ChartCard title="Pasos"><StepsChart days={chronological} /></ChartCard>
      </div>
    </section>
  );
}
