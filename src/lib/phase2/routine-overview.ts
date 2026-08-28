export type RoutineOverview = {
  exerciseCount: number;
  setCount: number;
  exerciseNames: string[];
  muscleGroups: string[];
};

export type RoutineOverviewSourceRow = {
  routine_id: string;
  exercise:
    | { nombre: string; grupo_muscular: string | null; muscle_group_label: string | null }
    | Array<{ nombre: string; grupo_muscular: string | null; muscle_group_label: string | null }>
    | null;
  sets: Array<{ id: string }> | { id: string } | null;
};

function firstRelation<T>(value: T | T[] | null): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function buildRoutineOverviews(
  routineIds: string[],
  rows: RoutineOverviewSourceRow[],
): Map<string, RoutineOverview> {
  const overviews = new Map<string, RoutineOverview>(
    routineIds.map((id) => [
      id,
      { exerciseCount: 0, setCount: 0, exerciseNames: [], muscleGroups: [] },
    ]),
  );
  const musclesByRoutine = new Map<string, Set<string>>();

  for (const row of rows) {
    const overview = overviews.get(row.routine_id);
    if (!overview) continue;
    const exercise = firstRelation(row.exercise);
    overview.exerciseCount += 1;
    overview.setCount += Array.isArray(row.sets) ? row.sets.length : row.sets ? 1 : 0;
    if (exercise?.nombre) overview.exerciseNames.push(exercise.nombre);
    const rawGroup = exercise?.muscle_group_label?.trim() || exercise?.grupo_muscular;
    if (!rawGroup) continue;
    const group = `${rawGroup.slice(0, 1).toLocaleUpperCase("es-AR")}${rawGroup.slice(1)}`;
    const groups = musclesByRoutine.get(row.routine_id) ?? new Set<string>();
    groups.add(group);
    musclesByRoutine.set(row.routine_id, groups);
  }

  for (const [routineId, groups] of musclesByRoutine) {
    const overview = overviews.get(routineId);
    if (overview) overview.muscleGroups = [...groups];
  }
  return overviews;
}
