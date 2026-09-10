import type { RoutineExercisePayload, TrainingAdjustment } from "./types";

type TargetValue = number | null;

function allEqual(values: TargetValue[]): number | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  const first = values[0];
  return values.every((value) => value === first) ? first : null;
}

function hasDifferentConfiguredValues(values: TargetValue[]) {
  return new Set(values.filter((value): value is number => value !== null)).size > 1;
}

function configuredRange(values: TargetValue[]): [number, number] | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  const configured = values as number[];
  return [Math.min(...configured), Math.max(...configured)];
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

export type RoutineExerciseTargetSummary = {
  setLabel: string;
  signals: string[];
  adjustmentLabel: string | null;
};

function adjustmentLabel(adjustment: TrainingAdjustment) {
  switch (adjustment) {
    case "increase_weight":
      return "+ Peso";
    case "increase_reps":
      return "+ Repeticiones";
    case "custom":
      return "Ajuste personalizado";
    case "maintain":
      return null;
  }
}

/** A compact, truthful summary of independently configured routine sets. */
export function summarizeRoutineExerciseTarget(
  payload: Pick<RoutineExercisePayload, "sets" | "next_adjustment">,
): RoutineExerciseTargetSummary {
  const weights = payload.sets.map((set) => set.target_weight_kg);
  const rirs = payload.sets.map((set) => set.target_rir);
  const reps = payload.sets.map((set) => set.target_reps);
  const signals: string[] = [];
  const uniformWeight = allEqual(weights);
  const uniformRir = allEqual(rirs);
  const uniformReps = allEqual(reps);
  const weightRange = configuredRange(weights);
  const rirRange = configuredRange(rirs);
  const setLabel = uniformReps === null
    ? `${payload.sets.length} ${payload.sets.length === 1 ? "serie" : "series"}`
    : `${payload.sets.length} × ${formatNumber(uniformReps)}`;

  if (uniformWeight !== null) signals.push(`${formatNumber(uniformWeight)} kg`);
  else if (weightRange && weightRange[0] !== weightRange[1]) {
    signals.push(`${formatNumber(weightRange[0])}–${formatNumber(weightRange[1])} kg`);
  } else if (hasDifferentConfiguredValues(weights)) signals.push("carga variable");

  if (uniformRir !== null) signals.push(`RIR ${formatNumber(uniformRir)}`);
  else if (rirRange && rirRange[0] !== rirRange[1]) {
    signals.push(`RIR ${formatNumber(rirRange[0])}–${formatNumber(rirRange[1])}`);
  } else if (hasDifferentConfiguredValues(rirs)) signals.push("RIR variable");

  return {
    setLabel,
    signals: signals.slice(0, 2),
    adjustmentLabel: adjustmentLabel(payload.next_adjustment),
  };
}
