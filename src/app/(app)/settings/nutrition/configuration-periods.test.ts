import { describe, expect, it } from "vitest";
import { groupConfigurationPeriods } from "./configuration-periods";

const version = (id: string, effective_from: string) => ({ id, effective_from });

describe("configuraciones nutricionales versionadas", () => {
  it("elige la última versión efectiva aunque el orden de entrada no lo garantice", () => {
    const groups = groupConfigurationPeriods([
      version("old", "2026-07-01"),
      version("current", "2026-08-20"),
      version("future", "2026-09-01"),
      version("previous", "2026-08-01"),
    ], "2026-08-20");

    expect(groups.current?.id).toBe("current");
    expect(groups.history.map((item) => item.id)).toEqual(["previous", "old"]);
    expect(groups.upcoming.map((item) => item.id)).toEqual(["future"]);
  });

  it("no presenta la configuración vigente como historial", () => {
    const groups = groupConfigurationPeriods([
      version("today", "2026-08-20"),
    ], "2026-08-20");

    expect(groups.current?.id).toBe("today");
    expect(groups.history).toEqual([]);
    expect(groups.upcoming).toEqual([]);
  });

  it("conserva cambios futuros fuera del historial", () => {
    const groups = groupConfigurationPeriods([
      version("future", "2026-08-21"),
    ], "2026-08-20");

    expect(groups.current).toBeNull();
    expect(groups.history).toEqual([]);
    expect(groups.upcoming.map((item) => item.id)).toEqual(["future"]);
  });
});
