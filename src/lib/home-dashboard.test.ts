import { describe, expect, it } from "vitest";
import {
  buildHomeActiveSessionSummary,
  formatHomeActiveSessionMeta,
  formatHomeActiveSessionTime,
  formatHomeEnergyBalance,
  isDateInRange,
  progressPercent,
} from "./home-dashboard";

function activeSessionInput(): Parameters<typeof buildHomeActiveSessionSummary>[0] {
  return {
    session: {
      id: "session-1",
      session_name: null,
      routine_name_snapshot: "ABS",
      started_at: "2026-09-07T19:12:00.000Z",
    },
    logDate: "2026-09-07",
    exercises: [
      {
        sets: [
          { isCompleted: true },
          { isCompleted: true },
          { isCompleted: true },
        ],
      },
      {
        sets: [
          { isCompleted: true },
          { isCompleted: true },
          { isCompleted: true },
        ],
      },
      ...Array.from({ length: 3 }, () => ({
        sets: Array.from({ length: 3 }, () => ({ isCompleted: false })),
      })),
    ],
  };
}

describe("Home active training summary", () => {
  it("derives the real exercise, set, and percentage progress", () => {
    expect(buildHomeActiveSessionSummary(activeSessionInput())).toEqual({
      id: "session-1",
      name: "ABS",
      logDate: "2026-09-07",
      startedAt: "2026-09-07T19:12:00.000Z",
      exercisesCompleted: 2,
      totalExercises: 5,
      completedSets: 6,
      totalSets: 15,
      progressPercent: 40,
    });
  });

  it("does not invent exercise progress when a session has no set rows", () => {
    const input = activeSessionInput();
    input.exercises = [
      { sets: [] },
      { sets: [] },
    ];
    expect(buildHomeActiveSessionSummary(input).progressPercent).toBe(0);
  });

  it("does not count a partially completed exercise as completed", () => {
    const input = activeSessionInput();
    input.exercises = [
      { sets: [{ isCompleted: true }, { isCompleted: false }] },
    ];

    expect(buildHomeActiveSessionSummary(input)).toMatchObject({
      exercisesCompleted: 0,
      completedSets: 1,
      totalSets: 2,
      progressPercent: 50,
    });
  });

  it("prefers a real free-session name and keeps a stable fallback", () => {
    const named = activeSessionInput();
    named.session.session_name = "  Técnica  ";
    expect(buildHomeActiveSessionSummary(named).name).toBe("Técnica");

    const free = activeSessionInput();
    free.session.routine_name_snapshot = null;
    expect(buildHomeActiveSessionSummary(free).name).toBe("Sesión libre");
  });

  it("clamps progress without inventing a value when the total is empty", () => {
    expect(progressPercent(6, 15)).toBe(40);
    expect(progressPercent(1, 0)).toBe(0);
    expect(progressPercent(20, 15)).toBe(100);
  });

  it("formats the actual Córdoba start time without an ISO date", () => {
    const summary = buildHomeActiveSessionSummary(activeSessionInput());
    expect(formatHomeActiveSessionMeta(summary, "2026-09-07")).toBe(
      "Hoy · iniciada 16:12",
    );
    expect(formatHomeActiveSessionMeta(summary, "2026-09-08")).toMatch(
      /^7 sept? · iniciada 16:12$/,
    );
    expect(formatHomeActiveSessionTime(summary.startedAt)).toBe("16:12");
  });
});

describe("Home nutrition and week display helpers", () => {
  it("shows the signed energy balance rather than the nutrition-target delta", () => {
    expect(formatHomeEnergyBalance(-1188)).toBe("−1.188 kcal");
    expect(formatHomeEnergyBalance(638)).toBe("+638 kcal");
    expect(formatHomeEnergyBalance(null)).toBe("—");
  });

  it("normalizes visual zero but preserves real negative balances", () => {
    expect(formatHomeEnergyBalance(-0)).toBe("0 kcal");
    expect(formatHomeEnergyBalance(-0.1)).toBe("0 kcal");
    expect(formatHomeEnergyBalance(-5)).toBe("−5 kcal");
  });

  it("detects whether an active session belongs to the visible week", () => {
    expect(isDateInRange("2026-09-07", "2026-09-07", "2026-09-13")).toBe(true);
    expect(isDateInRange("2026-09-14", "2026-09-07", "2026-09-13")).toBe(false);
  });
});
