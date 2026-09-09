import Link from "next/link";
import { ChartNoAxesColumnIncreasing, ChevronRight } from "lucide-react";
import { getUserMetrics } from "@/lib/daily-metrics/server";
import { DailyMetricsEditor } from "./daily-metrics-editor";

export const dynamic = "force-dynamic";

export default async function DailyMetricsPage() {
  const metrics = await getUserMetrics();
  const editorVersion = metrics.map((metric) => `${metric.id}:${metric.updated_at}`).join("|");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <header className="space-y-2">
        <Link
          href="/settings"
          className="inline-flex min-h-11 items-center gap-1 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight className="size-4 rotate-180" aria-hidden />
          Ajustes
        </Link>
        <div className="flex items-start gap-3">
          <span className="-mt-1 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ChartNoAxesColumnIncreasing className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-semibold tracking-tight lg:text-4xl">Métricas diarias</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">Elegí qué querés registrar cada día.</p>
          </div>
        </div>
      </header>
      <DailyMetricsEditor key={editorVersion} initialMetrics={metrics} />
    </div>
  );
}
