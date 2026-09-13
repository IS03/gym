import { describe, expect, it } from "vitest";

import { adaptDailyMetricDefinition } from "../analytics";
import {
  buildRelationshipPairs,
  buildRelationshipVariableCatalog,
  TRAINING_PERFORMANCE_RELATIONSHIP_KEY,
} from "./catalog";

function dynamic(input: { id: string; name: string; systemKey?: "sleep" | null; active?: boolean }) {
  return adaptDailyMetricDefinition({
    id: input.id,
    system_key: input.systemKey ?? null,
    name: input.name,
    unit: "u",
    value_type: "decimal",
    target_value: null,
    sort_order: 0,
    is_active: input.active ?? true,
    archived_at: input.active === false ? "2026-08-01T00:00:00Z" : null,
  });
}

describe("Relationships V2 variable catalog", () => {
  it("adds compatible custom metrics dynamically without inferring semantics from their names", () => {
    const fakeSleep = dynamic({ id: "custom-sleep", name: "Sueño" });
    const concentration = dynamic({ id: "concentration", name: "Concentración" });
    const samples = new Map([[fakeSleep.key, [{ date: "2026-08-01", value: 1 }]], [concentration.key, [{ date: "2026-08-01", value: 2 }]]]);
    const variables = buildRelationshipVariableCatalog({ metrics: [fakeSleep, concentration], samplesByMetric: samples, performanceSampleSize: 4 });
    const pairs = buildRelationshipPairs(variables);
    expect(variables.map((variable) => variable.key)).toContain("activity.daily.concentration");
    expect(pairs.find((pair) => pair.aKey === fakeSleep.key && pair.bKey === concentration.key)?.temporal.kind).toBe("same_day");
    expect(pairs.some((pair) => pair.aKey === fakeSleep.key && pair.bKey === TRAINING_PERFORMANCE_RELATIONSHIP_KEY)).toBe(false);
  });

  it("uses system_key—not label—for approved next-session semantics", () => {
    const builtInSleep = dynamic({ id: "sleep-id", name: "Descanso", systemKey: "sleep" });
    const variables = buildRelationshipVariableCatalog({ metrics: [builtInSleep], samplesByMetric: new Map([[builtInSleep.key, [{ date: "2026-08-01", value: 480 }]]]), performanceSampleSize: 8 });
    const pair = buildRelationshipPairs(variables).find((item) => item.bKey === TRAINING_PERFORMANCE_RELATIONSHIP_KEY);
    expect(pair?.temporal.kind).toBe("same_day_or_next_session");
  });

  it("preserves canonical ID and archived history", () => {
    const archived = dynamic({ id: "metric-identity", name: "Nombre nuevo", active: false });
    const variables = buildRelationshipVariableCatalog({ metrics: [archived], samplesByMetric: new Map([[archived.key, [{ date: "2026-08-01", value: 0 }]]]), performanceSampleSize: 0 });
    expect(variables.find((variable) => variable.key === "activity.daily.metric-identity")).toMatchObject({ label: "Nombre nuevo", isActive: false, sampleSize: 1 });
  });
});
