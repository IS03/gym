"use client";

import Link from "next/link";
import { Footprints } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";

const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function stepsFromInput(value: string) {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function StepsCard({ steps, summary }: { steps: string; summary: StepsReportSummary }) {
  const value = stepsFromInput(steps);
  const hasRecentData = summary.daysWithData > 0;

  return (
    <Card className="surface-elevated">
      <CardContent className="space-y-4 pt-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid size-8 place-items-center rounded-md bg-primary/12 text-primary"><Footprints className="size-4" aria-hidden /></span>
          Pasos
        </div>
        <div>
          <p className="metric-number text-3xl font-semibold tracking-tight">{value === null ? "—" : formatter.format(value)}</p>
          <p className="text-xs text-muted-foreground">Hoy</p>
        </div>
        {hasRecentData ? (
          <div className="space-y-1 border-t pt-3 text-sm">
            <p><span className="text-muted-foreground">Promedio 7 días: </span><span className="metric-number font-semibold">{formatter.format(summary.averageSteps ?? 0)}</span></p>
            <p className="text-xs text-muted-foreground">{summary.daysWithData} {summary.daysWithData === 1 ? "día con dato" : "días con dato"}</p>
          </div>
        ) : <p className="border-t pt-3 text-sm text-muted-foreground">Sin datos recientes</p>}
        <Link href="/today/steps" className="inline-flex text-sm font-medium text-primary hover:underline">Ver historial →</Link>
      </CardContent>
    </Card>
  );
}
