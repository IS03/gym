import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getMyProfile: vi.fn(), upsertMyProfile: vi.fn(), syncTodayNutritionSnapshots: vi.fn(), listWeightHistory: vi.fn(), recordWeightForDate: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../lib/phase1/profile", () => ({ getMyProfile: mocks.getMyProfile, upsertMyProfile: mocks.upsertMyProfile, syncTodayNutritionSnapshots: mocks.syncTodayNutritionSnapshots }));
vi.mock("../../../lib/phase1/day-log", () => ({ listWeightHistory: mocks.listWeightHistory, recordWeightForDate: mocks.recordWeightForDate }));

import { saveProfileAction } from "./profile-actions";
import { initialProfileSaveState } from "./profile-state";

function form(weight: string, name = "Nacho") {
  const data = new FormData();
  data.set("display_name", name); data.set("birth_date", ""); data.set("sex", ""); data.set("height_cm", ""); data.set("current_weight_kg", weight);
  return data;
}

describe("sincronización de peso desde Ajustes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.upsertMyProfile.mockResolvedValue({});
    mocks.recordWeightForDate.mockResolvedValue({});
  });

  it("crea perfil e historial al ingresar el primer peso", async () => {
    mocks.getMyProfile.mockResolvedValue(null); mocks.listWeightHistory.mockResolvedValue([]);
    await expect(saveProfileAction(initialProfileSaveState, form("65"))).resolves.toMatchObject({ status: "success" });
    expect(mocks.upsertMyProfile).toHaveBeenCalledWith(expect.objectContaining({ current_weight_kg: 65 }));
    expect(mocks.recordWeightForDate).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 65 }));
  });

  it("crea el primer historial para un perfil existente que todavía no tenía registros", async () => {
    mocks.getMyProfile.mockResolvedValue({ current_weight_kg: 65 }); mocks.listWeightHistory.mockResolvedValue([]);
    await saveProfileAction(initialProfileSaveState, form("65"));
    expect(mocks.recordWeightForDate).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 65 }));
  });

  it("no inventa un punto de peso al guardar un cambio de nombre", async () => {
    mocks.getMyProfile.mockResolvedValue({ current_weight_kg: 65 }); mocks.listWeightHistory.mockResolvedValue([{ id: "day", log_date: "2026-08-12", weight_kg: 65 }]);
    await saveProfileAction(initialProfileSaveState, form("65", "Otro nombre"));
    expect(mocks.recordWeightForDate).not.toHaveBeenCalled();
  });

  it("sincroniza perfil e historial cuando el peso cambia explícitamente", async () => {
    mocks.getMyProfile.mockResolvedValue({ current_weight_kg: 65 }); mocks.listWeightHistory.mockResolvedValue([{ id: "day", log_date: "2026-08-12", weight_kg: 65 }]);
    await saveProfileAction(initialProfileSaveState, form("64,8"));
    expect(mocks.upsertMyProfile).toHaveBeenCalledWith(expect.objectContaining({ current_weight_kg: 64.8 }));
    expect(mocks.recordWeightForDate).toHaveBeenCalledWith(expect.objectContaining({ weightKg: 64.8 }));
  });
});
