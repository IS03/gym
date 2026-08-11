import type { WorkoutSession } from "./types";

export type WorkoutStartRoutine = {
  id: string;
  name: string;
  color: string | null;
  exerciseCount: number;
  setCount: number;
};

export type WorkoutStartSelection =
  | { kind: "routine"; routineId: string }
  | { kind: "free" };

export type WorkoutStartActiveSession = {
  id: string;
  name: string;
  logDate: string;
};

export type StartWorkoutActionResult =
  | { status: "started"; sessionId: string }
  | { status: "active"; session: WorkoutStartActiveSession }
  | { status: "error"; message: string };

export function getInitialWorkoutSelection(
  routines: WorkoutStartRoutine[],
  initialRoutineId?: string,
): WorkoutStartSelection | null {
  if (!initialRoutineId) return null;
  return routines.some((routine) => routine.id === initialRoutineId)
    ? { kind: "routine", routineId: initialRoutineId }
    : null;
}

export function getWorkoutStartCtaLabel(
  selection: WorkoutStartSelection | null,
  routines: WorkoutStartRoutine[],
): string {
  if (!selection) return "Elegí una opción";
  if (selection.kind === "free") return "Empezar sesión libre";
  const routine = routines.find((item) => item.id === selection.routineId);
  return routine ? `Empezar ${routine.name}` : "Elegí una opción";
}

function countLabel(value: number, singular: string, plural: string) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export function getRoutineStartMeta(routine: WorkoutStartRoutine): string {
  return `${countLabel(routine.exerciseCount, "ejercicio", "ejercicios")} · ${countLabel(routine.setCount, "serie", "series")}`;
}

export function toWorkoutStartActiveSession(input: {
  session: Pick<
    WorkoutSession,
    "id" | "session_name" | "routine_name_snapshot"
  >;
  log_date: string;
}): WorkoutStartActiveSession {
  return {
    id: input.session.id,
    name:
      input.session.session_name?.trim() ||
      input.session.routine_name_snapshot?.trim() ||
      "Sesión libre",
    logDate: input.log_date,
  };
}
