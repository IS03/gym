import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getMyProfile: vi.fn(),
  recordWeightForDate: vi.fn(),
  revalidatePath: vi.fn(),
  upsertMyProfile: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/phase1/profile", () => ({
  getMyProfile: mocks.getMyProfile,
  upsertMyProfile: mocks.upsertMyProfile,
}));
vi.mock("@/lib/phase1/day-log", () => ({
  recordWeightForDate: mocks.recordWeightForDate,
}));
vi.mock("@/lib/phase2/cordoba-date", () => ({
  todayInCordoba: () => "2026-08-12",
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { saveProfileAction } from "./profile-actions";
import { initialProfileSaveState } from "./profile-state";

function profileForm(weight = "64.8") {
  const formData = new FormData();
  formData.set("display_name", "Nacho");
  formData.set("birth_date", "2003-12-11");
  formData.set("sex", "male");
  formData.set("height_cm", "174");
  formData.set("current_weight_kg", weight);
  return formData;
}

function snapshotClient() {
  const query = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue({ data: null, error: null });
  return { from: vi.fn().mockReturnValue(query) };
}

describe("Server Action de Perfil", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue(snapshotClient());
    mocks.getMyProfile.mockResolvedValue({ current_weight_kg: 65 });
    mocks.upsertMyProfile.mockResolvedValue({});
    mocks.recordWeightForDate.mockResolvedValue({});
  });

  it("mantiene el contrato de estado y el módulo use server exporta sólo la acción", () => {
    expect(initialProfileSaveState).toEqual({ status: "idle", message: null });

    const source = readFileSync(new URL("./profile-actions.ts", import.meta.url), "utf8");
    expect(source).toContain('"use server"');
    expect(source).not.toMatch(/export\s+(?:const|type|interface|class)\s+/);
  });

  it("guarda el perfil y registra el peso cuando cambió", async () => {
    await expect(saveProfileAction(initialProfileSaveState, profileForm())).resolves.toEqual({
      status: "success",
      message: "✓ Perfil guardado · Peso registrado: 64,8 kg",
    });
    expect(mocks.upsertMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ current_weight_kg: 64.8, height_cm: 174 }),
    );
    expect(mocks.recordWeightForDate).toHaveBeenCalledWith({
      date: "2026-08-12",
      weightKg: 64.8,
    });
  });

  it("informa un resultado parcial sin perder el perfil si falla el snapshot de peso", async () => {
    mocks.recordWeightForDate.mockRejectedValue(new Error("sin conexión"));

    await expect(saveProfileAction(initialProfileSaveState, profileForm())).resolves.toEqual({
      status: "partial",
      message: "Perfil guardado, pero no se pudo registrar el peso. sin conexión",
    });
    expect(mocks.upsertMyProfile).toHaveBeenCalledTimes(1);
  });

  it("valida peso inválido antes de escribir", async () => {
    await expect(saveProfileAction(initialProfileSaveState, profileForm("-2"))).resolves.toMatchObject({
      status: "error",
    });
    expect(mocks.upsertMyProfile).not.toHaveBeenCalled();
  });
});
