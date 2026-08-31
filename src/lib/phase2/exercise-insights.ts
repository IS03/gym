import type {
  MuscleGroup,
  TrainingAdjustment,
  WorkoutSet,
} from "./types";
import { normalizeExerciseSearch } from "./exercise-library";
import type { RoutineColorKey } from "./routine-colors";

export type ExerciseRoutineMembership = {
  id: string;
  nombre: string;
  color: RoutineColorKey | null;
};

export type ExerciseDirectoryEntry = {
  id: string;
  name: string;
  muscleGroup: MuscleGroup | null;
  muscleLabel: string | null;
  lastDate: string | null;
  sessions: number;
  bestWeightKg: number | null;
  totalVolumeKg: number;
  lastDecision: TrainingAdjustment | null;
  lastSets: Array<Pick<WorkoutSet, "actual_reps" | "actual_weight_kg" | "is_completed">>;
  routineIds: string[];
};

export type ExerciseDirectoryFilters = {
  query: string;
  muscleGroup: MuscleGroup | "all";
  routineId: string | "all";
};

export function filterExerciseDirectory(
  items: readonly ExerciseDirectoryEntry[],
  filters: ExerciseDirectoryFilters,
): ExerciseDirectoryEntry[] {
  const query = normalizeExerciseSearch(filters.query);
  return items.filter(
    (item) =>
      (filters.muscleGroup === "all" || item.muscleGroup === filters.muscleGroup) &&
      (filters.routineId === "all" || item.routineIds.includes(filters.routineId)) &&
      normalizeExerciseSearch([item.name, item.muscleGroup, item.muscleLabel].filter(Boolean).join(" ")).includes(query),
  );
}

export function sortExerciseDirectory(
  items: readonly ExerciseDirectoryEntry[],
  order: "recent" | "alpha",
): ExerciseDirectoryEntry[] {
  return [...items].sort((left, right) => {
    if (order === "recent") {
      const byDate = (right.lastDate ?? "").localeCompare(left.lastDate ?? "");
      if (byDate !== 0) return byDate;
    }
    return left.name.localeCompare(right.name, "es-AR");
  });
}

export type ExerciseReportSet = Pick<
  WorkoutSet,
  | "id"
  | "set_number"
  | "target_reps"
  | "target_weight_kg"
  | "target_rir"
  | "actual_reps"
  | "actual_weight_kg"
  | "is_completed"
>;

export type ExerciseReportSession = {
  sessionId: string;
  logDate: string;
  routineId: string | null;
  routineName: string;
  decision: TrainingAdjustment;
  sets: ExerciseReportSet[];
};

export type ExerciseReportPoint = {
  sessionId: string;
  logDate: string;
  bestWeightKg: number | null;
  bestReps: number | null;
  volumeKg: number;
};

function finiteNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function completedExerciseSets(sets: readonly ExerciseReportSet[]): ExerciseReportSet[] {
  return sets.filter((set) => set.is_completed);
}

export function bestWeightForSession(sets: readonly ExerciseReportSet[]): number | null {
  const weights = completedExerciseSets(sets)
    .map((set) => finiteNumber(set.actual_weight_kg))
    .filter((weight): weight is number => weight !== null);
  return weights.length ? Math.max(...weights) : null;
}

export function bestRepsForSession(sets: readonly ExerciseReportSet[]): number | null {
  const reps = completedExerciseSets(sets)
    .map((set) => finiteNumber(set.actual_reps))
    .filter((value): value is number => value !== null);
  return reps.length ? Math.max(...reps) : null;
}

export function exerciseSessionVolume(sets: readonly ExerciseReportSet[]): number {
  return completedExerciseSets(sets).reduce(
    (total, set) => total + (finiteNumber(set.actual_reps) ?? 0) * (finiteNumber(set.actual_weight_kg) ?? 0),
    0,
  );
}

export function summarizeLatestExercisePerformance(
  sets: ReadonlyArray<Pick<WorkoutSet, "actual_reps" | "actual_weight_kg" | "is_completed">>,
) {
  const completed = sets.filter((set) => set.is_completed);
  const maxWeightKg = completed
    .map((set) => finiteNumber(set.actual_weight_kg))
    .filter((weight): weight is number => weight !== null)
    .reduce<number | null>((best, weight) => best === null || weight > best ? weight : best, null);
  const onlySet = completed.length === 1 ? completed[0] : null;
  return {
    completedSets: completed.length,
    maxWeightKg,
    singleSet: onlySet ? {
      reps: finiteNumber(onlySet.actual_reps),
      weightKg: finiteNumber(onlySet.actual_weight_kg),
    } : null,
  };
}

export function buildExerciseReportPoints(
  sessions: readonly ExerciseReportSession[],
): ExerciseReportPoint[] {
  return [...sessions]
    .sort((left, right) => left.logDate.localeCompare(right.logDate))
    .map((session) => ({
      sessionId: session.sessionId,
      logDate: session.logDate,
      bestWeightKg: bestWeightForSession(session.sets),
      bestReps: bestRepsForSession(session.sets),
      volumeKg: exerciseSessionVolume(session.sets),
    }));
}

export function summarizeExerciseReport(sessions: readonly ExerciseReportSession[]) {
  const points = buildExerciseReportPoints(sessions);
  const allSets = sessions.flatMap((session) => session.sets);
  const latest = [...sessions].sort((left, right) => right.logDate.localeCompare(left.logDate))[0];
  return {
    sessions: sessions.length,
    bestWeightKg: bestWeightForSession(allSets),
    latestBestWeightKg: latest ? bestWeightForSession(latest.sets) : null,
    totalVolumeKg: exerciseSessionVolume(allSets),
    latestDecision: latest?.decision ?? null,
    points,
  };
}
