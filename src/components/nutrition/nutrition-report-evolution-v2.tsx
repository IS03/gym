"use client";

import { useEffect, useState } from "react";

import { ComparisonEvolution } from "@/components/progress/comparison-evolution";
import type { ProgressComparisonReport } from "@/lib/progress/comparisons";
import { cn } from "@/lib/utils";

type EvolutionMode = "current" | "comparison";

function pushLocalParam(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.pushState(null, "", url);
}

export function NutritionReportEvolutionV2({ report }: { report: ProgressComparisonReport }) {
  const [activeMetric, setActiveMetric] = useState(report.activeMetricKey);
  const [mode, setMode] = useState<EvolutionMode>("comparison");

  useEffect(() => {
    const sync = () => {
      const metric = new URLSearchParams(window.location.search).get("chartMetric");
      setActiveMetric(metric && report.results.some((result) => result.metric.key === metric)
        ? metric
        : report.activeMetricKey);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [report.activeMetricKey, report.results]);

  const chooseMode = (next: EvolutionMode) => {
    setMode(next);
  };
  const chooseMetric = (key: string) => {
    setActiveMetric(key);
    pushLocalParam("chartMetric", key);
  };
  const referenceLabel = report.reference.type === "previous_period"
    ? "Vs anterior"
    : report.reference.type === "goal"
      ? "Vs objetivo"
      : "Vs comparación";

  return <section className="space-y-4" aria-labelledby="nutrition-evolution-title">
    <div>
      <h2 id="nutrition-evolution-title" className="text-lg font-semibold tracking-tight">Evolución</h2>
      <p className="mt-1 text-sm text-muted-foreground">Una métrica por vez, sin mezclar kcal y gramos.</p>
    </div>
    <div className="grid grid-cols-2 rounded-lg border bg-muted/25 p-1" aria-label="Modo de evolución">
      <button type="button" onClick={() => chooseMode("current")} aria-pressed={mode === "current"} className={cn("min-h-11 rounded-md px-2 text-xs font-medium", mode === "current" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>Actual</button>
      <button type="button" onClick={() => chooseMode("comparison")} aria-pressed={mode === "comparison"} className={cn("min-h-11 rounded-md px-2 text-xs font-medium", mode === "comparison" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground")}>{referenceLabel}</button>
    </div>
    <div className="rounded-xl border bg-card p-3 sm:p-4">
      <ComparisonEvolution report={report} activeMetricKey={activeMetric} onMetricChange={chooseMetric} showReference={mode === "comparison"} />
      {activeMetric === "nutrition.energy_balance" ? <p className="mt-3 text-xs text-muted-foreground">Cero separa déficit estimado de superávit estimado. Ninguno se interpreta automáticamente como bueno o malo.</p> : null}
    </div>
  </section>;
}
