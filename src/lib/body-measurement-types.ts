export const BODY_MEASUREMENT_FIELDS = [
  "waist_cm",
  "chest_cm",
  "arm_cm",
  "thigh_cm",
  "hip_cm",
] as const;

export type BodyMeasurementField = (typeof BODY_MEASUREMENT_FIELDS)[number];

export type BodyMeasurement = {
  id: string;
  user_id: string;
  measured_on: string;
  waist_cm: number | null;
  chest_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
  hip_cm: number | null;
  created_at: string;
  updated_at: string;
};

export type BodyMeasurementInput = {
  measuredOn: string;
  waistCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
  hipCm: number | null;
};
