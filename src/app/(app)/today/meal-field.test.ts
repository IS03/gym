import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Today meal fields", () => {
  const field = read("src/app/(app)/today/meal-field.tsx");
  const create = read("src/app/(app)/today/create-meal-form.tsx");
  const edit = read("src/app/(app)/today/meal-list.tsx");

  it("usa el mismo field outlined con notch en alta y edición", () => {
    expect(field).toContain("group relative min-w-0 pt-2");
    expect(field).toContain("absolute left-3 top-0");
    expect(field).toContain("bg-card");
    expect(field).toContain("group-focus-within:text-primary");
    expect(create.match(/<MealField/g)).toHaveLength(7);
    expect(edit.match(/<MealField/g)).toHaveLength(7);
  });

  it("mantiene controles mobile sin zoom y descripción multilinea", () => {
    expect(field).toContain("text-base");
    expect(field).toContain("placeholder:text-muted-foreground/55");
    expect(create).toContain("<textarea");
    expect(create).toContain('name="description"');
    expect(edit).toContain("<textarea");
    expect(edit).toContain('name="description"');
  });
});
