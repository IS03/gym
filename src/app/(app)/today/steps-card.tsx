"use client";

import Link from "next/link";
import { Footprints } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";
import { stepsFromInput } from "./steps-card-core";

const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function StepsCard({ steps, summary }: { steps: string; summary: StepsReportSummary }) {
  const value = stepsFromInput(steps);
  const hasRecentData = summary.daysWithData > 0;

  return (
    <Card size="sm" className="surface-elevated">
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="grid size-7 place-items-center rounded-md bg-primary/12 text-primary"><Footprints className="size-3.5" aria-hidden /></span>
            Pasos
          </div>
          <Link href="/today/steps" className="shrink-0 text-xs font-medium text-primary hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Historial →</Link>
        </div>
        <div className="flex items-baseline gap-1.5">
          <p className="metric-number text-2xl font-semibold tracking-tight">{value === null ? "—" : formatter.format(value)}</p>
          <p className="text-xs text-muted-foreground">hoy</p>
        </div>
        {hasRecentData ? (
          <p className="text-xs text-muted-foreground">
            Prom. 7 días <span className="metric-number font-semibold text-foreground">{formatter.format(summary.averageSteps ?? 0)}</span> · {summary.daysWithData}/7 días
          </p>
        ) : <p className="text-xs text-muted-foreground">Sin datos en los últimos 7 días</p>}
      </CardContent>
    </Card>
  );
}
