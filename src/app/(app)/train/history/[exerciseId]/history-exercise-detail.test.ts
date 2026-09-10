import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detail = readFileSync("src/app/(app)/train/history/[exerciseId]/history-exercise-detail.tsx", "utf8");
const page = readFileSync("src/app/(app)/train/history/[exerciseId]/page.tsx", "utf8");

describe("PR79 historical exercise detail", () => {
  it("renders latest, canonical best and chronological snapshot sessions", () => {
    expect(detail).toContain('title="Última vez"');
    expect(detail).toContain('title="Mejor marca"');
    expect(detail).toContain("buildTrainingHistoryExerciseDetail(sessions)");
    expect(detail).toContain("RIR ");
    expect(detail).toContain("detail.sessions.slice(0, currentLimit)");
  });

  it("opens the original session and the exact progress exercise report", () => {
    expect(detail).toContain('href={"/train/session/" + session.sessionId}');
    expect(detail).toContain('?from=progress&view=exercises&period=3m');
    expect(detail).toContain("Ver análisis en Progreso");
  });

  it("keeps history and progress presentations separate without duplicate reads", () => {
    expect(page).toContain("if (!cameFromProgress)");
    expect(page).toContain("listRobustExerciseHistory({ exerciseId, limit: 500 })");
    expect(page).toContain("<HistoryExerciseDetail");
    expect(page).toContain("<ExerciseReportView");
    expect(page).toContain('requestedReturn.startsWith("/train/history?")');
  });
});
