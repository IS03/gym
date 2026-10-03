import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { buildMobileNutritionDayResponse, parseNutritionDate } from "./nutrition-day";
import { parseMobileNutritionDayResponse } from "./nutrition-day-contract";
import type { MobileSupabaseAuthenticatedContext } from "./supabase";
vi.mock("server-only", () => ({}));
vi.mock("./supabase", () => ({ authenticateMobileAccessToken: vi.fn() }));
import { authenticateMobileAccessToken } from "./supabase";
import { readMobileNutritionDay } from "./nutrition-day-server";
import { GET, OPTIONS } from "@/app/api/mobile/v1/nutrition/days/[date]/route";

const date = "2026-09-20", today = "2026-10-02";
const id = (n: number) => `41100000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const timestamp = `${date}T12:00:00+00:00`;
function snapshot() {
  return { date, today, nutrition: { status: "ok", data: { dayLog: {
    id: id(1), user_id: id(10), log_date: date,
    total_calories_consumed: 200, total_protein_g: 0, total_carbs_g: 20, total_fat_g: 0,
    nutrition_target_kcal_snapshot: 1800, protein_target_g_snapshot: 140, water_target_l_snapshot: 3,
    delta_vs_nutrition_target: -1600, estimated_expenditure_kcal_snapshot: 2200, energy_balance_kcal: -2000,
    nutrition_target_automatic_kcal_snapshot: 1800, nutrition_target_override_kcal: null,
    estimated_expenditure_automatic_kcal_snapshot: 2200, expenditure_override_kcal: null,
    gym_effective_snapshot: null, gym_source_snapshot: null, work_effective_snapshot: false, work_source_snapshot: "schedule",
    nutrition_resolved_at: timestamp,
  }, meals: [
    { id: id(2), day_log_id: id(1), user_id: id(10), title: "Comida", description: null, deleted_at: null,
      final_calories: 200, final_protein_g: null as number | null, final_carbs_g: 20, final_fat_g: 0,
      consumed_at: timestamp, updated_at: timestamp, raw_input: '{"originalTimeKnown":false}',
      entry_kind: "meal", source_type: "sheet_import", precision_level: "historical", meal_label: null },
  ] } }, activity: { status: "ok", data: { metrics: [{
    id: id(3), systemKey: "water", label: "Agua", unit: "L", valueType: "decimal", target: 2,
    isActive: true, value: null, updatedAt: null,
  }] } } };
}

describe("Nutrition day exact-date contract", () => {
  it("preserves persisted snapshots, distinct balances, unknown and explicit zero", () => {
    const result = buildMobileNutritionDayResponse(date, snapshot());
    expect(result.nutrition).toMatchObject({ status: "ok", data: {
      summary: { proteinG: { knownTotal: 0, missingCount: 1 }, fatG: { knownTotal: 0, missingCount: 0 } },
      context: { deltaVsTargetKcal: -1600, energyBalanceKcal: -2000, training: { effective: null, source: null } },
      meals: [{ proteinG: null, fatG: 0, timeKnown: false }],
    } });
    expect(JSON.stringify(result)).not.toMatch(/user_id|raw_input|day_log_id/);
    expect(parseMobileNutritionDayResponse(result)).toEqual(result);
    const zero = snapshot();
    zero.nutrition.data.meals[0].final_calories = 0;
    zero.nutrition.data.dayLog.total_calories_consumed = 0;
    expect(buildMobileNutritionDayResponse(date, zero).nutrition).toMatchObject({ data: {
      summary: { calories: { knownTotal: 0, missingCount: 0 } }, meals: [{ calories: 0 }],
    } });
  });
  it("represents partial macro coverage without filling missing values", () => {
    const raw = snapshot();
    raw.nutrition.data.meals.push({ ...raw.nutrition.data.meals[0], id: id(4), final_protein_g: 10 });
    raw.nutrition.data.dayLog.total_protein_g = 10;
    expect(buildMobileNutritionDayResponse(date, raw).nutrition).toMatchObject({ data: { summary: {
      entryCount: 2, proteinG: { knownTotal: 10, missingCount: 1 },
    } } });
  });
  it("distinguishes an existing empty day from a date without day_log", () => {
    const raw = snapshot();
    raw.nutrition.data.meals = [];
    raw.nutrition.data.dayLog.total_calories_consumed = 0;
    expect(buildMobileNutritionDayResponse(date, raw).nutrition).toMatchObject({ data: { dayState: "recorded", summary: { entryCount: 0 } } });
    expect(buildMobileNutritionDayResponse(date, { ...raw, nutrition: { status: "ok", data: { dayLog: null, meals: [] } } }).nutrition)
      .toEqual({ status: "ok", data: { dayState: "missing", summary: null, context: null, meals: [] } });
  });
  it("allows today, history and imported summaries without changing snapshots", () => {
    const raw = snapshot();
    raw.today = date;
    raw.nutrition.data.meals[0].entry_kind = "legacy_daily_summary";
    expect(buildMobileNutritionDayResponse(date, raw)).toMatchObject({ today: date, nutrition: { data: {
      summary: { mealCount: 0, entryCount: 1 }, meals: [{ entryKind: "legacy_daily_summary", timeKnown: false }],
    } } });
  });
  it("keeps nutrition when activity fails and vice versa; both unavailable fail", () => {
    const raw = snapshot();
    expect(buildMobileNutritionDayResponse(date, { ...raw, activity: { status: "unavailable" } }).nutrition.status).toBe("ok");
    expect(buildMobileNutritionDayResponse(date, { ...raw, nutrition: { status: "unavailable" } }).activity.status).toBe("ok");
    expect(() => buildMobileNutritionDayResponse(date, { ...raw, nutrition: { status: "unavailable" }, activity: { status: "unavailable" } })).toThrow();
  });
  it("rejects invalid dates, wrong dates, corrupt totals and coverage", () => {
    for (const v of ["2026-02-30", "2026-13-01", "0000-01-01", "today", "2026-2-01"]) expect(() => parseNutritionDate(v)).toThrow();
    expect(parseNutritionDate("2024-02-29")).toBe("2024-02-29");
    expect(() => buildMobileNutritionDayResponse("2026-09-21", snapshot())).toThrow();
    const result = buildMobileNutritionDayResponse(date, snapshot());
    if (result.nutrition.status === "ok" && result.nutrition.data.dayState === "recorded") {
      result.nutrition.data.summary.proteinG.missingCount = 0;
      expect(parseMobileNutritionDayResponse(result)).toBeUndefined();
    }
    const raw = snapshot();
    raw.nutrition.data.dayLog.total_protein_g = Number.NaN;
    expect(buildMobileNutritionDayResponse(date, raw).nutrition.status).toBe("unavailable");
  });
});

describe("Nutrition read server and route", () => {
  const context = (rpc: unknown) => ({ userId: id(10), supabase: { rpc } }) as MobileSupabaseAuthenticatedContext;
  it("uses one read-only RPC with date only, without client identity or initialization", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: snapshot(), error: null });
    await readMobileNutritionDay(date, context(rpc), { requestKind: "navigation" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("mobile_read_nutrition_day", { p_log_date: date }, { get: true });
  });
  it("authenticates Bearer, returns private headers and maps validation/unavailability", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: snapshot(), error: null });
    vi.mocked(authenticateMobileAccessToken).mockResolvedValue(context(rpc));
    const request = new NextRequest(`https://example.test/api/mobile/v1/nutrition/days/${date}`, { headers: { authorization: "Bearer token" } });
    const response = await GET(request, { params: Promise.resolve({ date }) });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(authenticateMobileAccessToken).toHaveBeenCalledWith("token");
    expect((await GET(request, { params: Promise.resolve({ date: "2026-02-30" }) })).status).toBe(400);
    rpc.mockResolvedValue({ data: null, error: { code: "42883" } });
    expect((await GET(request, { params: Promise.resolve({ date }) })).status).toBe(503);
    expect((await GET(new NextRequest(request.url), { params: Promise.resolve({ date }) })).status).toBe(401);
    expect((await OPTIONS(request)).status).toBe(204);
  });
});
