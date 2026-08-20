import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const home = readFileSync("src/app/(app)/home/page.tsx", "utf8");
const today = readFileSync("src/app/(app)/today/page.tsx", "utf8");
const server = readFileSync("src/lib/supabase/server.ts", "utf8");

describe("request-scoped authenticated reads", () => {
  it("shares one verified context across Home loaders and uses its bounded training read model", () => {
    expect(home).toContain("const auth = await requireAuthenticatedRequestContext()");
    expect(home).toContain("getMyProfile(auth)");
    expect(home).toContain("getNutritionDay(today, undefined, auth)");
    expect(home).toContain("getInProgressSessionForUser(auth)");
    expect(home).toContain("getHomeTrainingSnapshot(today, auth)");
    expect(home).toContain("listWorkoutStartRoutines(auth)");
    expect(home).not.toContain("getTrainingProgress(");
    expect(home).not.toContain("listCompletedSessionHistory(");
  });

  it("shares the verified context with Today without caching nutrition globally", () => {
    expect(today).toContain("const auth = await requireAuthenticatedRequestContext()");
    expect(today).toContain("getNutritionDay(today, undefined, auth)");
    expect(server).toContain("export const getVerifiedRequestContext = cache(");
    expect(server).toContain("supabase.auth.getClaims()");
    expect(server).not.toContain("unstable_cache");
  });
});
