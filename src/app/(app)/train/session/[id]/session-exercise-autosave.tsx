"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { updateSessionExerciseAction } from "../../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  sessionId: string;
  id: string;
  initial: {
    is_completed: boolean;
    series_reales: number | null;
    reps_reales: number | null;
    peso_real: number | null;
  };
  readOnly?: boolean;
};

function toNullableNumber(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function SessionExerciseAutosave(props: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [isCompleted, setIsCompleted] = useState(props.initial.is_completed);
  const [series, setSeries] = useState(
    props.initial.series_reales === null ? "" : String(props.initial.series_reales),
  );
  const [reps, setReps] = useState(
    props.initial.reps_reales === null ? "" : String(props.initial.reps_reales),
  );
  const [peso, setPeso] = useState(
    props.initial.peso_real === null ? "" : String(props.initial.peso_real),
  );

  // Reset local state if record changed (navegación/revalidate)
  useEffect(() => {
    setIsCompleted(props.initial.is_completed);
    setSeries(props.initial.series_reales === null ? "" : String(props.initial.series_reales));
    setReps(props.initial.reps_reales === null ? "" : String(props.initial.reps_reales));
    setPeso(props.initial.peso_real === null ? "" : String(props.initial.peso_real));
  }, [props.id, props.initial.is_completed, props.initial.series_reales, props.initial.reps_reales, props.initial.peso_real]);

  const payload = useMemo(
    () => ({
      is_completed: isCompleted,
      series_reales: toNullableNumber(series),
      reps_reales: toNullableNumber(reps),
      peso_real: toNullableNumber(peso),
    }),
    [isCompleted, series, reps, peso],
  );

  const debounceRef = useRef<number | null>(null);

  // Si el usuario recarga/cambia de pestaña, intentamos flush rápido del debounce.
  useEffect(() => {
    function onPageHide() {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      // No hacemos await acá; solo evitamos que quede un timer colgado.
      // El guardado real ocurre con el último onChange/onBlur.
    }
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, []);

  function scheduleSave() {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setError(null);
      const formData = new FormData();
      formData.set("session_id", props.sessionId);
      formData.set("id", props.id);
      if (payload.series_reales !== null) formData.set("series_reales", String(payload.series_reales));
      if (payload.reps_reales !== null) formData.set("reps_reales", String(payload.reps_reales));
      if (payload.peso_real !== null) formData.set("peso_real", String(payload.peso_real));

      startTransition(async () => {
        try {
          await updateSessionExerciseAction(formData);
          setSavedAt(Date.now());
        } catch (e) {
          setError(e instanceof Error ? e.message : "Error inesperado.");
        }
      });
    }, 400);
  }

  function saveCompletion(next: boolean) {
    // Evita race: cancelar un debounce pendiente que podría pisar estado
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    setError(null);
    const formData = new FormData();
    formData.set("session_id", props.sessionId);
    formData.set("id", props.id);
    if (next) formData.set("is_completed", "on");

    startTransition(async () => {
      try {
        await updateSessionExerciseAction(formData);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error inesperado.");
      }
    });
  }

  if (props.readOnly) {
    return (
      <div className="space-y-2 text-sm">
        <p>
          <span className="font-medium">Hecho: </span>
          {isCompleted ? "Sí" : "No"}
        </p>
        <p>
          <span className="font-medium">Real: </span>
          {series || "—"} series · {reps || "—"} reps · {peso || "—"} kg
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={(e) => {
            const next = e.target.checked;
            setIsCompleted(next);
            saveCompletion(next);
          }}
          className="size-5"
        />
        <span className="font-medium">Hecho</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {isPending ? "Guardando..." : savedAt ? "Guardado" : ""}
        </span>
      </label>

      <div className="space-y-1">
        <Label>Real</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            value={series}
            onChange={(e) => {
              setSeries(e.target.value);
              scheduleSave();
            }}
            onBlur={scheduleSave}
            name="series_reales"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Series"
          />
          <Input
            value={reps}
            onChange={(e) => {
              setReps(e.target.value);
              scheduleSave();
            }}
            onBlur={scheduleSave}
            name="reps_reales"
            type="number"
            min={0}
            step={1}
            inputMode="numeric"
            placeholder="Reps"
          />
          <Input
            value={peso}
            onChange={(e) => {
              setPeso(e.target.value);
              scheduleSave();
            }}
            onBlur={scheduleSave}
            name="peso_real"
            type="number"
            min={0}
            step="0.5"
            inputMode="decimal"
            placeholder="Peso"
          />
        </div>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

