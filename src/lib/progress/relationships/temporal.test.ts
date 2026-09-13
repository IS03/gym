import { describe, expect, it } from "vitest";

import { alignRelationshipSamples } from "./temporal";

const period = { start: "2026-08-01", end: "2026-08-28" };

describe("Relationships V2 temporal alignment", () => {
  it("aligns same-day pairs, preserves zero and never imputes missing", () => {
    const result = alignRelationshipSamples({
      a: [{ date: "2026-08-01", value: 0 }, { date: "2026-08-02", value: 2 }],
      b: [{ date: "2026-08-01", value: 4 }, { date: "2026-08-03", value: 8 }],
      period,
      profile: { family: "acute", kind: "same_day", label: "Mismo día" },
    });
    expect(result.samples).toEqual([{ id: "2026-08-01:2026-08-01", date: "2026-08-01", a: 0, b: 4 }]);
    expect(result.omittedMissing).toBe(27);
  });

  it("supports previous-day alignment without crossing the selected range", () => {
    const result = alignRelationshipSamples({
      a: [{ date: "2026-08-01", value: 7 }],
      b: [{ date: "2026-08-01", value: 3 }, { date: "2026-08-02", value: 4 }],
      period,
      profile: { family: "acute", kind: "previous_day", lagDays: 1, label: "Día previo" },
    });
    expect(result.samples.map((sample) => sample.date)).toEqual(["2026-08-02"]);
  });

  it("matches one daily exposure to at most one next session", () => {
    const result = alignRelationshipSamples({
      a: [{ date: "2026-08-10", value: 200 }],
      b: [
        { date: "2026-08-10", entityId: "session-1", value: 50 },
        { date: "2026-08-10", entityId: "session-2", value: 80 },
      ],
      period,
      profile: { family: "acute", kind: "same_day_or_next_session", maximumLagDays: 1, label: "Próxima sesión" },
    });
    expect(result.samples).toHaveLength(1);
    expect(result.eligibleCount).toBe(2);
  });

  it("aligns chronic body outcomes to real measurements without forward-fill", () => {
    const a = Array.from({ length: 28 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, value: index + 1 }));
    const result = alignRelationshipSamples({
      a,
      b: [
        { date: "2026-08-01", entityId: "weight-1", value: 70 },
        { date: "2026-08-15", entityId: "weight-2", value: 69 },
        { date: "2026-08-28", entityId: "weight-3", value: 68.5 },
      ],
      period,
      profile: { family: "chronic", kind: "trailing_window", windowDays: 14, unit: "measurement", exposureAggregation: "average", outcomeAggregation: "median", label: "14 días previos" },
    });
    expect(result.samples).toHaveLength(2);
    expect(result.samples.map((sample) => sample.b)).toEqual([-1, -0.5]);
    expect(result.observationUnit).toBe("mediciones");
  });

  it("counts chronic training windows as weeks and does not pull pre-period exposure", () => {
    const a = Array.from({ length: 28 }, (_, index) => ({ date: `2026-08-${String(index + 1).padStart(2, "0")}`, value: index }));
    const b = [7, 14, 21, 28].map((day) => ({ date: `2026-08-${String(day).padStart(2, "0")}`, entityId: `week-${day}`, value: day }));
    const result = alignRelationshipSamples({ a, b, period, profile: { family: "chronic", kind: "trailing_window", windowDays: 14, unit: "week", exposureAggregation: "average", outcomeAggregation: "median", label: "14 días previos" } });
    expect(result.observationUnit).toBe("semanas");
    expect(result.eligibleCount).toBe(4);
    expect(result.samples.map((sample) => sample.id)).toEqual(["2026-08-15", "2026-08-22"]);
  });

  it("excludes the in-progress day from aligned observations", () => {
    const result = alignRelationshipSamples({
      a: [{ date: "2026-08-28", value: 0 }], b: [{ date: "2026-08-28", value: 1 }], period,
      profile: { family: "acute", kind: "same_day", label: "Mismo día" }, inProgressDate: "2026-08-28",
    });
    expect(result.samples).toHaveLength(0);
  });
});
