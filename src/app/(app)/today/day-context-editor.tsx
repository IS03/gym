"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepsReportSummary } from "@/lib/nutrition/steps-report-core";
import {
  DailyActivityAutosaveQueue,
  type DailyActivityAutosaveState,
  type DailyActivityDraft,
} from "@/lib/nutrition/activity-autosave";
import {
  saveDailyActivityAction,
  saveExpenditureOverrideAction,
  saveGymOverrideAction,
  saveWorkOverrideAction,
} from "./nutrition-actions";
import { StepsSummary } from "./steps-card";

type Props = {
  dayLogId: string;
  stepsInitial: number | null;
  waterInitial: number | null;
  mateInitial: number | null;
  workOverride: boolean | null;
  workReasonInitial: string | null;
  gymReasonInitial: string | null;
  expenditureInitial: number | null;
  gymSource: "workout" | "override" | "none";
  waterTargetLabel: string | null;
  stepsSummary: StepsReportSummary;
  onActivityChange?: (draft: DailyActivityDraft) => void;
};

export function DayContextEditor({ dayLogId, stepsInitial, waterInitial, mateInitial, workOverride, workReasonInitial, gymReasonInitial, expenditureInitial, gymSource, waterTargetLabel, stepsSummary, onActivityChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [steps, setSteps] = useState(stepsInitial == null ? "" : String(stepsInitial));
  const [water, setWater] = useState(waterInitial == null ? "" : String(waterInitial));
  const [mate, setMate] = useState(mateInitial == null ? "" : String(mateInitial));
  const [workMode, setWorkMode] = useState<"schedule" | "worked" | "not_worked">(
    workOverride == null ? "schedule" : workOverride ? "worked" : "not_worked",
  );
  const [workReason, setWorkReason] = useState(workReasonInitial ?? "Corrección manual del día");
  const [gymReason, setGymReason] = useState(gymReasonInitial ?? "Entrenamiento histórico sin sesión");
  const [expenditure, setExpenditure] = useState(expenditureInitial == null ? "" : String(expenditureInitial));
  const [autosave, setAutosave] = useState<DailyActivityAutosaveState>({ phase: "idle", error: null });
  const mountedRef = useRef(true);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueRef = useRef<DailyActivityAutosaveQueue | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    const queue = new DailyActivityAutosaveQueue({
      debounceMs: 650,
      initial: {
        steps: stepsInitial == null ? "" : String(stepsInitial),
        waterL: waterInitial == null ? "" : String(waterInitial),
        mateL: mateInitial == null ? "" : String(mateInitial),
      },
      save: async (draft) => {
        const result = await saveDailyActivityAction({ dayLogId, ...draft });
        if (!result.ok) throw new Error(result.error);
      },
      onStateChange: (state) => {
        if (!mountedRef.current) return;
        if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
        setAutosave(state);
        if (state.phase === "saved") {
          savedTimerRef.current = setTimeout(() => {
            if (mountedRef.current) setAutosave({ phase: "idle", error: null });
          }, 2200);
        }
      },
    });
    queueRef.current = queue;
    return () => {
      mountedRef.current = false;
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      queue.dispose();
      if (queueRef.current === queue) queueRef.current = null;
    };
  }, [dayLogId, mateInitial, stepsInitial, waterInitial]);

  function changeActivity(next: DailyActivityDraft) {
    setSteps(next.steps);
    setWater(next.waterL);
    setMate(next.mateL);
    onActivityChange?.(next);
    queueRef.current?.change(next);
  }

  function activityDraft(overrides: Partial<DailyActivityDraft> = {}): DailyActivityDraft {
    return { steps, waterL: water, mateL: mate, ...overrides };
  }

  function submit(task: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setNotice(null);
    startTransition(async () => {
      const result = await task();
      setNotice(result.ok ? "Cambios guardados." : result.error);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="min-w-0 space-y-1">
          <Label htmlFor="daily-steps" className="text-xs">Pasos</Label>
          <Input className="h-10 px-2" id="daily-steps" inputMode="numeric" value={steps} onChange={(e) => changeActivity(activityDraft({ steps: e.target.value }))} onBlur={() => void queueRef.current?.flush()} placeholder="—" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="daily-water" className="min-w-0 gap-1 text-[11px] sm:text-xs">
            <span className="shrink-0">Agua</span>
            {waterTargetLabel ? <span className="truncate font-normal text-muted-foreground">· meta {waterTargetLabel}</span> : null}
          </Label>
          <Input className="h-10 px-2" id="daily-water" inputMode="decimal" value={water} onChange={(e) => changeActivity(activityDraft({ waterL: e.target.value }))} onBlur={() => void queueRef.current?.flush()} placeholder="—" />
        </div>
        <div className="min-w-0 space-y-1">
          <Label htmlFor="daily-mate" className="text-xs">Mate</Label>
          <Input className="h-10 px-2" id="daily-mate" inputMode="decimal" value={mate} onChange={(e) => changeActivity(activityDraft({ mateL: e.target.value }))} onBlur={() => void queueRef.current?.flush()} placeholder="—" />
        </div>
      </div>
      <p
        className={`min-h-4 text-xs leading-4 ${autosave.phase === "error" ? "text-destructive" : autosave.phase === "saved" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}
        role="status"
        aria-live="polite"
      >
        {autosave.phase === "scheduled" || autosave.phase === "saving"
          ? "Guardando…"
          : autosave.phase === "saved"
            ? "Guardado"
            : autosave.phase === "error"
              ? autosave.error
              : null}
      </p>

      <StepsSummary steps={steps} summary={stepsSummary} />

      <details className="group/corrections rounded-xl border">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
          Correcciones del día
          <span className="shrink-0 text-muted-foreground transition-transform duration-200 group-open/corrections:rotate-90 motion-reduce:transition-none">
            <ChevronRight className="size-4" aria-hidden />
          </span>
        </summary>
        <div className="space-y-4 border-t px-3 pb-3 pt-3">
          <div className="space-y-2">
            <Label htmlFor="work-mode">Trabajo</Label>
            <select id="work-mode" value={workMode} onChange={(e) => setWorkMode(e.target.value as typeof workMode)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
              <option value="schedule">Usar horario habitual</option>
              <option value="worked">Trabajé</option>
              <option value="not_worked">No trabajé</option>
            </select>
            {workMode !== "schedule" ? <Input aria-label="Motivo de la corrección laboral" value={workReason} onChange={(e) => setWorkReason(e.target.value)} placeholder="Motivo" /> : null}
            <Button type="button" size="sm" variant="outline" disabled={pending}
              onClick={() => submit(() => saveWorkOverrideAction({ dayLogId, mode: workMode, reason: workReason }))}>
              Guardar trabajo
            </Button>
          </div>

          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Entrenamiento</p>
            {gymSource === "workout" ? (
              <p className="text-xs text-muted-foreground">Proviene de una sesión completada y no puede negarse desde Nutrición.</p>
            ) : gymSource === "override" ? (
              <Button type="button" size="sm" variant="outline" disabled={pending}
                onClick={() => submit(() => saveGymOverrideAction({ dayLogId, enabled: false }))}>
                Quitar entrenamiento sin sesión
              </Button>
            ) : (
              <div className="space-y-2">
                <Input aria-label="Motivo del entrenamiento sin sesión" value={gymReason} onChange={(e) => setGymReason(e.target.value)} placeholder="Motivo" />
                <Button type="button" size="sm" variant="outline" disabled={pending}
                  onClick={() => submit(() => saveGymOverrideAction({ dayLogId, enabled: true, reason: gymReason }))}>
                  Registrar que entrené sin sesión
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t pt-3">
            <Label htmlFor="expenditure-override">Gasto manual excepcional (kcal)</Label>
            <Input id="expenditure-override" inputMode="numeric" value={expenditure} onChange={(e) => setExpenditure(e.target.value)} placeholder="Vacío = regla automática" />
            <p className="text-xs text-muted-foreground">Es gasto estimado, no objetivo de calorías.</p>
            <Button type="button" size="sm" variant="outline" disabled={pending}
              onClick={() => submit(() => saveExpenditureOverrideAction({ dayLogId, kcal: expenditure }))}>
              {expenditure ? "Guardar gasto excepcional" : "Usar gasto automático"}
            </Button>
          </div>
        </div>
      </details>
      <div className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {notice ? <p>{notice}</p> : null}
      </div>
    </div>
  );
}
