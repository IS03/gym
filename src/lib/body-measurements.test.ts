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

type QueryResult = { data: unknown; error: { message: string } | null };
function query(result: QueryResult) {
  const builder = {
    select: vi.fn(), upsert: vi.fn(), update: vi.fn(), delete: vi.fn(),
    eq: vi.fn(), order: vi.fn(), limit: vi.fn(), single: vi.fn(),
    then: (resolve: (value: QueryResult) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  for (const method of ["select", "upsert", "update", "delete", "eq", "order", "limit"] as const) builder[method].mockReturnValue(builder);
  builder.single.mockResolvedValue(result);
  return builder;
}

describe("medidas corporales", () => {
  const row = { id: "measurement-1", user_id: "user-1", measured_on: "2026-08-13", waist_cm: 78, chest_cm: null, arm_cm: null, thigh_cm: null, hip_cm: null, created_at: "", updated_at: "" };
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
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13" })).toThrow("al menos una");
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13", waistCm: "-2" })).toThrow("mayor a 0");
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13", waistCm: "501" })).toThrow("hasta 500");
    expect(() => parseBodyMeasurementInput({ measuredOn: "2026-08-13", waistCm: "78.123" })).toThrow("dos decimales");
  });

  it("lee cronológicamente y hace upsert de una sola fila por usuario y fecha", async () => {
    await expect(listBodyMeasurements()).resolves.toEqual([row]);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builder.order).toHaveBeenCalledWith("measured_on", { ascending: true });

    builder.single.mockResolvedValue({ data: row, error: null });
    await expect(upsertBodyMeasurement({ measuredOn: "2026-08-13", waistCm: 78, chestCm: null, armCm: null, thighCm: null, hipCm: null })).resolves.toEqual(row);
    expect(builder.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", measured_on: "2026-08-13", waist_cm: 78 }), { onConflict: "user_id,measured_on" });
  });

  it("acota editar y eliminar al usuario autenticado", async () => {
    builder.single.mockResolvedValue({ data: row, error: null });
    await updateBodyMeasurement({ id: "measurement-1", measuredOn: "2026-08-13", waistCm: 79, chestCm: null, armCm: null, thighCm: null, hipCm: null });
    expect(builder.update).toHaveBeenCalledWith(expect.objectContaining({ waist_cm: 79 }));
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");

    await deleteBodyMeasurement("measurement-1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "measurement-1");
    expect(builder.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});
