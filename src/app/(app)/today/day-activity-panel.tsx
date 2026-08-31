import { Card, CardContent } from "@/components/ui/card";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";
import { DayContextEditor } from "./day-context-editor";

type Props = React.ComponentProps<typeof DayContextEditor> & {
  expenditureLabel: string;
  balanceLabel: string;
  workLabel: string;
  workSourceLabel: string;
  gymLabel: string;
  gymSourceLabel: string;
  waterTargetLabel: string | null;
  stepsSummary: StepsReportSummary;
};

export function DayActivityPanel({
  expenditureLabel,
  balanceLabel,
  workLabel,
  workSourceLabel,
  gymLabel,
  gymSourceLabel,
  waterTargetLabel,
  stepsSummary,
  ...editorProps
}: Props) {
  return (
    <Card size="sm" className="surface-elevated">
      <CardContent className="space-y-3">
        <h2 className="font-semibold">Actividad de hoy</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Trabajo</p>
            <p className="truncate font-semibold">{workLabel} <span className="font-normal text-muted-foreground">· {workSourceLabel}</span></p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Entrenamiento</p>
            <p className="truncate font-semibold">{gymLabel} <span className="font-normal text-muted-foreground">· {gymSourceLabel}</span></p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Gasto</p>
            <p className="metric-number font-semibold">{expenditureLabel}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p className="font-semibold leading-snug">{balanceLabel}</p>
          </div>
        </div>
        <div className="border-t pt-3">
          <DayContextEditor {...editorProps} waterTargetLabel={waterTargetLabel} stepsSummary={stepsSummary} />
        </div>
      </CardContent>
    </Card>
  );
}
