import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ROUTINE_COLOR_PRESETS } from "./routine-colors";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");

describe("routine color UI", () => {
  it("keeps the picker accessible and defaults a new routine to violet", () => {
    const picker = read("components/training/routine-color-picker.tsx");
    const create = read("app/(app)/train/routines/routine-create-form.tsx");
    expect(picker).toContain('role="radiogroup"');
    expect(picker).toContain('role="radio"');
    expect(picker).toContain("aria-checked");
    expect(create).toContain('useState<RoutineColorKey>("violet")');
    expect(create).not.toContain("#ef4444");
  });

  it("declares every routine token in both light and dark themes", () => {
    const globals = read("app/globals.css");
    for (const preset of ROUTINE_COLOR_PRESETS) {
      expect(globals.match(new RegExp(preset.cssVariable, "g"))?.length).toBe(2);
    }
  });

  it("uses contextual rails without replacing primary controls", () => {
    const list = read("app/(app)/train/routines/page.tsx");
    const editorShell = read("app/(app)/train/routines/[id]/routine-editor-shell.tsx");
    const session = read("app/(app)/train/session/[id]/session-editor.tsx");
    expect(list).toContain("w-[3px]");
    expect(list).toContain("routineColorCssVariable");
    expect(editorShell).toContain("routineColorCssVariable");
    expect(editorShell).toContain("w-[3px]");
    expect(session).toContain("hasRoutineAccent");
    expect(session).toContain("bg-primary");
    expect(session).toContain("bg-destructive/80");
  });

  it("resolves every calendar and start-workout color through the central module", () => {
    expect(read("components/training/start-workout-sheet.tsx")).toContain("routineColorCssVariable");
    expect(read("components/training/training-month-preview.tsx")).toContain("routineColorCssVariable");
    expect(read("app/(app)/train/calendar/page.tsx")).toContain("routineColorCssVariable");
  });

  it("keeps the danger rail destructive and independent from the routine accent", () => {
    const session = read("app/(app)/train/session/[id]/session-editor.tsx");
    const dangerous = session.slice(session.lastIndexOf('<details className="group relative'));
    expect(dangerous).toContain("bg-destructive/80");
    expect(dangerous).toContain("group-open:rotate-180");
    expect(dangerous).toContain("motion-reduce:transition-none");
    expect(dangerous).not.toContain("routineAccent");
  });
});
