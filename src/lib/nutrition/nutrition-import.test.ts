import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertPrivateOutputPath } from "../../../scripts/nutrition-import/cli.ts";
import {
  historicalConsumedAt,
  normalizeWorkbook,
  optionalYesNoForTests,
  parseArgentineNumber,
  parseServing,
} from "../../../scripts/nutrition-import/normalize.ts";
import {
  buildDryRunPlan,
  mealFingerprint,
  nutritionEventFingerprint,
} from "../../../scripts/nutrition-import/plan.ts";
import { sourceSha256 } from "../../../scripts/nutrition-import/source.ts";
import type { CellValue, ProductionSnapshot, WorkbookSnapshot } from "../../../scripts/nutrition-import/types.ts";

const BLANK_SHEETS = [
  "Dashboard", "Resumen semanal", "Rules", "Análisis semanal",
] as const;

function workbook(): WorkbookSnapshot {
  const sheets: Record<string, CellValue[][]> = Object.fromEntries(BLANK_SHEETS.map((name) => [name, []]));
  sheets["Registro de comidas"] = [
    ["ID", "Fecha", "Hora", "Momento", "Tipo", "Contexto", "Detalle", "Calorías", "Proteína (g)", "Carbos (g)", "Grasas (g)", "Precisión", "Activo", "Nota / fuente"],
    ["SYN-LEG-1", "1/7/2026", null, "Total diario", "Resumen heredado", null, "Total sintético", 1800, 100, null, null, "Histórica", "Sí", "fixture sintético"],
    ["SYN-MEAL-1", "2/7/2026", null, "Almuerzo", "Comida", "Casa", "Comida sintética A", 600, "30,5", 70, 15, "Alta", "Sí", "estimado sintético"],
    ["SYN-MEAL-2", "2/7/2026", "20:15", "Cena", "Comida", "Casa", "Comida sintética B", 1200, 69.5, 100, 35, "Alta", "Sí", "según etiqueta"],
    ["SYN-INACTIVE", "2/7/2026", null, "Extra", "Corrección", null, "Anulada", 99, 0, 0, 0, "Baja", "No", "corrección sintética"],
  ];
  sheets["Actividad diaria"] = [
    ["Fecha", "Estado", "Trabajo", "Gym", "Pasos", "Peso AM (kg)", "Agua pura (L)", "Mate (L)", "Gasto override", "Notas", "Día", "Semana", "Meta kcal", "Meta proteína", "Gasto regla", "Gasto usado", "Meta agua"],
    ["1/7/2026", "Cerrado", "Sí", "No", 5000, "70,0", "2,0", "0,5", null, "día sintético", null, null, 1800, 130, 2100, 2100, 2],
    ["2/7/2026", "Cerrado", "No", "Sí", 6000, null, 2.5, 0, 2300, null, null, null, 1800, 130, 2200, 2300, 2.5],
  ];
  sheets["Resumen diario"] = [
    ["Fecha", "Día", "Semana", "Estado", "Calorías", "Meta kcal", "Desvío meta", "Proteína", "Meta proteína", "Cumplimiento proteína", "Carbos", "Grasas", "Agua pura", "Meta agua", "Mate", "Trabajo", "Gym", "Pasos", "Peso AM", "Gasto", "Balance", "Permitidos", "Intensidad", "Calidad datos", "Notas", "Tipo de día"],
    ["1/7/2026", null, null, "Cerrado", 1800, 1800, 0, 100, 130, null, null, null, 2, 2, 0.5, "Sí", "No", 5000, 70, 2100, -300],
    ["2/7/2026", null, null, "Cerrado", 1800, 1800, 0, 100, 130, null, 170, 50, 2.5, 2.5, 0, "No", "Sí", 6000, null, 2300, -500],
  ];
  sheets["Metas y configuración"] = [
    ["Trabajo", "Gym", "Gasto estimado"],
    ["Sí", "Sí", 2350], ["Sí", "No", 2100], ["No", "Sí", 2200], ["No", "No", 1950],
    ["Vigente desde", "Plan", "kcal sin gym", "kcal con gym", "Proteína", "Agua sin gym", "Agua con gym"],
    ["1/7/2026", "Plan sintético A", 1800, 1800, 130, 2, 2.5],
    ["30/7/2026", "Plan sintético B", 1900, 2100, 135, 2, 2.5],
  ];
  sheets["Alimentos habituales"] = [
    ["Alimento / preparación", "Porción", "Calorías", "Proteína (g)", "Carbos (g)", "Grasas (g)", "Fuente / precisión", "Activo"],
    ["Alimento sintético por peso", "100 g", 100, 10, 20, 3, "Etiqueta sintética", "Sí"],
    ["Alimento sintético unitario", "1 unidad", 80, 5, 8, 2, "Estimado sintético", "No"],
  ];
  sheets["Medidas y progreso"] = [["Fecha", "Hora", "Condición", "Peso (kg)", "Cintura (cm)", "Abdomen (cm)", "Cadera (cm)", "Pecho (cm)", "Brazo der. relajado", "Brazo izq. relajado", "Muslo der.", "Muslo izq.", "Pantorrilla der.", "Pantorrilla izq.", "Foto frente", "Foto perfil", "Foto espalda", "Notas"]];
  sheets.Permitidos = [["ID", "Fecha", "Tipo", "Intensidad", "Planificado", "Alcohol", "Tragos eq.", "kcal evento", "Contexto", "Notas", "Origen"]];
  return {
    spreadsheetId: "synthetic-spreadsheet-id",
    sourceName: "Synthetic nutrition fixture",
    locale: "es_AR",
    timezone: "America/Cordoba",
    sheets,
  };
}

function production(): ProductionSnapshot {
  return {
    profile: { current_weight_kg: 70, bmr_kcal_current: 1700 },
    day_logs: [{
      log_date: "2026-07-01", weight_kg: 70, work_override: null, gym_override: null,
      steps: null, water_l: null, mate_l: null, expenditure_override_kcal: null,
      work_effective_snapshot: null, gym_effective_snapshot: null,
      nutrition_target_kcal_snapshot: null, protein_target_g_snapshot: null,
      water_target_l_snapshot: null, estimated_expenditure_kcal_snapshot: null,
      total_calories_consumed: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0,
      notes_present: false,
    }],
    workout_by_date: [], body_measurements: [], meal_entries_count: 0, legacy_keys: [],
    config_counts: {}, regression_counts: {},
  };
}

describe("nutrition import normalization", () => {
  it("normaliza fechas argentinas, coma decimal, null/0, hora desconocida, labels y precisión", () => {
    const normalized = normalizeWorkbook(workbook());
    expect(parseArgentineNumber("1.234,50")).toBe(1234.5);
    expect(normalized.meals).toHaveLength(4);
    expect(normalized.meals[0]).toMatchObject({
      entryKind: "legacy_daily_summary", precisionLevel: "historical",
      finalCarbsG: null, originalTimeKnown: false,
      consumedAt: "2026-07-01T12:00:00-03:00",
    });
    expect(normalized.meals[1]).toMatchObject({ mealLabel: "lunch", precisionLevel: "estimated", finalProteinG: 30.5 });
    expect(normalized.meals[2]).toMatchObject({ mealLabel: "dinner", precisionLevel: "label", originalTimeKnown: true });
    expect(normalized.meals[3]).toMatchObject({ active: false, finalProteinG: 0, deletedAtPolicy: "import_applied_at" });
    expect(normalized.goalPeriods).toHaveLength(2);
    expect(normalized.expenditurePeriods[0]).toMatchObject({ workGymKcal: 2350, noWorkNoGymKcal: 1950 });
    expect(normalized.foods.map((food) => [food.servingQuantity, food.servingUnit])).toEqual([[100, "g"], [1, "unidad"]]);
  });

  it("genera hash canónico determinista y distingue un cambio relevante", () => {
    const first = workbook();
    const equivalent = structuredClone(first);
    equivalent.sheets.Dashboard.push(["metadata derivada que no se hashea"]);
    expect(sourceSha256(first)).toBe(sourceSha256(equivalent));
    equivalent.sheets["Registro de comidas"][1][7] = 1801;
    expect(sourceSha256(first)).not.toBe(sourceSha256(equivalent));
  });

  it("reconcilia totals, prepara merge sin reemplazar IDs y conserva overrides históricos", () => {
    const plan = buildDryRunPlan(normalizeWorkbook(workbook()), production());
    expect(plan.reconciliation).toMatchObject({ exactDays: 2, mismatchDays: 0 });
    expect(plan.dayLogs[0]).toMatchObject({ classification: "MERGE_SAFE", conflicts: [] });
    expect(plan.dayLogs[0].preservedExistingFields).toContain("weight_kg");
    expect(plan.dayLogs[1]).toMatchObject({ classification: "INSERT" });
    expect(plan.dayLogs[1].fieldsToSet).toMatchObject({
      work_override: false,
      gym_override: true,
      expenditure_override_kcal: 2300,
    });
    expect(plan.meals).toMatchObject({ detailed: 3, legacySummaries: 1, active: 3, inactive: 1, inserts: 4 });
    expect(plan.applyReady).toBe(true);
  });

  it("bloquea conflicto de gym, peso y contenido idempotente distinto", () => {
    const state = production();
    state.workout_by_date.push({ log_date: "2026-07-01", status: "completed", count: 1 });
    state.day_logs[0].weight_kg = 71;
    state.legacy_keys.push({
      legacy_import_source: "google-sheet:registro-comidas:v1",
      legacy_import_id: "SYN-LEG-1",
      deleted: false,
      fingerprint: "different",
    });
    const plan = buildDryRunPlan(normalizeWorkbook(workbook()), state);
    expect(plan.workoutConflicts).toHaveLength(1);
    expect(plan.weights.conflicts).toHaveLength(1);
    expect(plan.meals.conflicts).toHaveLength(1);
    expect(plan.dayLogs[0].classification).toBe("CONFLICT");
    expect(plan.applyReady).toBe(false);
  });

  it("clasifica como no-op sólo un legacy ID con fingerprint idéntico", () => {
    const normalized = normalizeWorkbook(workbook());
    const state = production();
    state.legacy_keys.push({
      legacy_import_source: normalized.meals[0].legacyImportSource,
      legacy_import_id: normalized.meals[0].legacyImportId,
      deleted: false,
      fingerprint: mealFingerprint(normalized.meals[0]),
    });
    const plan = buildDryRunPlan(normalized, state);
    expect(plan.meals).toMatchObject({ noOps: 1, inserts: 3, conflicts: [] });
  });

  it("preserva una medición sospechosa, omite peso sin fecha y mapea eventos sin pérdida", () => {
    const source = workbook();
    source.sheets["Medidas y progreso"].push(["3/7/2026", null, "AM", 65, 79, 80, 90, 95, 110, 30, null, 49, 15, 35, null, null, null, "revisar posible error"]);
    source.sheets["Medidas y progreso"].push([null, null, null, 64]);
    source.sheets["Alimentos habituales"].push(["Incompleto sintético", "1 paquete", 50, 1, null, null, "Histórico", "Sí"]);
    source.sheets.Permitidos.push(["SYN-EVENT-1", "2/7/2026", "Evento sintético", "Media", "No informado", "Sí", 3, null, "Casa", "nota sintética", "fixture"]);
    const plan = buildDryRunPlan(normalizeWorkbook(source), production());
    expect(plan.schemaGaps).toHaveLength(0);
    expect(plan.anomalies.map((item) => item.code)).toEqual(expect.arrayContaining([
      "UNDATED_BODY_FACT_SKIPPED", "SUSPECT_BODY_MEASUREMENT_PRESERVED",
    ]));
    expect(plan.bodyMeasurements).toMatchObject({ inserts: 1, skippedUndated: 1, conflicts: [] });
    expect(plan.bodyMeasurements.rows[0]).toMatchObject({
      abdomenCm: 80,
      armRightCm: 110,
      armLeftCm: 30,
      thighRightCm: null,
      thighLeftCm: 49,
      calfRightCm: 15,
      calfLeftCm: 35,
      condition: "AM",
      qualityStatus: "suspect",
      disposition: "IMPORT",
    });
    expect(plan.bodyMeasurements.rows[0]).not.toHaveProperty("armCm");
    expect(plan.importReport.skippedUndatedFacts[0]).toMatchObject({
      weightKg: 64,
      logDate: null,
      disposition: "SKIP_UNDATED",
    });
    expect(plan.nutritionEvents.rows[0]).toMatchObject({
      planned: null,
      alcohol: true,
      drinksEquivalent: 3,
      eventCalories: null,
    });
    expect(plan.applyReady).toBe(true);
  });

  it("acepta nutrición parcial y conserva cero distinto de null", () => {
    const source = workbook();
    source.sheets["Alimentos habituales"].push(
      ["Parcial carbos", "1 unidad", 20, 1, null, null, "Fixture", "Sí"],
      ["Parcial proteína", "1 unidad", 20, null, 4, null, "Fixture", "Sí"],
      ["Sin calorías", "1 unidad", null, 2, 0, null, "Fixture", "Sí"],
    );
    const normalized = normalizeWorkbook(source);
    expect(normalized.foods.at(-1)).toMatchObject({ calories: null, proteinG: 2, carbsG: 0, fatG: null, hasKnownNutrition: true });
    expect(buildDryRunPlan(normalized, production()).applyReady).toBe(true);

    source.sheets["Alimentos habituales"].push(["Todo desconocido", "1 unidad", null, null, null, null, "Fixture", "Sí"]);
    const rejected = buildDryRunPlan(normalizeWorkbook(source), production());
    expect(rejected.anomalies.map((item) => item.code)).toContain("FOOD_WITHOUT_NUTRITION");
    expect(rejected.applyReady).toBe(false);
  });

  it("mapea Sí, No y No informado sin colapsar null a false", () => {
    expect(optionalYesNoForTests("Sí")).toBe(true);
    expect(optionalYesNoForTests("No")).toBe(false);
    expect(optionalYesNoForTests("No informado")).toBeNull();
    expect(optionalYesNoForTests(null)).toBeNull();
  });

  it("aplica SOURCE_WINS sólo cuando la fuente primaria tiene un valor y el oráculo está vacío", () => {
    const sourceWinsSource = workbook();
    sourceWinsSource.sheets["Registro de comidas"][1][9] = 175;
    sourceWinsSource.sheets["Registro de comidas"][1][10] = 50;
    const sourceWins = buildDryRunPlan(normalizeWorkbook(sourceWinsSource), production());
    expect(sourceWins.reconciliation).toMatchObject({ sourceWinsDays: 1, mismatchDays: 0 });
    expect(sourceWins.reconciliation.warnings[0]).toMatchObject({ code: "SOURCE_WINS", fields: ["carbs_g", "fat_g"] });
    expect(sourceWins.applyReady).toBe(true);

    const conflictSource = workbook();
    conflictSource.sheets["Registro de comidas"][2][9] = 171;
    const conflict = buildDryRunPlan(normalizeWorkbook(conflictSource), production());
    expect(conflict.reconciliation.mismatchDays).toBe(1);
    expect(conflict.applyReady).toBe(false);
  });

  it("prepara nutrition_events idempotentes", () => {
    const source = workbook();
    source.sheets.Permitidos.push(["SYN-EVENT-1", "2/7/2026", "Evento sintético", "Media", "Sí", "No", 0, 100, "Casa", "nota sintética", "fixture"]);
    const normalized = normalizeWorkbook(source);
    const state = production();
    state.nutrition_event_keys = [{
      legacy_import_source: normalized.nutritionEvents[0].legacyImportSource,
      legacy_import_id: normalized.nutritionEvents[0].legacyImportId,
      fingerprint: nutritionEventFingerprint(normalized.nutritionEvents[0]),
    }];
    const plan = buildDryRunPlan(normalized, state);
    expect(plan.nutritionEvents).toMatchObject({ inserts: 0, noOps: 1, conflicts: [] });
  });

  it("versiona constraints, ownership, RLS y grants del schema de PR 5B", () => {
    const migration = readFileSync(
      "supabase/migrations/20260814010000_nutrition_import_blockers.sql",
      "utf8",
    );
    expect(migration).toContain("foods_nutrition_at_least_one_known");
    expect(migration).toContain("add column abdomen_cm");
    expect(migration).toContain("add column arm_right_cm");
    expect(migration).toContain("add column source_payload jsonb");
    expect(migration).toContain("body_measurements_legacy_import_unique");
    expect(migration).toContain("create table public.nutrition_events");
    expect(migration).toContain("nutrition_events_import_run_owner_fk");
    expect(migration).toContain("alter table public.nutrition_events enable row level security");
    expect(migration).toContain("revoke all on table public.nutrition_events from public, anon, authenticated");
  });

  it("valida convenciones auxiliares y evita reportes reales fuera de directorios ignorados", () => {
    expect(historicalConsumedAt("2026-07-01", null)).toMatchObject({ originalTimeKnown: false });
    expect(parseServing("1 preparación")).toEqual({ quantity: 1, unit: "preparación" });
    expect(parseServing("1 paquete")).toEqual({ quantity: 1, unit: "paquete" });
    expect(() => assertPrivateOutputPath("reports/private.json", "/repo")).toThrow(/tmp\/ o temp/);
    expect(assertPrivateOutputPath("tmp/private.json", "/repo")).toBe("/repo/tmp/private.json");
  });
});
