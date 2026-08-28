import type { Routine } from "./types";

export function partitionRoutines(routines: Routine[]): {
  active: Routine[];
  archived: Routine[];
} {
  return routines.reduce<{ active: Routine[]; archived: Routine[] }>(
    (result, routine) => {
      if (routine.is_active) result.active.push(routine);
      else result.archived.push(routine);
      return result;
    },
    { active: [], archived: [] },
  );
}
