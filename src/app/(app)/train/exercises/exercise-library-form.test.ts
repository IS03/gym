import { describe, expect, it } from "vitest";
import {
  formFromExercise,
  mutationFromForm,
} from "../../../../lib/phase2/exercise-form";
import { normalizeExerciseMutation } from "../../../../lib/phase2/exercise-mutation";

describe("exercise library form", () => {
  it("hidrata los descansos generales del ejercicio en segundos al editar", () => {
    const form = formFromExercise({
      id: "exercise-1",
      nombre: "CURL POLEA BARRA",
      grupo_muscular: "bíceps",
      muscle_group_label: "Bíceps/braquial",
      implement: "Polea con barra",
      weight_mode: "Peso total",
      series_sugeridas: 3,
      reps_sugeridas: 12,
      peso_sugerido: 20,
      rir_sugerido: 2,
      descanso_min_sugerido_segundos: 90,
      descanso_max_sugerido_segundos: 90,
      updated_at: "2026-08-26T00:00:00.000Z",
    });

    expect(form.descanso_min_sugerido_segundos).toBe("90");
    expect(form.descanso_max_sugerido_segundos).toBe("90");
    expect(form.implement).toBe("Polea con barra");
    expect(form.weight_mode).toBe("Peso total");
  });

  it("convierte detalles vacíos a null antes del mutation", () => {
    const input = normalizeExerciseMutation(mutationFromForm({
      nombre: "Remo polea",
      grupo_muscular: "espalda",
      muscle_group_label: "",
      implement: " ",
      weight_mode: "",
      series_sugeridas: "",
      reps_sugeridas: "",
      peso_sugerido: "",
      rir_sugerido: "",
      descanso_min_sugerido_segundos: "90",
      descanso_max_sugerido_segundos: "120",
    }));

    expect(input).toMatchObject({
      muscle_group_label: null,
      implement: null,
      weight_mode: null,
      descanso_min_sugerido_segundos: 90,
      descanso_max_sugerido_segundos: 120,
    });
  });
});
