import { createClient } from "@/lib/supabase/server";
import {
  BODY_MEASUREMENT_FIELDS,
  type BodyMeasurement,
  type BodyMeasurementInput,
} from "./body-measurement-types";

export {
  BODY_MEASUREMENT_FIELDS,
  type BodyMeasurement,
  type BodyMeasurementField,
  type BodyMeasurementInput,
} from "./body-measurement-types";

type RawMeasurementInput = {
  measuredOn: string;
  waistCm?: string | null;
  chestCm?: string | null;
  armCm?: string | null;
  thighCm?: string | null;
  hipCm?: string | null;
};

const MAX_MEASUREMENT_CM = 500;

function assertIsoDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Fecha inválida. Usá YYYY-MM-DD.");
  }
}

function parseMeasurement(value: string | null | undefined, label: string): number | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  const parsed = Number(raw.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_MEASUREMENT_CM) {
    throw new Error(`${label} debe ser un número mayor a 0 y hasta ${MAX_MEASUREMENT_CM} cm.`);
  }
  const rounded = Math.round(parsed * 100) / 100;
  if (Math.abs(parsed - rounded) > Number.EPSILON) {
    throw new Error(`${label} puede tener como máximo dos decimales.`);
  }
  return rounded;
}

export function parseBodyMeasurementInput(input: RawMeasurementInput): BodyMeasurementInput {
  assertIsoDate(input.measuredOn);
  const result: BodyMeasurementInput = {
    measuredOn: input.measuredOn,
    waistCm: parseMeasurement(input.waistCm, "Cintura"),
    chestCm: parseMeasurement(input.chestCm, "Pecho"),
    armCm: parseMeasurement(input.armCm, "Brazo"),
    thighCm: parseMeasurement(input.thighCm, "Muslo"),
    hipCm: parseMeasurement(input.hipCm, "Cadera"),
  };
  if (BODY_MEASUREMENT_FIELDS.every((field) => result[field.replace("_cm", "Cm") as keyof BodyMeasurementInput] === null)) {
    throw new Error("Registrá al menos una medida corporal.");
  }
  return result;
}

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) throw new Error(`Autenticación: ${error.message}`);
  if (!user) throw new Error("No autenticado.");
  return { supabase, userId: user.id };
}

function rowPayload(input: BodyMeasurementInput) {
  return {
    measured_on: input.measuredOn,
    waist_cm: input.waistCm,
    chest_cm: input.chestCm,
    arm_cm: input.armCm,
    thigh_cm: input.thighCm,
    hip_cm: input.hipCm,
  };
}

export async function listBodyMeasurements(limit = 366): Promise<BodyMeasurement[]> {
  const { supabase, userId } = await getAuthedContext();
  const safeLimit = Math.min(Math.max(limit, 1), 1000);
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", userId)
    .order("measured_on", { ascending: true })
    .limit(safeLimit);
  if (error) throw new Error(`Leer medidas corporales: ${error.message}`);
  return (data ?? []) as BodyMeasurement[];
}

export async function upsertBodyMeasurement(input: BodyMeasurementInput): Promise<BodyMeasurement> {
  const { supabase, userId } = await getAuthedContext();
  const { data, error } = await supabase
    .from("body_measurements")
    .upsert({ user_id: userId, ...rowPayload(input) }, { onConflict: "user_id,measured_on" })
    .select("*")
    .single();
  if (error) throw new Error(`Guardar medidas corporales: ${error.message}`);
  return data as BodyMeasurement;
}

export async function updateBodyMeasurement(input: BodyMeasurementInput & { id: string }): Promise<BodyMeasurement> {
  const { supabase, userId } = await getAuthedContext();
  const { data, error } = await supabase
    .from("body_measurements")
    .update(rowPayload(input))
    .eq("id", input.id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw new Error(`Editar medidas corporales: ${error.message}`);
  return data as BodyMeasurement;
}

export async function deleteBodyMeasurement(id: string): Promise<void> {
  const { supabase, userId } = await getAuthedContext();
  const { error } = await supabase
    .from("body_measurements")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new Error(`Eliminar medidas corporales: ${error.message}`);
}
