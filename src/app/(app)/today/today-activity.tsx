"use client";

import { useState } from "react";
import {
  ActivityContextSummary,
  DayActivityPanel,
  type ActivityContextValues,
} from "./day-activity-panel";
import { DayContextEditor } from "./day-context-editor";
import { ResponsiveDialog } from "./responsive-dialog";
import { stepsFromInput } from "./steps-card-core";
import type { DailyActivityDraft } from "@/lib/nutrition/activity-autosave";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";

type EditorProps = Omit<React.ComponentProps<typeof DayContextEditor>, "onActivityChange" | "stepsSummary">;
type TodayActivityProps = EditorProps & ActivityContextValues & { stepsSummary: StepsReportSummary };

const formatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

function formatSteps(value: string) {
  const steps = stepsFromInput(value);
  return steps === null ? "—" : formatter.format(steps);
}

function formatLiters(value: string) {
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? `${formatter.format(parsed)} L` : "—";
}

export function TodayActivity({ stepsSummary, ...props }: TodayActivityProps) {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<DailyActivityDraft>({
    steps: props.stepsInitial == null ? "" : String(props.stepsInitial),
    waterL: props.waterInitial == null ? "" : String(props.waterInitial),
    mateL: props.mateInitial == null ? "" : String(props.mateInitial),
  });

  const activityValuesLabel = {
    steps: formatSteps(activity.steps),
    water: formatLiters(activity.waterL),
    mate: formatLiters(activity.mateL),
  };

  return (
    <>
      <DayActivityPanel
        expenditureLabel={props.expenditureLabel}
        balanceLabel={props.balanceLabel}
        workLabel={props.workLabel}
        workSourceLabel={props.workSourceLabel}
        gymLabel={props.gymLabel}
        gymSourceLabel={props.gymSourceLabel}
        activityValuesLabel={activityValuesLabel}
        onOpen={() => setOpen(true)}
      />

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Actividad de hoy"
        description="Registrá pasos, agua y mate; el contexto y las correcciones quedan disponibles acá."
        closeLabel="Cerrar actividad de hoy"
      >
        <div className="space-y-5">
          <section className="space-y-3" aria-labelledby="daily-activity-context">
            <h3 id="daily-activity-context" className="text-sm font-semibold">Contexto del día</h3>
            <ActivityContextSummary
              expenditureLabel={props.expenditureLabel}
              balanceLabel={props.balanceLabel}
              workLabel={props.workLabel}
              workSourceLabel={props.workSourceLabel}
              gymLabel={props.gymLabel}
              gymSourceLabel={props.gymSourceLabel}
              className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/35 px-3 py-3 text-sm"
            />
          </section>

          <DayContextEditor {...props} stepsSummary={stepsSummary} onActivityChange={setActivity} />
        </div>
      </ResponsiveDialog>
    </>
  );
}
