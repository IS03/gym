import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const hub = read("src/app/(app)/settings/nutrition/page.tsx");
const page = read("src/app/(app)/settings/nutrition/meals/page.tsx");
const catalog = read("src/app/(app)/settings/nutrition/saved-meals-catalog.tsx");
const actions = read("src/app/(app)/settings/nutrition/actions.ts");

describe("PR30 — gestión de Comidas habituales", () => {
  it("agrega una sección propia sin confundirla con Alimentos", () => {
    expect(hub).toContain('href="/settings/nutrition/foods"');
    expect(hub).toContain('href="/settings/nutrition/meals"');
    expect(hub).toContain('title="Comidas habituales"');
    expect(page).toContain("<SavedMealsCatalog");
  });

  it("ofrece búsqueda y filtros Activas / Archivadas / Todas", () => {
    expect(catalog).toContain("Buscar comida…");
    expect(catalog).toContain('label: "Activas"');
    expect(catalog).toContain('label: "Archivadas"');
    expect(catalog).toContain('label: "Todas"');
    expect(catalog).toContain('useState<SavedMealCatalogFilter>("active")');
  });

  it("crea y edita en dialog responsive, con modo manual y compuesto", () => {
    expect(catalog).toContain("<ResponsiveDialog");
    expect(catalog).toContain("Manual");
    expect(catalog).toContain("Con alimentos");
    expect(catalog).toContain("Agregar alimento");
    expect(catalog).not.toContain("window.confirm");
  });

  it("distingue archivar/reactivar de eliminar con confirmación", () => {
    expect(catalog).toContain("Archivar");
    expect(catalog).toContain("Reactivar");
    expect(catalog).toContain("Eliminar comida habitual");
    expect(catalog).toContain("Las comidas ya registradas no cambiarán");
    expect(actions).toContain("deleteSavedMealAction");
    expect(actions).toContain("setSavedMealActiveAction");
  });
});
