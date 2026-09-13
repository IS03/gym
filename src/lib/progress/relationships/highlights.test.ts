import { describe, expect, it } from "vitest";

import { getHighlightedRelationships } from "./engine";
import type { RelationshipPair, RelationshipVariable } from "./types";

const variable = (key: string, roles: ("exposure" | "outcome")[] = ["exposure", "outcome"]): RelationshipVariable => ({
  key, metricKey: key, domain: "activity", label: key, unit: null, metric: null,
  roles, valueKind: "numeric", systemKey: null, isActive: true, sampleSize: 28,
});
const sameDay = { family: "acute" as const, kind: "same_day" as const, label: "Mismo día" };
const samples = (reverse = false) => Array.from({ length: 28 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, value: reverse ? 27 - index : index }));

describe("Relationships V2 highlights", () => {
  it("deduplicates symmetric candidates, ranks valid signals and respects the maximum", () => {
    const variables = [variable("a"), variable("b"), variable("c")];
    const pairs: RelationshipPair[] = [
      { aKey: "a", bKey: "b", temporal: sameDay, symmetric: true, relevance: 10 },
      { aKey: "b", bKey: "a", temporal: sameDay, symmetric: true, relevance: 9 },
      { aKey: "c", bKey: "b", temporal: sameDay, symmetric: false, relevance: 8 },
    ];
    const result = getHighlightedRelationships({
      variables, pairs, period: { start: "2026-08-01", end: "2026-08-28" }, maximum: 2,
      samplesByVariable: new Map([["a", samples()], ["b", samples()], ["c", samples(true)]]),
    });
    expect(result).toHaveLength(2);
    expect(result.filter((item) => new Set([item.pair.aKey, item.pair.bKey]).has("a") && new Set([item.pair.aKey, item.pair.bKey]).has("b"))).toHaveLength(1);
    expect(result.every((item) => item.quality === "clear" || item.quality === "moderate")).toBe(true);
  });

  it("returns no highlights when candidates are insufficient or have no signal", () => {
    const variables = [variable("a"), variable("b")];
    const pair: RelationshipPair = { aKey: "a", bKey: "b", temporal: sameDay, symmetric: true, relevance: 1 };
    const flat = Array.from({ length: 28 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, value: index % 4 }));
    expect(getHighlightedRelationships({ variables, pairs: [pair], period: { start: "2026-08-01", end: "2026-08-28" }, samplesByVariable: new Map([["a", samples()], ["b", flat]]) })).toEqual([]);
  });
});
