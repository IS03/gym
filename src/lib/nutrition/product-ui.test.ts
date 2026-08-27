import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { parseFoodInput, parseOptionalNumber, parseRequiredNumber } from "./product";

const source = (path: string) => readFileSync(path, "utf8");
const today = source("src/app/(app)/today/page.tsx");
const todayActivity = source("src/app/(app)/today/day-activity-panel.tsx");
const todayActivitySection = source("src/app/(app)/today/today-activity.tsx");
const stepsCard = source("src/app/(app)/today/steps-card.tsx");
const stepsPage = source("src/app/(app)/today/steps/page.tsx");
const todayEditor = source("src/app/(app)/today/day-context-editor.tsx");
const product = source("src/lib/nutrition/product.ts");
const settings = source("src/app/(app)/settings/nutrition/nutrition-settings-forms.tsx");
const settingsRoot = source("src/app/(app)/settings/nutrition/page.tsx");
const settingsProfile = source("src/app/(app)/settings/page.tsx");
const profilePage = source("src/app/(app)/settings/profile/page.tsx");
const profileForm = source("src/app/(app)/settings/profile-form.tsx");
const goalSettings = source("src/app/(app)/settings/nutrition/goals/page.tsx");
const foodsPage = source("src/app/(app)/settings/nutrition/foods/page.tsx");
const integrationsPage = source("src/app/(app)/settings/nutrition/integrations/page.tsx");
const history = source("src/app/(app)/history/page.tsx");
const historicalActivityEditor = source("src/app/(app)/history/historical-activity-editor.tsx");
const nutritionActions = source("src/app/(app)/today/nutrition-actions.ts");
const foods = source("src/app/(app)/settings/nutrition/foods-catalog.tsx");
const body = source("src/components/body/body-measurements.tsx");

describe("PR 7 — experiencia nutricional", () => {
  it("valida números finitos, enteros, cero y null sin confundirlos", () => {
    expect(parseOptionalNumber("", "Macro", { min: 0 })).toBeNull();
    expect(parseOptionalNumber("0", "Macro", { min: 0 })).toBe(0);
    expect(parseRequiredNumber("12,5", "Macro", { min: 0 })).toBe(12.5);
    expect(() => parseRequiredNumber("NaN", "Macro")).toThrow("número válido");
    expect(() => parseRequiredNumber("Infinity", "Macro")).toThrow("número válido");
    expect(() => parseRequiredNumber("-1", "Macro", { min: 0 })).toThrow("al menos 0");
    expect(() => parseRequiredNumber("1.5", "Pasos", { integer: true })).toThrow("entero");
  });

  it("acepta foods completos o parciales y rechaza nutrición totalmente desconocida", () => {
    expect(parseFoodInput({ name: "Sintético", servingQuantity: "100", servingUnit: "g", calories: "200", proteinG: "10", carbsG: "0", fatG: "5" })).toMatchObject({ calories: 200, protein_g: 10, carbs_g: 0, fat_g: 5 });
    expect(parseFoodInput({ name: "Parcial", servingQuantity: "1", servingUnit: "unidad", calories: "", proteinG: "2", carbsG: "", fatG: "0" })).toMatchObject({ calories: null, protein_g: 2, carbs_g: null, fat_g: 0 });
    expect(() => parseFoodInput({ name: "Vacío", servingQuantity: "1", servingUnit: "unidad", calories: "", proteinG: "", carbsG: "", fatG: "" })).toThrow("al menos un valor");
  });

  it("Today separa objetivo, gasto, balance y fuentes de trabajo/gym", () => {
    expect(today).toContain("context.targets.calories");
    expect(todayActivity).toContain("Balance energético");
    expect(today).toContain("Déficit estimado");
    expect(todayActivity).toContain("Gasto estimado");
    expect(today).not.toContain("dayLog.target_kcal_snapshot");
    expect(todayEditor).toContain("Usar horario habitual");
    expect(todayEditor).toContain("Registrar que entrené sin sesión");
    expect(todayEditor).toContain("gymSource === \"workout\"");
    expect(product).toContain("gym_override: true");
    expect(product).not.toContain("gym_override: false");
  });

  it("actividad no calcula totales ni refresca el motor desde TypeScript", () => {
    const activity = product.slice(product.indexOf("export async function updateDailyActivity"), product.indexOf("export async function updateWorkOverride"));
    expect(activity).toContain("steps:");
    expect(activity).toContain("water_l:");
    expect(activity).toContain("mate_l:");
    expect(activity).not.toContain("refresh_nutrition_day");
    expect(activity).not.toContain("total_calories_consumed");
    expect(activity).not.toContain("expenditure_override_kcal");
    expect(activity).not.toContain("estimated_expenditure_kcal_snapshot");
    expect(activity).not.toContain("energy_balance_kcal");
  });

  it("Pasos tiene una card propia sincronizada con el editor y no se duplica en Actividad", () => {
    expect(today).toContain("<TodayActivity");
    expect(todayActivitySection).toContain("<StepsCard steps={activity.steps}");
    expect(stepsCard).toContain('href="/today/steps"');
    expect(stepsCard).toContain("stepsFromInput");
    expect(todayActivity).not.toContain('<p className="text-xs text-muted-foreground">Pasos</p>');
    expect(todayEditor).toContain('htmlFor="daily-steps"');
    expect(nutritionActions).toContain('revalidatePath("/today/steps")');
    expect(stepsPage).toContain("<StepsReport");
    expect(stepsPage).toContain('href="/today"');
  });

  it("Ajustes inserta versiones y no actualiza períodos históricos", () => {
    expect(settings).toContain("Los cambios anteriores se conservan");
    expect(product).toContain('.from("nutrition_goal_periods").insert');
    expect(product).toContain('.from("expenditure_rule_periods").insert');
    expect(product).toContain('.from("work_schedule_periods").insert');
    expect(product).toContain("Ya existe una versión para esa fecha");
    expect(product).not.toContain('.from("nutrition_goal_periods").update');
  });

  it("separa perfil, hub de nutrición y pantallas especializadas", () => {
    expect(settingsProfile).not.toContain("<ProfileForm");
    expect(settingsProfile).toContain('href="/settings/profile"');
    expect(profilePage).toContain("<ProfileForm");
    expect(profileForm).not.toContain("Para seguir el historial");
    expect(settingsRoot).toContain("getNutritionConfigurationHub");
    expect(settingsRoot).not.toContain("FoodsCatalog");
    expect(settingsRoot).not.toContain("listIntegrationApiTokens");
    expect(goalSettings).toContain("Objetivo actual");
    expect(goalSettings).toContain("Próximos cambios");
    expect(foodsPage).toContain("<FoodsCatalog");
    expect(integrationsPage).toContain("<ChatgptIntegration");
  });

  it("History conserva modo read-only y distingue summaries, hora y eventos", () => {
    expect(history).toContain("createIfMissing: false");
    expect(history).toContain("Resumen diario histórico");
    expect(history).toContain("Sin desglose de comidas disponible");
    expect(history).toContain("Horario no informado");
    expect(history).toContain("Eventos / permitidos");
    expect(history).toContain("sólo contexto");
  });

  it("permite corregir sólo actividad histórica con el day log indicado", () => {
    expect(parseOptionalNumber("9350", "Pasos", { integer: true, min: 0 })).toBe(9350);
    expect(parseOptionalNumber("2,5", "Agua", { min: 0 })).toBe(2.5);
    expect(parseOptionalNumber("0.5", "Mate", { min: 0 })).toBe(0.5);
    expect(parseOptionalNumber("", "Agua", { min: 0 })).toBeNull();
    expect(() => parseOptionalNumber("1.5", "Pasos", { integer: true, min: 0 })).toThrow("entero");
    expect(() => parseOptionalNumber("-1", "Mate", { min: 0 })).toThrow("al menos 0");
    expect(product).toContain('.eq("id", input.dayLogId).eq("user_id", userId)');
    expect(history).toContain("<HistoricalActivityEditor dayLogId={dayLog.id}");
    expect(historicalActivityEditor).toContain("saveDailyActivityAction({ dayLogId, steps, waterL: water, mateL: mate })");
    expect(historicalActivityEditor).toContain("if (!result.ok)");
    expect(historicalActivityEditor).toContain("setOpen(false)");
    expect(historicalActivityEditor).not.toContain("saveWorkOverrideAction");
    expect(historicalActivityEditor).not.toContain("saveGymOverrideAction");
    expect(historicalActivityEditor).not.toContain("saveExpenditureOverrideAction");
    expect(nutritionActions).toContain('revalidatePath("/today/reports")');
  });

  it("Foods tiene CRUD blando y Cuerpo conserva procedencia y laterales", () => {
    expect(foods).toContain("Desactivar");
    expect(foods).toContain("Reactivar");
    expect(foods).toContain("Vacío significa desconocido");
    expect(product).not.toContain('.from("foods").delete');
    for (const value of ["abdomen_cm", "arm_right_cm", "arm_left_cm", "thigh_right_cm", "thigh_left_cm", "calf_right_cm", "calf_left_cm"]) expect(body).toContain(value);
    expect(body).toContain("Revisar medición");
    expect(body).toContain("Los lados no se promedian");
    expect(body).toContain("entry.import_run_id?null");
  });
});
