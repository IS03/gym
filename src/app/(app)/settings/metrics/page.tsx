import { ChartNoAxesColumnIncreasing } from "lucide-react";
import { getUserMetrics } from "@/lib/daily-metrics/server";
import { SettingsHeader } from "../settings-components";
import { DailyMetricsEditor } from "./daily-metrics-editor";

export const dynamic = "force-dynamic";

export default async function DailyMetricsPage() {
  const metrics = await getUserMetrics();
  const editorVersion = metrics.map((metric) => `${metric.id}:${metric.updated_at}`).join("|");

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5">
      <div className="flex items-start gap-3">
        <span className="mt-12 flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <ChartNoAxesColumnIncreasing className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <SettingsHeader
            title="Métricas diarias"
            description="Elegí qué querés registrar cada día."
            backHref="/settings"
          />
        </div>
      </div>
      <DailyMetricsEditor key={editorVersion} initialMetrics={metrics} />
    </div>
  );
}
