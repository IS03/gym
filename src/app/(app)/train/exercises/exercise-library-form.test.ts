import { describe, expect, it } from "vitest";
import {
  emptyForm,
  formFromExercise,
  mutationFromForm,
} from "../../../../lib/phase2/exercise-form";
import { normalizeExerciseMutation } from "../../../../lib/phase2/exercise-mutation";

describe("exercise library form", () => {
  it("hidrata los descansos generales del ejercicio como mm:ss al editar", () => {
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
      notes: "Controlar técnica",
      is_active: true,
      updated_at: "2026-08-26T00:00:00.000Z",
      memberships: [],
    });

    expect(form.descanso_min_sugerido_segundos).toBe("1:30");
    expect(form.descanso_max_sugerido_segundos).toBe("1:30");
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
      descanso_min_sugerido_segundos: "1:30",
      descanso_max_sugerido_segundos: "2:00",
      notes: "",
    }));

    expect(input).toMatchObject({
      muscle_group_label: null,
      implement: null,
      weight_mode: null,
      descanso_min_sugerido_segundos: 90,
      descanso_max_sugerido_segundos: 120,
    });
  });

  it("mantiene defaults opcionales y acepta un solo descanso", () => {
    const input = normalizeExerciseMutation(mutationFromForm({
      ...emptyForm(),
      nombre: "Movilidad",
      descanso_min_sugerido_segundos: "1:30",
    }));
    expect(input).toMatchObject({
      series_sugeridas: null,
      reps_sugeridas: null,
      peso_sugerido: null,
      rir_sugerido: null,
      descanso_min_sugerido_segundos: 90,
      descanso_max_sugerido_segundos: null,
    });
  });

  it("valida el rango de descanso en formato humano", () => {
    expect(() => normalizeExerciseMutation(mutationFromForm({
      ...emptyForm(),
      nombre: "Press",
      descanso_min_sugerido_segundos: "2:00",
      descanso_max_sugerido_segundos: "1:30",
    }))).toThrow("no puede superar");
    expect(() => mutationFromForm({ ...emptyForm(), nombre: "Press", descanso_min_sugerido_segundos: "1:75" })).toThrow("entre 0:00 y 60:00");
  });
});
