import { beforeEach, describe, expect, it, vi } from "vitest";

const { getOrCreateDayLog } = vi.hoisted(() => ({
  getOrCreateDayLog: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/phase1/day-log", () => ({ getOrCreateDayLog }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
  requireAuthenticatedRequestContext: vi.fn(),
}));

import { getNutritionDaySummary } from "./day";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";

describe("Home nutrition summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts the same active meals without downloading their rows", async () => {
    getOrCreateDayLog.mockResolvedValue({ id: "day-1" });
    const is = vi.fn().mockResolvedValue({ count: 4, error: null });
    const eq = vi.fn(() => ({ is }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const context = {
      userId: "user-1",
      supabase: { from },
    } as unknown as AuthenticatedRequestContext;

    const result = await getNutritionDaySummary("2026-08-28", context);

    expect(result.mealCount).toBe(4);
    expect(from).toHaveBeenCalledWith("meal_entries");
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(eq).toHaveBeenCalledWith("day_log_id", "day-1");
    expect(is).toHaveBeenCalledWith("deleted_at", null);
  });
});
