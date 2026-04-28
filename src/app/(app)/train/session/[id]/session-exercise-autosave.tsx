"use client";

import { useEffect, useRef, useState } from "react";
import { updateSessionExerciseAction } from "../../actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { appendNumericSessionFields } from "./session-exercise-autosave-helpers";

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

const DEBOUNCE_MS = 400;

function fieldFromInitial(n: number | null): string {
  return n === null ? "" : String(n);
}

export function SessionExerciseAutosave(props: Props) {
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [isCompleted, setIsCompleted] = useState(props.initial.is_completed);
  const [series, setSeries] = useState(() => fieldFromInitial(props.initial.series_reales));
  const [reps, setReps] = useState(() => fieldFromInitial(props.initial.reps_reales));
  const [peso, setPeso] = useState(() => fieldFromInitial(props.initial.peso_real));

  const seriesRef = useRef(fieldFromInitial(props.initial.series_reales));
  const repsRef = useRef(fieldFromInitial(props.initial.reps_reales));
  const pesoRef = useRef(fieldFromInitial(props.initial.peso_real));

  const activeOpsRef = useRef(0);
  const saveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const debounceRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);
  const propsRef = useRef({ sessionId: props.sessionId, id: props.id });
  propsRef.current = { sessionId: props.sessionId, id: props.id };

  const flushRef = useRef<() => void>(() => {});

  // Solo al cambiar de fila: evita pisar estado local en cada revalidate.
  useEffect(() => {
    setIsCompleted(props.initial.is_completed);
    const s = fieldFromInitial(props.initial.series_reales);
    const r = fieldFromInitial(props.initial.reps_reales);
    const p = fieldFromInitial(props.initial.peso_real);
    setSeries(s);
    setReps(r);
    setPeso(p);
    seriesRef.current = s;
    repsRef.current = r;
    pesoRef.current = p;
  }, [props.id]);

  function clearDebounce() {
    if (debounceRef.current !== null) {
      globalThis.clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  function runNumericSave() {
    const { sessionId, id } = propsRef.current;
    const formData = new FormData();
    formData.set("session_id", sessionId);
    formData.set("id", id);
    appendNumericSessionFields(formData, seriesRef.current, repsRef.current, pesoRef.current);
    return updateSessionExerciseAction(formData);
  }

  function enqueueSave(fn: () => Promise<unknown>) {
    activeOpsRef.current += 1;
    if (activeOpsRef.current === 1) {
      setIsSaving(true);
    }
    setError(null);
    saveChainRef.current = saveChainRef.current
      .then(() => fn())
      .then(() => {
        setSavedAt(Date.now());
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Error inesperado.");
      })
      .finally(() => {
        activeOpsRef.current -= 1;
        if (activeOpsRef.current === 0) {
          setIsSaving(false);
        }
      });
  }

  function scheduleNumericSave() {
    clearDebounce();
    debounceRef.current = globalThis.setTimeout(() => {
      debounceRef.current = null;
      enqueueSave(() => runNumericSave());
    }, DEBOUNCE_MS);
  }

  function flushNumericNow() {
    clearDebounce();
    enqueueSave(() => runNumericSave());
  }

  flushRef.current = flushNumericNow;

  function saveCompletion(next: boolean) {
    clearDebounce();
    setIsCompleted(next);
    const { sessionId, id } = propsRef.current;
    enqueueSave(() => {
      const formData = new FormData();
      formData.set("session_id", sessionId);
      formData.set("id", id);
      formData.set("is_completed", next ? "1" : "0");
      return updateSessionExerciseAction(formData);
    });
  }

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === "hidden") {
        clearDebounce();
        flushRef.current();
      }
    }
    function onPageHide() {
      clearDebounce();
      flushRef.current();
    }
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);

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
            saveCompletion(e.target.checked);
          }}
          className="size-5"
        />
        <span className="font-medium">Hecho</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {isSaving ? "Guardando..." : savedAt ? "Guardado" : ""}
        </span>
      </label>

      <div className="space-y-1">
        <Label>Real</Label>
        <div className="grid grid-cols-3 gap-2">
          <Input
            value={series}
            onChange={(e) => {
              const v = e.target.value;
              seriesRef.current = v;
              setSeries(v);
              scheduleNumericSave();
            }}
            onBlur={flushNumericNow}
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
              const v = e.target.value;
              repsRef.current = v;
              setReps(v);
              scheduleNumericSave();
            }}
            onBlur={flushNumericNow}
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
              const v = e.target.value;
              pesoRef.current = v;
              setPeso(v);
              scheduleNumericSave();
            }}
            onBlur={flushNumericNow}
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
