import { describe, expect, it, vi } from "vitest";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { MealNotFoundError, softDeleteMeal, updateMeal } from "./day-log";

function mutationContext(data: Record<string, unknown> | null) {
  const filters: Array<[string, unknown]> = [];
  const builder = {
    update: vi.fn(() => builder),
    eq: vi.fn((column: string, value: unknown) => {
      filters.push([column, value]);
      return builder;
    }),
    is: vi.fn(() => builder),
    select: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => ({ data, error: null })),
  };
  const context = {
    userId: "user-a",
    supabase: { from: vi.fn(() => builder) },
  } as unknown as AuthenticatedRequestContext;
  return { builder, context, filters };
}

describe("owner-scoped meal mutations", () => {
  it("updates only a meal owned by the authenticated user", async () => {
    const row = {
      id: "4f0e2089-79b4-4720-9ae8-a6a88a0a66af",
      title: "Cena",
    };
    const { context, filters } = mutationContext(row);

    await expect(
      updateMeal({ id: row.id, title: "Cena" }, context),
    ).resolves.toEqual(row);
    expect(filters).toContainEqual(["id", row.id]);
    expect(filters).toContainEqual(["user_id", "user-a"]);
  });

  it("returns not-found for a foreign or nonexistent meal update", async () => {
    const { context } = mutationContext(null);
    await expect(
      updateMeal(
        { id: "4f0e2089-79b4-4720-9ae8-a6a88a0a66af", title: "Cena" },
        context,
      ),
    ).rejects.toBeInstanceOf(MealNotFoundError);
  });

  it("soft-deletes only an active meal owned by the authenticated user", async () => {
    const id = "4f0e2089-79b4-4720-9ae8-a6a88a0a66af";
    const { builder, context, filters } = mutationContext({ id });

    await expect(softDeleteMeal(id, context)).resolves.toBeUndefined();
    expect(filters).toContainEqual(["id", id]);
    expect(filters).toContainEqual(["user_id", "user-a"]);
    expect(builder.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("does not report success for a foreign, missing, or already deleted meal", async () => {
    const { context } = mutationContext(null);
    await expect(
      softDeleteMeal("4f0e2089-79b4-4720-9ae8-a6a88a0a66af", context),
    ).rejects.toBeInstanceOf(MealNotFoundError);
  });
});
