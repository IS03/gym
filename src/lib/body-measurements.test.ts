import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import {
  deleteBodyMeasurement,
  listBodyMeasurements,
  parseBodyMeasurementInput,
  updateBodyMeasurement,
  upsertBodyMeasurement,
} from "./body-measurements";
import {
  BODY_MEASUREMENT_LABELS,
  EDITABLE_BODY_MEASUREMENT_FIELDS,
  bodyMeasurementEvolutionFields,
} from "./body-measurement-types";

type QueryResult = { data: unknown; error: { message: string } | null };
function query(result: QueryResult) {
  const builder = {
    select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(),
    eq: vi.fn(), order: vi.fn(), limit: vi.fn(), single: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "insert", "update", "delete", "eq", "order", "limit"] as const) builder[method].mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

describe("medidas corporales", () => {
  const row = { id: "measurement-1", user_id: "user-1", measured_on: "2026-08-13", waist_cm: 78, abdomen_cm: null, chest_cm: null, arm_cm: null, arm_right_cm: null, arm_left_cm: null, thigh_cm: null, thigh_right_cm: null, thigh_left_cm: null, calf_right_cm: null, calf_left_cm: null, hip_cm: null, condition: null, notes: null, legacy_import_source: null, legacy_import_id: null, import_run_id: null, quality_status: "verified" as const, quality_note: null, source_payload: null, created_at: "", updated_at: "" };
  const input = { measuredOn: "2026-08-13", waistCm: 78, abdomenCm: null, chestCm: null, armCm: null, armRightCm: null, armLeftCm: null, thighCm: null, thighRightCm: null, thighLeftCm: null, calfRightCm: null, calfLeftCm: null, hipCm: null, condition: null, notes: null };
  const client = { auth: { getUser: vi.fn() }, from: vi.fn() };
  let builder: ReturnType<typeof query>;

  beforeEach(() => {
    builder = query({ data: [row], error: null });
    vi.clearAllMocks();
    client.auth.getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    client.from.mockReturnValue(builder);
    mocks.createClient.mockResolvedValue(client);
  });

  it("acepta una o varias medidas y rechaza registros vacíos o inválidos", () => {
    expect(parseBodyMeasurementInput({ measuredOn: "2026-08-13", waistCm: "78,5" })).toMatchObject({ waistCm: 78.5, chestCm: null });
    expect(parseBodyMeasurementInput({ measuredOn: "2026-08-13", chestCm: "96", armCm: "34" })).toMatchObject({ chestCm: 96, armCm: 34 });
    expect(parseBodyMeasurementInput({ measuredOn: "2026-08-13", abdomenCm: "81", armRightCm: "34", armLeftCm: "33,5", calfRightCm: "37", calfLeftCm: "36.8", condition: "Ayunas", notes: "Sintético" })).toMatchObject({ abdomenCm: 81, armRightCm: 34, armLeftCm: 33.5, calfRightCm: 37, calfLeftCm: 36.8, condition: "Ayunas", notes: "Sintético", armCm: null });
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13" })).toThrow("al menos una");
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13", waistCm: "-2" })).toThrow("mayor a 0");
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13", waistCm: "501" })).toThrow("hasta 500");
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13", waistCm: "78.123" })).toThrow("dos decimales");
  });

  it("mantiene lectura histórica, pero no ofrece los campos históricos para nuevos registros", () => {
    expect(EDITABLE_BODY_MEASUREMENT_FIELDS).not.toContain("arm_cm");
    expect(EDITABLE_BODY_MEASUREMENT_FIELDS).not.toContain("thigh_cm");
    expect(EDITABLE_BODY_MEASUREMENT_FIELDS).toEqual(expect.arrayContaining(["arm_right_cm", "arm_left_cm", "thigh_right_cm", "thigh_left_cm"]));
    expect(BODY_MEASUREMENT_LABELS.arm_cm).toBe("Brazo");
    expect(BODY_MEASUREMENT_LABELS.thigh_cm).toBe("Muslo");
  });

  it("muestra Brazo y Muslo en evolución sólo cuando hay datos históricos", () => {
    expect(bodyMeasurementEvolutionFields([])).not.toEqual(expect.arrayContaining(["arm_cm", "thigh_cm"]));
    expect(bodyMeasurementEvolutionFields([{ arm_cm: 32, thigh_cm: null }])).toContain("arm_cm");
    expect(bodyMeasurementEvolutionFields([{ arm_cm: null, thigh_cm: 55 }])).toContain("thigh_cm");
  });

  it("lee cronológicamente y crea sin reemplazar una fila existente", async () => {
    await expect(listBodyMeasurements()).resolves.toEqual([row]);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builder.order).toHaveBeenCalledWith("measured_on", { ascending: true });

    builder.single.mockResolvedValue({ data: row, error: null });
    await expect(upsertBodyMeasurement(input)).resolves.toEqual(row);
    expect(builder.insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", measured_on: "2026-08-13", waist_cm: 78 }));
  });

  it("acota editar y eliminar al usuario autenticado sin borrar medidas históricas", async () => {
    builder.single.mockResolvedValue({ data: row, error: null });
    await updateBodyMeasurement({ ...input, id: "measurement-1", waistCm: 79, armCm: 32, thighCm: 55 });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ waist_cm: 79 }));
    const updatePayload = builder.update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updatePayload).not.toHaveProperty("arm_cm");
    expect(updatePayload).not.toHaveProperty("thigh_cm");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");

    await deleteBodyMeasurement("measurement-1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "measurement-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
