import { describe, expect, it } from "vitest";
import { partitionRoutines } from "./routine-list";
import type { Routine } from "./types";

function routine(id: string, is_active: boolean): Routine {
  return {
    id,
    user_id: "user-1",
    source_key: null,
    nombre: id.toUpperCase(),
    color: null,
    routine_order: 0,
    notes: null,
    is_active,
    created_at: "2026-08-11T00:00:00.000Z",
    updated_at: "2026-08-11T00:00:00.000Z",
  };
}

describe("partitionRoutines", () => {
  it("separa activas y archivadas sin alterar el orden de cada grupo", () => {
    const result = partitionRoutines([
      routine("push", true),
      routine("upper-old", false),
      routine("pull", true),
      routine("full-body", false),
    ]);

    expect(result.active.map((item) => item.id)).toEqual(["push", "pull"]);
    expect(result.archived.map((item) => item.id)).toEqual([
      "upper-old",
      "full-body",
    ]);
  });

  it("conserva listas vacías cuando no hay rutinas de ese estado", () => {
    const result = partitionRoutines([routine("push", true)]);

    expect(result.active).toHaveLength(1);
    expect(result.archived).toEqual([]);
  });
});
