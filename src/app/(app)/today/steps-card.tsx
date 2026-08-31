"use client";

import Link from "next/link";
import { Footprints } from "lucide-react";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";
import { stepsFromInput } from "./steps-card-core";

const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function StepsSummary({ steps, summary }: { steps: string; summary: StepsReportSummary }) {
  const value = stepsFromInput(steps);
  const hasRecentData = summary.daysWithData > 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5">
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Footprints className="size-3.5 text-primary" aria-hidden />
            Pasos
          </span>
          <p className="metric-number text-lg font-semibold tracking-tight">{value === null ? "—" : formatter.format(value)}</p>
          <span className="text-xs text-muted-foreground">hoy</span>
        </div>
        {hasRecentData ? (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            Prom. 7 días <span className="metric-number font-semibold text-foreground">{formatter.format(summary.averageSteps ?? 0)}</span> · {summary.daysWithData}/7 días
          </p>
        ) : <p className="mt-0.5 text-xs text-muted-foreground">Sin datos en los últimos 7 días</p>}
      </div>
      <Link href="/today/steps" className="min-h-11 shrink-0 content-center text-xs font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Historial</Link>
    </div>
  );
}
