"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExpenditureRulePeriod, NutritionGoalPeriod, WorkSchedulePeriod } from "@/lib/phase1/types";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { createExpenditureAction, createGoalAction, createScheduleAction, type SettingsActionState } from "./actions";

const initial: SettingsActionState = { ok: false };
const days = [["monday", "Lunes"], ["tuesday", "Martes"], ["wednesday", "Miércoles"], ["thursday", "Jueves"], ["friday", "Viernes"], ["saturday", "Sábado"], ["sunday", "Domingo"]] as const;

function StateMessage({ state }: { state: SettingsActionState }) {
  if (state.error) return <p className="text-sm text-destructive" role="alert">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-primary" role="status">Nueva versión guardada.</p>;
  return null;
}

function useCloseAfterSave(state: SettingsActionState, onSuccess: () => void) {
  const router = useRouter();
  useEffect(() => {
    if (!state.ok) return;
    router.refresh();
    onSuccess();
  }, [onSuccess, router, state.ok]);
}

function Field({ name, label, value, step = "1" }: { name: string; label: string; value?: number; step?: string }) {
  const decimal = step !== "1";
  return <div className="min-w-0 space-y-1"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type={decimal ? "text" : "number"} min={0} step={decimal ? undefined : step} inputMode={decimal ? "decimal" : "numeric"} pattern={decimal ? "[0-9]*[.,]?[0-9]*" : undefined} required defaultValue={value} /></div>;
}

function VersionDialog({ buttonLabel, title, description, children }: { buttonLabel: string; title: string; description: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" className="h-11 w-full sm:w-auto" onClick={() => setOpen(true)}>{buttonLabel}</Button>
    <ResponsiveDialog open={open} onOpenChange={setOpen} title={title} description={description} closeLabel={`Cerrar ${title.toLowerCase()}`}>
      {open ? children(() => setOpen(false)) : null}
    </ResponsiveDialog>
  </>;
}

export function GoalVersionDialog({ current, today }: { current: NutritionGoalPeriod | null; today: string }) {
  return <VersionDialog buttonLabel="Cambiar objetivos" title="Cambiar objetivos" description="Los cambios anteriores se conservan.">{(close) => <GoalForm current={current} today={today} onSuccess={close} />}</VersionDialog>;
}

function GoalForm({ current, today, onSuccess }: { current: NutritionGoalPeriod | null; today: string; onSuccess: () => void }) {
  const [state, action, pending] = useActionState(createGoalAction, initial);
  useCloseAfterSave(state, onSuccess);
  return <form action={action} className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><div className="min-w-0 space-y-1"><Label htmlFor="goal-name">Nombre</Label><Input id="goal-name" name="name" required defaultValue={current?.name ?? ""} placeholder="Ej: Recomposición suave" /></div><div className="min-w-0 space-y-1"><Label htmlFor="goal-date">Vigente desde</Label><Input id="goal-date" name="effective_from" type="date" required defaultValue={today} className="[min-inline-size:0]" /></div></div>
    <div><p className="mb-2 text-sm font-medium">Calorías</p><div className="grid grid-cols-2 gap-3"><Field name="calories_no_gym" label="Sin gym" value={current?.calories_no_gym} /><Field name="calories_gym" label="Con gym" value={current?.calories_gym} /></div></div>
    <div><p className="mb-2 text-sm font-medium">Proteína (g)</p><div className="grid grid-cols-2 gap-3"><Field name="protein_no_gym_g" label="Sin gym" step="0.1" value={current?.protein_no_gym_g} /><Field name="protein_gym_g" label="Con gym" step="0.1" value={current?.protein_gym_g} /></div></div>
    <div><p className="mb-2 text-sm font-medium">Agua (L)</p><div className="grid grid-cols-2 gap-3"><Field name="water_no_gym_l" label="Sin gym" step="0.1" value={current?.water_no_gym_l} /><Field name="water_gym_l" label="Con gym" step="0.1" value={current?.water_gym_l} /></div></div>
    <StateMessage state={state} />
    <Button className="h-11 w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar nuevos objetivos"}</Button>
  </form>;
}

export function ExpenditureVersionDialog({ current, today }: { current: ExpenditureRulePeriod | null; today: string }) {
  return <VersionDialog buttonLabel="Cambiar gasto estimado" title="Cambiar gasto estimado" description="Los cambios anteriores se conservan.">{(close) => <ExpenditureForm current={current} today={today} onSuccess={close} />}</VersionDialog>;
}

function ExpenditureForm({ current, today, onSuccess }: { current: ExpenditureRulePeriod | null; today: string; onSuccess: () => void }) {
  const [state, action, pending] = useActionState(createExpenditureAction, initial);
  useCloseAfterSave(state, onSuccess);
  return <form action={action} className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><div className="min-w-0 space-y-1"><Label htmlFor="expense-name">Nombre</Label><Input id="expense-name" name="name" required defaultValue={current?.name ?? ""} /></div><div className="min-w-0 space-y-1"><Label htmlFor="expense-date">Vigente desde</Label><Input id="expense-date" name="effective_from" type="date" required defaultValue={today} className="[min-inline-size:0]" /></div></div>
    <div className="grid grid-cols-2 gap-3"><Field name="work_gym_kcal" label="Trabajo + gym" value={current?.work_gym_kcal} /><Field name="work_no_gym_kcal" label="Trabajo + sin gym" value={current?.work_no_gym_kcal} /><Field name="no_work_gym_kcal" label="Sin trabajo + gym" value={current?.no_work_gym_kcal} /><Field name="no_work_no_gym_kcal" label="Sin trabajo + sin gym" value={current?.no_work_no_gym_kcal} /></div>
    <StateMessage state={state} />
    <Button className="h-11 w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar nuevo gasto"}</Button>
  </form>;
}

export function ScheduleVersionDialog({ current, today }: { current: WorkSchedulePeriod | null; today: string }) {
  return <VersionDialog buttonLabel="Cambiar horario" title="Cambiar horario" description="Los cambios anteriores se conservan.">{(close) => <ScheduleForm current={current} today={today} onSuccess={close} />}</VersionDialog>;
}

function ScheduleForm({ current, today, onSuccess }: { current: WorkSchedulePeriod | null; today: string; onSuccess: () => void }) {
  const [state, action, pending] = useActionState(createScheduleAction, initial);
  useCloseAfterSave(state, onSuccess);
  return <form action={action} className="space-y-4">
    <div className="grid grid-cols-2 gap-3"><div className="min-w-0 space-y-1"><Label htmlFor="schedule-name">Nombre</Label><Input id="schedule-name" name="name" required defaultValue={current?.name ?? ""} /></div><div className="min-w-0 space-y-1"><Label htmlFor="schedule-date">Vigente desde</Label><Input id="schedule-date" name="effective_from" type="date" required defaultValue={today} className="[min-inline-size:0]" /></div></div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{days.map(([key, label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"><input type="checkbox" name={key} defaultChecked={current?.[key] ?? false} className="size-4 accent-primary" />{label}</label>)}</div>
    <StateMessage state={state} />
    <Button className="h-11 w-full" disabled={pending}>{pending ? "Guardando…" : "Guardar nuevo horario"}</Button>
  </form>;
}
