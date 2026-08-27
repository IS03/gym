"use client";

import { useState } from "react";
import { DayActivityPanel } from "./day-activity-panel";
import { StepsCard } from "./steps-card";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";

type PanelProps = React.ComponentProps<typeof DayActivityPanel>;
type TodayActivityProps = Omit<PanelProps, "activity" | "onActivityChange">;

export function TodayActivity({ stepsSummary, ...props }: TodayActivityProps & { stepsSummary: StepsReportSummary }) {
  const [activity, setActivity] = useState({
    steps: props.stepsInitial == null ? "" : String(props.stepsInitial),
    waterL: props.waterInitial == null ? "" : String(props.waterInitial),
    mateL: props.mateInitial == null ? "" : String(props.mateInitial),
  });

  return <div className="space-y-6"><StepsCard steps={activity.steps} summary={stepsSummary} /><DayActivityPanel {...props} activity={activity} onActivityChange={setActivity} /></div>;
}
