"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ComparisonEvolution } from "@/components/progress/comparison-evolution";
import { ComparisonInsights } from "@/components/progress/comparison-insights";
import { ComparisonPeriodPair } from "@/components/progress/comparison-period-pair";
import { ComparisonSummary } from "@/components/progress/comparison-summary";
import type { ProgressComparisonReport, ProgressComparisonView } from "@/lib/progress/comparisons";
import { cn } from "@/lib/utils";

const views: Array<{ value: ProgressComparisonView; label: string }> = [
  { value: "insights", label: "Qué cambió" },
  { value: "summary", label: "Resumen" },
  { value: "evolution", label: "Evolución" },
];

function pushLocalUrl(key: string, value: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(key, value);
  window.history.pushState(null, "", url);
}

export function ComparisonWorkspace({ report, currentHref }: { report: ProgressComparisonReport; currentHref: string }) {
  const [view, setView] = useState(report.initialView);
  const [activeMetricKey, setActiveMetricKey] = useState(report.activeMetricKey);

  useEffect(() => {
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      const nextView = params.get("view");
      setView(nextView === "summary" || nextView === "evolution" ? nextView : "insights");
      const metric = params.get("chartMetric");
      setActiveMetricKey(metric && report.results.some((result) => result.metric.key === metric)
        ? metric
        : report.activeMetricKey);
    };
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [report.activeMetricKey, report.results]);

  const chooseView = (next: ProgressComparisonView) => {
    setView(next);
    pushLocalUrl("view", next);
  };
  const chooseMetric = (key: string) => {
    setActiveMetricKey(key);
    pushLocalUrl("chartMetric", key);
  };

  return <section className="space-y-4" aria-labelledby="comparison-v2-title">
    <div className="flex items-end justify-between gap-3">
      <div><h2 id="comparison-v2-title" className="text-lg font-semibold tracking-tight">Comparación</h2><p className="text-xs text-muted-foreground">Qué cambió entre referencias equivalentes.</p></div>
      <Link scroll={false} href={currentHref} className="flex min-h-11 items-center text-xs font-medium text-primary hover:underline">Ver actual</Link>
    </div>
    <ComparisonPeriodPair report={report} />
    <div className="grid grid-cols-3 rounded-xl border bg-muted/25 p-1" role="tablist" aria-label="Vista de comparación">
      {views.map((item) => <button key={item.value} type="button" role="tab" aria-selected={view === item.value} className={cn("min-h-11 rounded-lg px-1 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", view === item.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")} onClick={() => chooseView(item.value)}>{item.label}</button>)}
    </div>
    {view === "insights" ? <ComparisonInsights report={report} /> : null}
    {view === "summary" ? <ComparisonSummary report={report} /> : null}
    {view === "evolution" ? <ComparisonEvolution report={report} activeMetricKey={activeMetricKey} onMetricChange={chooseMetric} /> : null}
  </section>;
}
