import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { resolveWorkoutFinishOutcome } from "./finish-reliability";

describe("workout finish reliability", () => {
  it("recovers success when the response was lost after commit", () => {
    expect(resolveWorkoutFinishOutcome(false, "completed")).toEqual({
      status: "confirmed_success",
      recovered: true,
    });
  });

  it("keeps retry available when the session is still in progress", () => {
    expect(resolveWorkoutFinishOutcome(false, "in_progress")).toEqual({
      status: "confirmed_failure",
    });
  });

  it("does not invent success when verification also fails", () => {
    expect(resolveWorkoutFinishOutcome(false, "unknown")).toEqual({
      status: "unknown_outcome",
    });
  });

  it("uses one finish attempt, read-back and a synchronous double-tap guard", () => {
    const editor = readFileSync(
      "src/app/(app)/train/session/[id]/session-editor.tsx",
      "utf8",
    );
    expect(editor.match(/await finishWorkoutSessionAction\(/g)).toHaveLength(1);
    expect(editor).toContain("await getWorkoutSessionCompletionStateAction({");
    expect(editor).toContain("if (finishInFlightRef.current) return");
    expect(editor).toContain('outcome.status !== "confirmed_success"');
    expect(editor).toContain("autosaveRef.current?.releaseFence()");
    expect(editor).toContain("for (const key of draftKeys) removeDraft(key)");
  });
});
