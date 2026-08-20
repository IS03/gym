"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DayContextEditor } from "./day-context-editor";

type Props = React.ComponentProps<typeof DayContextEditor> & {
  expenditureLabel: string;
  balanceLabel: string;
  workLabel: string;
  workSourceLabel: string;
  gymLabel: string;
  gymSourceLabel: string;
  waterTargetLabel: string | null;
};

function valueOrDash(value: string, suffix = "") {
  return value === "" ? "—" : `${value}${suffix}`;
}

export function DayActivityPanel({
  expenditureLabel,
  balanceLabel,
  workLabel,
  workSourceLabel,
  gymLabel,
  gymSourceLabel,
  waterTargetLabel,
  ...editorProps
}: Props) {
  const [activity, setActivity] = useState({
    steps: editorProps.stepsInitial == null ? "" : String(editorProps.stepsInitial),
    waterL: editorProps.waterInitial == null ? "" : String(editorProps.waterInitial),
    mateL: editorProps.mateInitial == null ? "" : String(editorProps.mateInitial),
  });

  return (
    <Card size="sm">
      <details className="group/activity">
        <summary className="cursor-pointer list-none px-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold">Actividad de hoy</p>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-open/activity:rotate-90" aria-hidden />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-2">
            <div><p className="text-xs text-muted-foreground">Pasos</p><p className="font-semibold">{valueOrDash(activity.steps)}</p></div>
            <div><p className="text-xs text-muted-foreground">Agua</p><p className="font-semibold">{valueOrDash(activity.waterL, " L")}</p></div>
            <div><p className="text-xs text-muted-foreground">Trabajo</p><p className="font-semibold">{workLabel}</p></div>
            <div><p className="text-xs text-muted-foreground">Entrenamiento</p><p className="font-semibold">{gymLabel}</p></div>
          </div>
        </summary>
        <CardContent className="mt-3 space-y-4 border-t pt-4">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Gasto estimado</p><p className="font-semibold">{expenditureLabel}</p></div>
            <div><p className="text-xs text-muted-foreground">Balance energético</p><p className="font-semibold">{balanceLabel}</p></div>
            <div><p className="text-xs text-muted-foreground">Trabajo</p><p className="font-semibold">{workLabel} <span className="font-normal text-muted-foreground">· {workSourceLabel}</span></p></div>
            <div><p className="text-xs text-muted-foreground">Entrenamiento</p><p className="font-semibold">{gymLabel} <span className="font-normal text-muted-foreground">· {gymSourceLabel}</span></p></div>
            <div><p className="text-xs text-muted-foreground">Agua</p><p className="font-semibold">{valueOrDash(activity.waterL, " L")}{waterTargetLabel ? ` / ${waterTargetLabel}` : ""}</p></div>
            <div><p className="text-xs text-muted-foreground">Mate</p><p className="font-semibold">{valueOrDash(activity.mateL, " L")}</p></div>
          </div>
          <div className="border-t pt-4">
            <DayContextEditor {...editorProps} onActivityChange={setActivity} />
          </div>
        </CardContent>
      </details>
    </Card>
  );
}
