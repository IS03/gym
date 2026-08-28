import type { RoutineExercisePayload } from "./types";

type TargetValue = number | null;

function allEqual(values: TargetValue[]): number | null {
  if (values.length === 0 || values.some((value) => value === null)) return null;
  const first = values[0];
  return values.every((value) => value === first) ? first : null;
}

function hasDifferentConfiguredValues(values: TargetValue[]) {
  return new Set(values.filter((value): value is number => value !== null)).size > 1;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
}

export type RoutineExerciseTargetSummary = {
  setLabel: string;
  signals: string[];
};

/** A compact, truthful summary of independently configured routine sets. */
export function summarizeRoutineExerciseTarget(
  payload: Pick<RoutineExercisePayload, "sets">,
): RoutineExerciseTargetSummary {
  const setLabel = `${payload.sets.length} ${payload.sets.length === 1 ? "serie" : "series"}`;
  const weights = payload.sets.map((set) => set.target_weight_kg);
  const rirs = payload.sets.map((set) => set.target_rir);
  const reps = payload.sets.map((set) => set.target_reps);
  const signals: string[] = [];
  const uniformWeight = allEqual(weights);
  const uniformRir = allEqual(rirs);
  const uniformReps = allEqual(reps);

  if (uniformWeight !== null) signals.push(`${formatNumber(uniformWeight)} kg`);
  else if (hasDifferentConfiguredValues(weights)) signals.push("carga variable");

  if (uniformRir !== null) signals.push(`RIR ${formatNumber(uniformRir)}`);
  else if (hasDifferentConfiguredValues(rirs)) signals.push("RIR variable");

  if (signals.length < 2 && uniformReps !== null) {
    signals.push(`${formatNumber(uniformReps)} reps`);
  }

  return { setLabel, signals: signals.slice(0, 2) };
}
