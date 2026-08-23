"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDateFieldValue } from "@/lib/date-field-display";
import { ResponsiveDialog } from "@/app/(app)/today/responsive-dialog";
import { saveDailyActivityAction } from "@/app/(app)/today/nutrition-actions";

type Props = {
  dayLogId: string;
  date: string;
  stepsInitial: number | null;
  waterInitial: number | null;
  mateInitial: number | null;
};

const asInputValue = (value: number | null) => value == null ? "" : String(value);

export function HistoricalActivityEditor({ dayLogId, date, stepsInitial, waterInitial, mateInitial }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [steps, setSteps] = useState(asInputValue(stepsInitial));
  const [water, setWater] = useState(asInputValue(waterInitial));
  const [mate, setMate] = useState(asInputValue(mateInitial));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function resetValues() {
    setSteps(asInputValue(stepsInitial));
    setWater(asInputValue(waterInitial));
    setMate(asInputValue(mateInitial));
    setError(null);
  }

  function onOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      resetValues();
      setSaved(false);
    }
    setOpen(nextOpen);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveDailyActivityAction({ dayLogId, steps, waterL: water, mateL: mate });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" className="-mr-2" onClick={() => onOpenChange(true)}>
        Editar
      </Button>
      <ResponsiveDialog
        open={open}
        onOpenChange={onOpenChange}
        title="Corregir actividad"
        description={formatDateFieldValue(date)}
        closeLabel="Cerrar corrección de actividad"
      >
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="history-activity-steps">Pasos</Label>
            <Input id="history-activity-steps" inputMode="numeric" value={steps} onChange={(event) => setSteps(event.target.value)} placeholder="—" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-activity-water">Agua (L)</Label>
            <Input id="history-activity-water" inputMode="decimal" value={water} onChange={(event) => setWater(event.target.value)} placeholder="—" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="history-activity-mate">Mate (L)</Label>
            <Input id="history-activity-mate" inputMode="decimal" value={mate} onChange={(event) => setMate(event.target.value)} placeholder="—" />
          </div>
          {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
        </form>
      </ResponsiveDialog>
      {saved ? <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400" role="status">✓ Cambios guardados</p> : null}
    </>
  );
}
