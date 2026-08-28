import { describe, expect, it } from "vitest";
import {
  parseSessionMetadataDraft,
  parseWorkoutExerciseDraft,
  TRAINING_DRAFT_VERSION,
} from "./training-drafts";

describe("borradores locales versionados", () => {
  it("recupera un borrador válido del ejercicio correcto", () => {
    const raw = JSON.stringify({
      version: TRAINING_DRAFT_VERSION,
      sessionExerciseId: "exercise-1",
      serverUpdatedAt: "2026-08-10T10:00:00.000Z",
      savedAt: "2026-08-10T10:01:00.000Z",
      payload: {
        is_completed: true,
        decision: "maintain",
        decision_note: "",
        apply_to_routine: false,
        notes: "",
        sets: [
          {
            set_number: 1,
            target_reps: 10,
            target_weight_kg: 20,
            target_rir: 1,
            actual_reps: 10,
            actual_weight_kg: 20,
            is_completed: true,
            notes: null,
          },
        ],
      },
    });
    expect(parseWorkoutExerciseDraft(raw, "exercise-1")?.payload.is_completed).toBe(
      true,
    );
  });

  it("ignora versiones, IDs o series inválidas", () => {
    expect(parseWorkoutExerciseDraft("{}", "exercise-1")).toBeNull();
    expect(
      parseWorkoutExerciseDraft(
        JSON.stringify({
          version: TRAINING_DRAFT_VERSION,
          sessionExerciseId: "otro",
          serverUpdatedAt: "x",
          savedAt: "x",
          payload: {},
        }),
        "exercise-1",
      ),
    ).toBeNull();
  });

  it("restaura un borrador anterior con custom por compatibilidad", () => {
    const raw = JSON.stringify({
      version: TRAINING_DRAFT_VERSION,
      sessionExerciseId: "exercise-custom",
      serverUpdatedAt: "2026-08-10T10:00:00.000Z",
      savedAt: "2026-08-10T10:01:00.000Z",
      payload: {
        is_completed: false,
        decision: "custom",
        decision_note: "Pausa más larga antes de la última serie",
        apply_to_routine: false,
        notes: "",
        sets: [
          {
            set_number: 1,
            target_reps: 10,
            target_weight_kg: 20,
            target_rir: 1,
            actual_reps: 10,
            actual_weight_kg: 20,
            is_completed: false,
            notes: null,
          },
        ],
      },
    });

    expect(parseWorkoutExerciseDraft(raw, "exercise-custom")?.payload).toMatchObject({
      decision: "custom",
      decision_note: "Pausa más larga antes de la última serie",
    });
  });

  it("conserva los campos válidos de metadata y descarta abs_completed legado", () => {
    const draft = parseSessionMetadataDraft(
      JSON.stringify({
        version: TRAINING_DRAFT_VERSION,
        sessionId: "session-1",
        savedAt: "2026-08-10T10:01:00.000Z",
        metadata: {
          session_name: "CINTA",
          energy_level: 4,
          performance_level: 5,
          pain_level: 0,
          pain_note: "",
          abs_completed: true,
          treadmill_minutes: 15,
          treadmill_distance_km: 1.2,
          treadmill_speed_kmh: 5,
          treadmill_incline_percent: 8,
          notes: "Bien",
        },
      }),
      "session-1",
    );

    expect(draft?.metadata).toEqual({
      session_name: "CINTA",
      energy_level: 4,
      performance_level: 5,
      pain_level: 0,
      pain_note: "",
      treadmill_minutes: 15,
      treadmill_distance_km: 1.2,
      treadmill_speed_kmh: 5,
      treadmill_incline_percent: 8,
      notes: "Bien",
    });
  });
});
