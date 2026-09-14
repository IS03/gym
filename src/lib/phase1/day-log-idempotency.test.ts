import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createMeal, DUPLICATE_MEAL_LOOKBACK_MS } from "./day-log";

function mealContext() {
  const rows: Array<Record<string, unknown>> = [];
  const supabase = {
    rpc: vi.fn(async () => ({ data: { id: "day-1" }, error: null })),
    from: vi.fn(() => ({
      insert(payload: Record<string, unknown>) {
        return {
          select() {
            return {
              async single() {
                const duplicate = rows.find((row) =>
                  row.user_id === payload.user_id
                  && row.idempotency_key === payload.idempotency_key
                  && payload.idempotency_key !== null);
                if (duplicate) {
                  return { data: null, error: { code: "23505", message: "duplicate key" } };
                }
                const row = { id: `meal-${rows.length + 1}`, ...payload };
                rows.push(row);
                return { data: row, error: null };
              },
            };
          },
        };
      },
      select() {
        const filters = new Map<string, unknown>();
        const builder = {
          eq(column: string, value: unknown) {
            filters.set(column, value);
            return builder;
          },
          async maybeSingle() {
            const data = rows.find((row) =>
              [...filters].every(([column, value]) => row[column] === value)) ?? null;
            return { data, error: null };
          },
        };
        return builder;
      },
    })),
  };
  return {
    rows,
    context: { supabase, userId: "user-1" } as unknown as AuthenticatedRequestContext,
  };
}

const input = {
  date: "2026-09-14",
  title: "Almuerzo",
  final_calories: 500,
};

describe("meal creation idempotency", () => {
  it("recovers the same logical creation without inserting a second row", async () => {
    const { context, rows } = mealContext();
    const first = await createMeal({ ...input, idempotencyKey: "mutation-1" }, context);
    const recovered = await createMeal({ ...input, idempotencyKey: "mutation-1" }, context);

    expect(recovered).toEqual(first);
    expect(rows).toHaveLength(1);
  });

  it("allows identical intentional meals when their operation keys differ", async () => {
    const { context, rows } = mealContext();
    await createMeal({ ...input, idempotencyKey: "mutation-1" }, context);
    await createMeal({ ...input, idempotencyKey: "mutation-2" }, context);

    expect(rows).toHaveLength(2);
    expect(DUPLICATE_MEAL_LOOKBACK_MS).toBe(60_000);
  });
});
