import { describe, expect, it } from "vitest";
import { resolveWorkoutSessionLookup } from "./training-session-lookup";
import type { WorkoutSession } from "./types";

const session = { id: "session-1" } as WorkoutSession;

describe("lectura de sesión de entrenamiento", () => {
  it("mantiene una sesión existente", () => {
    expect(resolveWorkoutSessionLookup(session, null)).toBe(session);
  });

  it("representa como no encontrada una sesión inexistente o no visible por ownership", () => {
    // La query ya está acotada por id + user_id; en ambos casos PostgREST entrega
    // cero filas y el frontend no debe distinguirlos.
    expect(resolveWorkoutSessionLookup(null, null)).toBeNull();
  });

  it("no convierte una falla real de PostgREST en 404", () => {
    expect(() =>
      resolveWorkoutSessionLookup(null, { message: "connection unavailable" }),
    ).toThrow("Leer sesión: connection unavailable");
  });
});
