import { describe, expect, it } from "vitest";

import { analyzeRelationship, spearmanAssociation } from "./association";
import type { RelationshipPair, RelationshipSample, RelationshipVariable } from "./types";

const variable = (key: string, label: string): RelationshipVariable => ({
  key, metricKey: key, domain: "activity", label, unit: null, metric: null,
  roles: ["exposure", "outcome"], valueKind: "numeric", systemKey: null, isActive: true, sampleSize: 24,
});
const pair: RelationshipPair = { aKey: "a", bKey: "b", temporal: { family: "acute", kind: "same_day", label: "Mismo día" }, symmetric: true, relevance: 1 };
const samples = (values: number[]): RelationshipSample[] => values.map((b, index) => ({ id: String(index), date: `2026-08-${String(index + 1).padStart(2, "0")}`, a: index, b }));
const analyze = (values: number[], eligibleCount = values.length) => analyzeRelationship({
  pair,
  variableA: variable("a", "Variable A"),
  variableB: variable("b", "Variable B"),
  period: { start: "2026-08-01", end: "2026-08-24" },
  sampleSet: { samples: samples(values), eligibleCount, observationUnit: "días", omittedMissing: eligibleCount - values.length },
});

describe("Relationships V2 association", () => {
  it("detects clear positive and negative monotonic associations", () => {
    const positive = analyze(Array.from({ length: 24 }, (_, index) => index));
    const negative = analyze(Array.from({ length: 24 }, (_, index) => 23 - index));
    expect(positive).toMatchObject({ quality: "clear", direction: "positive", conclusion: "Señal positiva clara" });
    expect(negative).toMatchObject({ quality: "clear", direction: "negative", conclusion: "Señal negativa clara" });
  });

  it("distinguishes weak association from sufficient data with no clear relation", () => {
    const weakPermutation = [...Array.from({ length: 7 }, (_, index) => index), ...Array.from({ length: 17 }, (_, index) => 23 - index)];
    const nonePermutation = [...Array.from({ length: 5 }, (_, index) => index), ...Array.from({ length: 19 }, (_, index) => 23 - index)];
    expect(analyze(weakPermutation).quality).toBe("weak");
    expect(analyze(nonePermutation).quality).toBe("none");
  });

  it("keeps insufficient data and constant variables separate from no relationship", () => {
    expect(analyze([1, 2, 3]).quality).toBe("insufficient");
    expect(analyze(Array(24).fill(2))).toMatchObject({ quality: "insufficient", coefficient: null });
  });

  it("treats explicit zero as data and excludes missing before analysis", () => {
    const paired = samples([0, 1, 2, 3]);
    expect(spearmanAssociation(paired)).toBe(1);
    expect(paired[0]).toMatchObject({ a: 0, b: 0 });
  });

  it("is deterministic and never emits causal wording", () => {
    const values = Array.from({ length: 24 }, (_, index) => index);
    const first = analyze(values);
    const second = analyze(values);
    expect(second).toEqual(first);
    expect(`${first.interpretation} ${first.insight}`).not.toMatch(/causó|provocó|hizo que|gracias a|debido a/i);
  });
});
