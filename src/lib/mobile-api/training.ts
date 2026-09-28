import type { ExerciseMutationInput } from "../phase2/exercise-mutation";
import { normalizeExerciseMutation } from "../phase2/exercise-mutation";
import type { ExerciseRoutineMembership } from "../phase2/exercise-insights";
import { isRoutineColorKey } from "../phase2/routine-colors";
import type { RoutineOverview } from "../phase2/routine-overview";
import type { Exercise, Routine } from "../phase2/types";
import { toWorkoutStartActiveSession } from "../phase2/workout-start";
import type { ReadResult } from "../resilient-read";
import { MobileApiValidationError } from "./auth";
import type {
  MobileReadResult,
  MobileRoutineColorKey,
  MobileTrainingExerciseDto,
  MobileTrainingExerciseMutationDto,
  MobileTrainingExercisesResponse,
  MobileTrainingExerciseStatusPayload,
  MobileTrainingResponse,
  MobileTrainingRoutineCreatePayload,
  MobileTrainingRoutinesResponse,
  MobileTrainingRoutineStatusPayload,
} from "./contracts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;

type ActiveSessionSource = Parameters<typeof toWorkoutStartActiveSession>[0];

export type MobileTrainingLandingSources = {
  activeSession: ReadResult<ActiveSessionSource | null>;
  calendar: ReadResult<Map<string, MobileRoutineColorKey[]>>;
};

export type MobileTrainingRoutineSources = {
  routines: ReadResult<Routine[]>;
  overviews: ReadResult<Map<string, RoutineOverview>>;
  initialPlan: ReadResult<{ imported: boolean; routinesFound: number }>;
};

export type MobileTrainingExerciseSources = {
  exercises: ReadResult<Exercise[]>;
  routines: ReadResult<Routine[]>;
  memberships: ReadResult<Map<string, ExerciseRoutineMembership[]>>;
};

export type ParsedMobileTrainingExerciseMutation = {
  exercise: ExerciseMutationInput;
  publicExercise: MobileTrainingExerciseMutationDto;
};

export type ParsedMobileTrainingExercisePatch =
  | {
      operation: "update";
      exercise: ExerciseMutationInput;
      publicExercise: MobileTrainingExerciseMutationDto;
      routineIds: string[];
    }
  | MobileTrainingExerciseStatusPayload;

export type ParsedMobileTrainingExerciseCreate =
  ParsedMobileTrainingExerciseMutation & {
    routineIds: [] | [string];
    idempotencyKey: string;
  };

function mapReadResult<T, U>(
  result: ReadResult<T>,
  transform: (data: T) => U,
): MobileReadResult<U> {
  return result.status === "ok"
    ? { status: "ok", data: transform(result.data) }
    : { status: "unavailable" };
}

function objectValue(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new MobileApiValidationError(`${label} no es válido.`);
  }
  return value as Record<string, unknown>;
}

function strictObject(
  value: unknown,
  label: string,
  allowedKeys: readonly string[],
): Record<string, unknown> {
  const input = objectValue(value, label);
  const allowed = new Set(allowedKeys);
  if (Object.keys(input).some((key) => !allowed.has(key))) {
    throw new MobileApiValidationError(`${label} contiene propiedades no permitidas.`);
  }
  return input;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new MobileApiValidationError(`${label} es obligatorio.`);
  }
  return value.trim();
}

export function parseMobileTrainingMonth(value: unknown): `${number}-${number}` {
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new MobileApiValidationError("El mes debe tener formato YYYY-MM.");
  }
  return value as `${number}-${number}`;
}

export function parseMobileTrainingId(value: unknown, label: string): string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new MobileApiValidationError(`${label} no es válido.`);
  }
  return value;
}

export function parseMobileIdempotencyKey(value: unknown): string {
  const key = requiredText(value, "La operación");
  if (key.length > 128 || !IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new MobileApiValidationError("La operación no es válida.");
  }
  return key;
}

function parseRoutineIds(value: unknown, maximum: number): string[] {
  if (!Array.isArray(value)) {
    throw new MobileApiValidationError("Las rutinas seleccionadas no son válidas.");
  }
  const ids = [...new Set(value.map((id) => parseMobileTrainingId(id, "La rutina")))].sort();
  if (ids.length > maximum) {
    throw new MobileApiValidationError(
      maximum === 1
        ? "Al crear un ejercicio podés elegir una sola rutina."
        : "Seleccionaste demasiadas rutinas.",
    );
  }
  return ids;
}

function publicExerciseMutation(
  exercise: ExerciseMutationInput,
): MobileTrainingExerciseMutationDto {
  return {
    name: exercise.nombre,
    muscleGroup: exercise.grupo_muscular,
    muscleGroupLabel: exercise.muscle_group_label,
    implement: exercise.implement,
    weightMode: exercise.weight_mode,
    suggestedSets: exercise.series_sugeridas,
    suggestedReps: exercise.reps_sugeridas,
    suggestedWeight: exercise.peso_sugerido,
    suggestedRir: exercise.rir_sugerido,
    suggestedRestMinSeconds: exercise.descanso_min_sugerido_segundos,
    suggestedRestMaxSeconds: exercise.descanso_max_sugerido_segundos,
    notes: exercise.notes,
  };
}

export function parseMobileTrainingExerciseMutation(
  value: unknown,
): ParsedMobileTrainingExerciseMutation {
  const input = strictObject(value, "El ejercicio", [
    "name",
    "muscleGroup",
    "muscleGroupLabel",
    "implement",
    "weightMode",
    "suggestedSets",
    "suggestedReps",
    "suggestedWeight",
    "suggestedRir",
    "suggestedRestMinSeconds",
    "suggestedRestMaxSeconds",
    "notes",
  ]);
  try {
    const exercise = normalizeExerciseMutation({
      nombre: input.name,
      grupo_muscular: input.muscleGroup,
      muscle_group_label: input.muscleGroupLabel,
      implement: input.implement,
      weight_mode: input.weightMode,
      series_sugeridas: input.suggestedSets,
      reps_sugeridas: input.suggestedReps,
      peso_sugerido: input.suggestedWeight,
      rir_sugerido: input.suggestedRir,
      descanso_min_sugerido_segundos: input.suggestedRestMinSeconds,
      descanso_max_sugerido_segundos: input.suggestedRestMaxSeconds,
      notes: input.notes,
    });
    const hasRestMin = exercise.descanso_min_sugerido_segundos !== null;
    const hasRestMax = exercise.descanso_max_sugerido_segundos !== null;
    if (hasRestMin !== hasRestMax) {
      throw new Error("Completá ambos descansos sugeridos o dejá ambos vacíos.");
    }
    return { exercise, publicExercise: publicExerciseMutation(exercise) };
  } catch (error) {
    throw new MobileApiValidationError(
      error instanceof Error ? error.message : "El ejercicio no es válido.",
    );
  }
}

export function parseMobileTrainingRoutineCreate(
  value: unknown,
): MobileTrainingRoutineCreatePayload {
  const input = strictObject(value, "La rutina", [
    "name",
    "color",
    "idempotencyKey",
  ]);
  const color = input.color;
  if (color !== null && !isRoutineColorKey(color)) {
    throw new MobileApiValidationError("Elegí un color de rutina válido.");
  }
  return {
    name: requiredText(input.name, "El nombre"),
    color,
    idempotencyKey: parseMobileIdempotencyKey(input.idempotencyKey),
  };
}

export function parseMobileTrainingRoutineStatus(
  value: unknown,
): MobileTrainingRoutineStatusPayload {
  const input = strictObject(value, "La rutina", ["isActive"]);
  if (typeof input.isActive !== "boolean") {
    throw new MobileApiValidationError("El estado de la rutina no es válido.");
  }
  return { isActive: input.isActive };
}

export function parseMobileTrainingExerciseCreate(
  value: unknown,
): ParsedMobileTrainingExerciseCreate {
  const input = strictObject(value, "El ejercicio", [
    "exercise",
    "routineIds",
    "idempotencyKey",
  ]);
  const parsed = parseMobileTrainingExerciseMutation(input.exercise);
  const routineIds = parseRoutineIds(input.routineIds, 1) as [] | [string];
  return {
    ...parsed,
    routineIds,
    idempotencyKey: parseMobileIdempotencyKey(input.idempotencyKey),
  };
}

export function parseMobileTrainingExercisePatch(
  value: unknown,
): ParsedMobileTrainingExercisePatch {
  const input = objectValue(value, "La operación");
  if (input.operation === "set_status") {
    strictObject(value, "La operación", ["operation", "isActive"]);
    if (typeof input.isActive !== "boolean") {
      throw new MobileApiValidationError("El estado del ejercicio no es válido.");
    }
    return { operation: "set_status", isActive: input.isActive };
  }
  if (input.operation === "update") {
    strictObject(value, "La operación", ["operation", "exercise", "routineIds"]);
    const parsed = parseMobileTrainingExerciseMutation(input.exercise);
    return {
      operation: "update",
      ...parsed,
      routineIds: parseRoutineIds(input.routineIds, 100),
    } satisfies ParsedMobileTrainingExercisePatch;
  }
  throw new MobileApiValidationError("La operación no es válida.");
}

export function parseMobileTrainingInitialPlan(value: unknown): void {
  strictObject(value, "La importación", []);
}

export function buildMobileTrainingResponse(
  month: string,
  sources: MobileTrainingLandingSources,
): MobileTrainingResponse {
  return {
    activeSession: mapReadResult(sources.activeSession, (active) =>
      active ? toWorkoutStartActiveSession(active) : null,
    ),
    calendar: mapReadResult(sources.calendar, (calendar) => ({
      month,
      days: [...calendar]
        .map(([date, colors]) => ({ date, colors }))
        .sort((left, right) => left.date.localeCompare(right.date)),
    })),
  };
}

export function buildMobileTrainingRoutinesResponse(
  sources: MobileTrainingRoutineSources,
): MobileTrainingRoutinesResponse {
  let routines: MobileTrainingRoutinesResponse["routines"] = {
    status: "unavailable",
  };
  if (sources.routines.status === "ok" && sources.overviews.status === "ok") {
    const overviews = sources.overviews.data;
    if (sources.routines.data.every((routine) => overviews.has(routine.id))) {
      routines = {
        status: "ok",
        data: sources.routines.data.map((routine) => {
          const overview = overviews.get(routine.id)!;
          return {
            id: routine.id,
            name: routine.nombre,
            color: routine.color,
            order: routine.routine_order,
            isActive: routine.is_active,
            exerciseCount: overview.exerciseCount,
            setCount: overview.setCount,
          };
        }),
      };
    }
  }

  return {
    routines,
    initialPlan: mapReadResult(sources.initialPlan, (status) => status),
  };
}

export function mobileTrainingExerciseDto(
  exercise: Exercise,
  routineIds: string[],
): MobileTrainingExerciseDto {
  return {
    id: exercise.id,
    name: exercise.nombre,
    muscleGroup: exercise.grupo_muscular,
    muscleGroupLabel: exercise.muscle_group_label,
    implement: exercise.implement,
    weightMode: exercise.weight_mode,
    suggestedSets: exercise.series_sugeridas,
    suggestedReps: exercise.reps_sugeridas,
    suggestedWeight: exercise.peso_sugerido,
    suggestedRir: exercise.rir_sugerido,
    suggestedRestMinSeconds: exercise.descanso_min_sugerido_segundos,
    suggestedRestMaxSeconds: exercise.descanso_max_sugerido_segundos,
    notes: exercise.notes,
    isActive: exercise.is_active,
    routineIds: [...new Set(routineIds)].sort(),
    updatedAt: exercise.updated_at,
  };
}

export function buildMobileTrainingExercisesResponse(
  sources: MobileTrainingExerciseSources,
): MobileTrainingExercisesResponse {
  if (
    sources.exercises.status === "unavailable" ||
    sources.routines.status === "unavailable" ||
    sources.memberships.status === "unavailable"
  ) {
    return { catalog: { status: "unavailable" } };
  }

  return {
    catalog: {
      status: "ok",
      data: {
        exercises: sources.exercises.data.map((exercise) =>
          mobileTrainingExerciseDto(
            exercise,
            (sources.memberships.status === "ok"
              ? sources.memberships.data.get(exercise.id)
              : undefined
            )?.map((membership) => membership.id) ?? [],
          ),
        ),
        routines: sources.routines.data.map((routine) => ({
          id: routine.id,
          name: routine.nombre,
          color: routine.color,
        })),
      },
    },
  };
}
