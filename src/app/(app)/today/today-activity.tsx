import { DayActivityPanel } from "./day-activity-panel";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";

type PanelProps = React.ComponentProps<typeof DayActivityPanel>;
type TodayActivityProps = Omit<PanelProps, "onActivityChange">;

export function TodayActivity({ stepsSummary, ...props }: TodayActivityProps & { stepsSummary: StepsReportSummary }) {
  return <DayActivityPanel {...props} stepsSummary={stepsSummary} />;
}
