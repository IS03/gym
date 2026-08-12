import type { WorkoutSession } from "./types";

type ErrorLike = {
  code?: string;
  message?: string;
};

function errorLike(value: unknown): ErrorLike {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

/**
 * `.maybeSingle()` expresa correctamente cero filas: no existe o no pertenece
 * al usuario actual. Otros errores de PostgREST siguen siendo errores reales.
 */
export function resolveWorkoutSessionLookup(
  session: WorkoutSession | null,
  error: unknown,
): WorkoutSession | null {
  if (error) {
    const { message } = errorLike(error);
    throw new Error(`Leer sesión: ${message ?? "error inesperado."}`);
  }
  return session;
}
