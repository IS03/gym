"use client";

import { useActionState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ExpenditureRulePeriod, NutritionGoalPeriod, WorkSchedulePeriod } from "@/lib/phase1/types";
import { createExpenditureAction, createGoalAction, createScheduleAction, type SettingsActionState } from "./actions";

const initial: SettingsActionState = { ok: false };
const days = [
  ["monday", "Lunes"], ["tuesday", "Martes"], ["wednesday", "Miércoles"],
  ["thursday", "Jueves"], ["friday", "Viernes"], ["saturday", "Sábado"], ["sunday", "Domingo"],
] as const;

function StateMessage({ state }: { state: SettingsActionState }) {
  if (state.error) return <p className="text-sm text-destructive" role="alert">{state.error}</p>;
  if (state.ok) return <p className="text-sm text-primary" role="status">Nueva versión guardada.</p>;
  return null;
}

function Field({ name, label, value, step = "1" }: { name: string; label: string; value?: number; step?: string }) {
  return <div className="space-y-1"><Label htmlFor={name}>{label}</Label><Input id={name} name={name} type="number" min={0} step={step} required defaultValue={value} /></div>;
}

export function NutritionSettingsForms({ goals, expenditure, schedules, today }: {
  goals: NutritionGoalPeriod[]; expenditure: ExpenditureRulePeriod[]; schedules: WorkSchedulePeriod[]; today: string;
}) {
  const currentGoal = goals.find((p) => p.effective_from <= today) ?? null;
  const currentExpenditure = expenditure.find((p) => p.effective_from <= today) ?? null;
  const currentSchedule = schedules.find((p) => p.effective_from <= today) ?? null;
  const [goalState, goalAction, goalPending] = useActionState(createGoalAction, initial);
  const [expenseState, expenseAction, expensePending] = useActionState(createExpenditureAction, initial);
  const [scheduleState, scheduleAction, schedulePending] = useActionState(createScheduleAction, initial);

  return <div className="space-y-6">
    <section className="space-y-3" aria-labelledby="nutrition-goals-title">
      <div><h2 id="nutrition-goals-title" className="text-base font-semibold lg:text-lg">Objetivos</h2><p className="text-sm text-muted-foreground">Vigente: {currentGoal ? `${currentGoal.name} · desde ${currentGoal.effective_from}` : "sin configurar"}</p></div>
      <Card><CardHeader className="pb-3"><CardTitle className="text-base">Crear nueva versión</CardTitle><p className="text-sm text-muted-foreground">Los cambios anteriores se conservan.</p></CardHeader><CardContent>
        <form action={goalAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="goal-name">Nombre</Label><Input id="goal-name" name="name" required placeholder="Ej: Volumen controlado" /></div><div className="space-y-1"><Label htmlFor="goal-date">Vigente desde</Label><Input id="goal-date" name="effective_from" type="date" required defaultValue={today} /></div></div>
          <div><p className="mb-2 text-sm font-medium">Calorías</p><div className="grid grid-cols-2 gap-3"><Field name="calories_no_gym" label="Sin gym" value={currentGoal?.calories_no_gym} /><Field name="calories_gym" label="Con gym" value={currentGoal?.calories_gym} /></div></div>
          <div><p className="mb-2 text-sm font-medium">Proteína (g)</p><div className="grid grid-cols-2 gap-3"><Field name="protein_no_gym_g" label="Sin gym" step="0.1" value={currentGoal?.protein_no_gym_g} /><Field name="protein_gym_g" label="Con gym" step="0.1" value={currentGoal?.protein_gym_g} /></div></div>
          <div><p className="mb-2 text-sm font-medium">Agua (L)</p><div className="grid grid-cols-2 gap-3"><Field name="water_no_gym_l" label="Sin gym" step="0.1" value={currentGoal?.water_no_gym_l} /><Field name="water_gym_l" label="Con gym" step="0.1" value={currentGoal?.water_gym_l} /></div></div>
          <StateMessage state={goalState} /><Button className="h-11 w-full" disabled={goalPending}>{goalPending ? "Guardando…" : "Crear versión de objetivos"}</Button>
        </form>
      </CardContent></Card>
      {goals.length > 0 ? <details className="rounded-xl border bg-card px-4 py-2"><summary className="min-h-10 cursor-pointer py-2 text-sm font-medium">Historial de objetivos · {goals.length}</summary><div className="divide-y border-t">{goals.map((p) => <div key={p.id} className="py-3 text-sm"><p className="font-medium">{p.name}</p><p className="text-xs text-muted-foreground">{p.effective_from} · {p.calories_no_gym}/{p.calories_gym} kcal · P {p.protein_no_gym_g}/{p.protein_gym_g} g · Agua {p.water_no_gym_l}/{p.water_gym_l} L</p></div>)}</div></details> : null}
    </section>

    <section className="space-y-3" aria-labelledby="expenditure-title">
      <div><h2 id="expenditure-title" className="text-base font-semibold lg:text-lg">Gasto estimado</h2><p className="text-sm text-muted-foreground">Configuración avanzada · {currentExpenditure ? `${currentExpenditure.name}, desde ${currentExpenditure.effective_from}` : "sin regla"}</p></div>
      <Card><CardContent className="pt-4"><form action={expenseAction} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="expense-name">Nombre</Label><Input id="expense-name" name="name" required /></div><div className="space-y-1"><Label htmlFor="expense-date">Vigente desde</Label><Input id="expense-date" name="effective_from" type="date" required defaultValue={today} /></div></div>
        <div className="grid grid-cols-2 gap-3"><Field name="work_gym_kcal" label="Trabajo + gym" value={currentExpenditure?.work_gym_kcal} /><Field name="work_no_gym_kcal" label="Trabajo + sin gym" value={currentExpenditure?.work_no_gym_kcal} /><Field name="no_work_gym_kcal" label="Sin trabajo + gym" value={currentExpenditure?.no_work_gym_kcal} /><Field name="no_work_no_gym_kcal" label="Sin trabajo + sin gym" value={currentExpenditure?.no_work_no_gym_kcal} /></div>
        <StateMessage state={expenseState} /><Button variant="outline" className="h-11 w-full" disabled={expensePending}>{expensePending ? "Guardando…" : "Crear versión de gasto"}</Button>
      </form></CardContent></Card>
    </section>

    <section className="space-y-3" aria-labelledby="schedule-title">
      <div><h2 id="schedule-title" className="text-base font-semibold lg:text-lg">Horario laboral habitual</h2><p className="text-sm text-muted-foreground">{currentSchedule ? `${currentSchedule.name} · desde ${currentSchedule.effective_from}` : "Sin horario configurado"}</p></div>
      <Card><CardContent className="pt-4"><form action={scheduleAction} className="space-y-4">
        <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="schedule-name">Nombre</Label><Input id="schedule-name" name="name" required /></div><div className="space-y-1"><Label htmlFor="schedule-date">Vigente desde</Label><Input id="schedule-date" name="effective_from" type="date" required defaultValue={today} /></div></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{days.map(([key,label]) => <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 text-sm"><input type="checkbox" name={key} defaultChecked={currentSchedule?.[key] ?? false} className="size-4 accent-primary" />{label}</label>)}</div>
        <StateMessage state={scheduleState} /><Button variant="outline" className="h-11 w-full" disabled={schedulePending}>{schedulePending ? "Guardando…" : "Crear versión de horario"}</Button>
      </form></CardContent></Card>
    </section>
  </div>;
}
