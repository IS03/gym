export const EDITABLE_BODY_MEASUREMENT_FIELDS = [
  "waist_cm",
  "abdomen_cm",
  "chest_cm",
  "hip_cm",
  "arm_right_cm",
  "arm_left_cm",
  "thigh_right_cm",
  "thigh_left_cm",
  "calf_right_cm",
  "calf_left_cm",
] as const;

export const LEGACY_BODY_MEASUREMENT_FIELDS = ["arm_cm", "thigh_cm"] as const;

export const BODY_MEASUREMENT_FIELDS = [
  ...EDITABLE_BODY_MEASUREMENT_FIELDS,
  ...LEGACY_BODY_MEASUREMENT_FIELDS,
] as const;

export type BodyMeasurementField = (typeof BODY_MEASUREMENT_FIELDS)[number];

export const BODY_MEASUREMENT_LABELS: Record<BodyMeasurementField, string> = {
  waist_cm: "Cintura",
  abdomen_cm: "Abdomen",
  chest_cm: "Pecho",
  hip_cm: "Cadera",
  arm_right_cm: "Brazo derecho",
  arm_left_cm: "Brazo izquierdo",
  thigh_right_cm: "Muslo derecho",
  thigh_left_cm: "Muslo izquierdo",
  calf_right_cm: "Pantorrilla derecha",
  calf_left_cm: "Pantorrilla izquierda",
  arm_cm: "Brazo",
  thigh_cm: "Muslo",
};

export type BodyMeasurement = {
  id: string;
  user_id: string;
  measured_on: string;
  waist_cm: number | null;
  abdomen_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  arm_right_cm: number | null;
  arm_left_cm: number | null;
  thigh_cm: number | null;
  thigh_right_cm: number | null;
  thigh_left_cm: number | null;
  calf_right_cm: number | null;
  calf_left_cm: number | null;
  hip_cm: number | null;
  condition: string | null;
  notes: string | null;
  legacy_import_source: string | null;
  legacy_import_id: string | null;
  import_run_id: string | null;
  quality_status: "verified" | "suspect";
  quality_note: string | null;
  source_payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export function bodyMeasurementEvolutionFields(
  entries: ReadonlyArray<Pick<BodyMeasurement, "arm_cm" | "thigh_cm">>,
): BodyMeasurementField[] {
  const fields: BodyMeasurementField[] = [...EDITABLE_BODY_MEASUREMENT_FIELDS];
  if (entries.some((entry) => entry.arm_cm !== null)) fields.push("arm_cm");
  if (entries.some((entry) => entry.thigh_cm !== null)) fields.push("thigh_cm");
  return fields;
}

export type BodyMeasurementInput = {
  measuredOn: string;
  waistCm: number | null;
  abdomenCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  armRightCm: number | null;
  armLeftCm: number | null;
  thighCm: number | null;
  thighRightCm: number | null;
  thighLeftCm: number | null;
  calfRightCm: number | null;
  calfLeftCm: number | null;
  hipCm: number | null;
  condition: string | null;
  notes: string | null;
};
