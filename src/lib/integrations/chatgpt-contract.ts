import {
  optionalMealMacro,
  requiredMealCalories,
} from "../nutrition/meal-macros";
import { todayInCordoba } from "../phase2/cordoba-date";

const ALLOWED_KEYS = new Set([
  "date",
  "title",
  "description",
  "calories",
  "protein_g",
  "carbs_g",
  "fat_g",
  "idempotency_key",
  "force_duplicate",
]);

export type ChatgptMealInput = {
  date: string;
  title: string;
  description: string | null;
  calories: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  idempotency_key: string;
  force_duplicate: boolean;
};

export type ChatgptMealSuccess = {
  ok: true;
  created: boolean;
  idempotent_replay: boolean;
  meal: {
    id: string;
    date: string;
    title: string | null;
    calories: number;
    protein_g: number | null;
    carbs_g: number | null;
    fat_g: number | null;
  };
  day: {
    total_calories: number;
    total_protein_g: number;
    total_carbs_g: number;
    total_fat_g: number;
    target_calories: number | null;
    target_protein_g: number | null;
  };
};

export type ChatgptMealErrorCode =
  | "invalid_request"
  | "invalid_token"
  | "possible_duplicate"
  | "internal_error";

export type ChatgptMealError = {
  ok: false;
  error: ChatgptMealErrorCode;
  message: string;
};

export type ChatgptMealHttpResult = {
  status: 200 | 400 | 401 | 409 | 413 | 500;
  body: ChatgptMealSuccess | ChatgptMealError;
};

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function requiredText(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} es obligatorio.`);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    throw new Error(`${label} no puede superar ${maxLength} caracteres.`);
  }
  return text;
}

function optionalText(value: unknown, label: string, maxLength: number) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new Error(`${label} debe ser texto.`);
  const text = value.trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw new Error(`${label} no puede superar ${maxLength} caracteres.`);
  }
  return text;
}

export function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) return null;
  const match = /^Bearer[ \t]+([^\s]+)$/i.exec(authorization.trim());
  return match?.[1] ?? null;
}

export function parseChatgptMealInput(
  value: unknown,
  now = new Date(),
): ChatgptMealInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("El body debe ser un objeto JSON.");
  }
  const body = value as Record<string, unknown>;
  const unexpected = Object.keys(body).filter((key) => !ALLOWED_KEYS.has(key));
  if (unexpected.length > 0) {
    throw new Error(`Campos no permitidos: ${unexpected.join(", ")}.`);
  }

  const date = body.date == null ? todayInCordoba(now) : String(body.date);
  if (!validIsoDate(date)) throw new Error("Fecha inválida. Usá YYYY-MM-DD.");
  if (body.force_duplicate !== undefined && typeof body.force_duplicate !== "boolean") {
    throw new Error("force_duplicate debe ser booleano.");
  }

  return {
    date,
    title: requiredText(body.title, "Título", 200),
    description: optionalText(body.description, "Descripción", 2_000),
    calories: requiredMealCalories(body.calories),
    protein_g: optionalMealMacro(body.protein_g, "Proteína"),
    carbs_g: optionalMealMacro(body.carbs_g, "Carbohidratos"),
    fat_g: optionalMealMacro(body.fat_g, "Grasas"),
    idempotency_key: requiredText(
      body.idempotency_key,
      "idempotency_key",
      200,
    ),
    force_duplicate: body.force_duplicate === true,
  };
}

export function invalidRequest(message: string): ChatgptMealHttpResult {
  return { status: 400, body: { ok: false, error: "invalid_request", message } };
}
