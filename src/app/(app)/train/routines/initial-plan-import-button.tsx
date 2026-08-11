"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { importInitialTrainingPlanAction } from "../actions";

export function InitialPlanImportButton({ imported }: { imported: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function importPlan() {
    if (
      imported &&
      !window.confirm(
        "Esto restaurará Pecho, Espalda y Piernas con los objetivos iniciales. No modifica sesiones anteriores ni otras rutinas. ¿Continuar?",
      )
    ) {
      return;
    }

    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await importInitialTrainingPlanAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage(
        `${result.data.routines} rutinas y ${result.data.exercises} ejercicios cargados.`,
      );
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <Button
        className="h-11 w-full"
        type="button"
        variant={imported ? "outline" : "default"}
        disabled={pending}
        onClick={importPlan}
      >
        {pending
          ? "Cargando…"
          : imported
            ? "Restaurar plan inicial"
            : "Cargar plan inicial"}
      </Button>
      <p className="text-xs text-muted-foreground">
        Operación repetible: no toca nutrición ni reescribe entrenamientos guardados.
      </p>
      <div aria-live="polite">
        {message ? <p className="text-sm text-emerald-600">{message}</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
