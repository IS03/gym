"use client";

import Link from "next/link";
import { ChevronRight, Footprints } from "lucide-react";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";
import { stepsFromInput } from "./steps-card-core";

const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function StepsSummary({ steps, summary }: { steps: string; summary: StepsReportSummary }) {
  const value = stepsFromInput(steps);
  const hasRecentData = summary.daysWithData > 0;

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border bg-background/35 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Footprints className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium text-muted-foreground">Pasos</span>
            <p className="metric-number text-lg font-semibold tracking-tight">
              {value === null ? "—" : formatter.format(value)}
            </p>
            <span className="text-xs text-muted-foreground">hoy</span>
          </div>
          {hasRecentData ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Prom. 7 días{" "}
              <span className="metric-number font-semibold text-foreground">
                {formatter.format(summary.averageSteps ?? 0)}
              </span>{" "}
              · {summary.daysWithData}/7 días
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">Sin datos en los últimos 7 días</p>
          )}
        </div>
      </div>
      <Link
        href="/today/steps"
        className="flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Historial <ChevronRight className="size-3.5" aria-hidden />
      </Link>
    </div>
  );
}
