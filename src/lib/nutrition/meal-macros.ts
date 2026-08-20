import { parseLocalizedDecimal } from "../localized-decimal";

export const MEAL_MACRO_MATCH_TOLERANCE = 0.01;

function numberFromInput(value: unknown, field: string): number {
  const parsed = parseLocalizedDecimal(value);
  if (parsed === null || !Number.isFinite(parsed)) {
    throw new Error(`${field} debe ser un número válido.`);
  }
  return parsed;
}

export function requiredMealCalories(value: unknown): number {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error("Las calorías son obligatorias y deben ser mayores a 0.");
  }
  const parsed = numberFromInput(value, "Calorías");
  if (parsed <= 0) {
    throw new Error("Las calorías son obligatorias y deben ser mayores a 0.");
  }
  if (!Number.isInteger(parsed)) {
    throw new Error("Las calorías deben ser un número entero.");
  }
  return parsed;
}

export function optionalMealMacro(
  value: unknown,
  field: "Proteína" | "Carbohidratos" | "Grasas",
): number | null {
  if (value === null || value === undefined || String(value).trim() === "") {
    return null;
  }
  const parsed = numberFromInput(value, field);
  if (parsed < 0) {
    throw new Error(`${field} no puede ser negativo.`);
  }
  return parsed;
}

export function nullableMealMacrosMatch(
  left: number | null | undefined,
  right: number | null | undefined,
): boolean {
  if (left == null && right == null) return true;
  if (left == null || right == null) return false;
  return Math.abs(Number(left) - Number(right)) <= MEAL_MACRO_MATCH_TOLERANCE;
}
