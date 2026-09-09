"use client";

import { useState } from "react";
import {
  formatDailyMetricProgress,
  parseDailyMetricValue,
} from "@/lib/daily-metrics/core";
import type { DailyActivityDraft } from "@/lib/nutrition/activity-autosave";
import {
  ActivityContextSummary,
  DayActivityPanel,
  type ActivityContextValues,
} from "./day-activity-panel";
import { DayContextEditor } from "./day-context-editor";
import { ResponsiveDialog } from "./responsive-dialog";

type EditorProps = Omit<React.ComponentProps<typeof DayContextEditor>, "onMetricsChange">;
type TodayActivityProps = EditorProps & ActivityContextValues;

function draftValue(value: string, type: EditorProps["metrics"][number]["value_type"]) {
  try {
    return parseDailyMetricValue(value, type);
  } catch {
    return null;
  }
}

export function TodayActivity({ metrics, ...props }: TodayActivityProps) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<DailyActivityDraft>(() => Object.fromEntries(
    metrics.map((metric) => [metric.id, metric.value === null ? "" : String(metric.value)]),
  ));
  const metricSummaries = metrics.map((metric) => ({
    id: metric.id,
    label: metric.name,
    valueLabel: formatDailyMetricProgress(draftValue(activity[metric.id] ?? "", metric.value_type), metric),
    systemKey: metric.system_key,
    valueType: metric.value_type,
  }));

  return (
    <>
      <DayActivityPanel
        targetLabel={props.targetLabel}
        expenditureLabel={props.expenditureLabel}
        balanceLabel={props.balanceLabel}
        trainingLabel={props.trainingLabel}
        metrics={metricSummaries}
        onOpen={() => setOpen(true)}
      />

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Actividad de hoy"
        closeLabel="Cerrar actividad de hoy"
      >
        <div className="space-y-5">
          <section className="space-y-3" aria-labelledby="daily-activity-context">
            <h3 id="daily-activity-context" className="text-sm font-semibold">Contexto del día</h3>
            <ActivityContextSummary
              targetLabel={props.targetLabel}
              expenditureLabel={props.expenditureLabel}
              balanceLabel={props.balanceLabel}
              trainingLabel={props.trainingLabel}
            />
          </section>

          <DayContextEditor {...props} metrics={metrics} onMetricsChange={setActivity} />
        </div>
      </ResponsiveDialog>
    </>
  );
}
