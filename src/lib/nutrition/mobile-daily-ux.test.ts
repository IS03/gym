import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const home = source("src/app/(app)/home/page.tsx");
const library = source("src/app/(app)/train/exercises/exercise-library.tsx");
const today = source("src/app/(app)/today/page.tsx");
const mealComposer = source("src/app/(app)/today/meal-composer.tsx");
const mealForm = source("src/app/(app)/today/create-meal-form.tsx");
const activityPanel = source("src/app/(app)/today/day-activity-panel.tsx");
const activityEditor = source("src/app/(app)/today/day-context-editor.tsx");
const responsiveDialog = source("src/app/(app)/today/responsive-dialog.tsx");

describe("PR 9.6 — UX diaria mobile", () => {
  it("alinea todos los accesos rápidos mediante el componente común", () => {
    const quickAccess = home.slice(home.indexOf("function QuickAccess"), home.indexOf("function plural"));
    expect(quickAccess).toContain("grid-rows-[2.25rem_1fr]");
    expect(quickAccess).toContain("pt-2.5");
    expect(quickAccess).toContain("mt-1.5");
    expect(quickAccess).toContain("text-[11px]");
    expect(quickAccess).toContain("sm:text-xs");
    expect(quickAccess).not.toContain("Nutrición");
  });

  it("conserva los cuatro accesos, sus destinos y su contenido", () => {
    const quickAccess = home.slice(home.indexOf("function QuickAccess"), home.indexOf("function plural"));

    expect(quickAccess).toContain("<Icon");
    expect(quickAccess).toContain("{title}");
    expect(quickAccess).toContain("{description}");
    for (const href of ["/today", "/train/routines", "/train/calendar", "/progress"]) {
      expect(home).toContain(`href=\"${href}\"`);
    }
  });

  it("ofrece el mismo flujo de creación de ejercicios desde el encabezado", () => {
    const header = library.slice(library.indexOf("<h1"), library.indexOf("<div className=\"flex gap-2\">"));
    expect(header).toContain("onClick={openCreate}");
    expect(header).toContain("Nuevo");
    expect(library.match(/onClick=\{openCreate\}/g)?.length).toBe(2); // header + estado vacío
    expect(library).not.toContain('className="h-11 w-full lg:hidden" onClick={openCreate}');
  });

  it("mantiene Resumen, acción compacta, Actividad y luego Comidas", () => {
    expect(today.indexOf("<MealComposer")).toBeGreaterThan(today.indexOf(">Resumen<"));
    expect(today.indexOf("<DayActivityPanel")).toBeGreaterThan(today.indexOf("<MealComposer"));
    expect(today.indexOf(">Comidas<")).toBeGreaterThan(today.indexOf("<DayActivityPanel"));
    expect(activityPanel).toContain("Actividad de hoy");
    expect(activityPanel).toContain("<details");
  });

  it("abre la comida en un diálogo responsive, conserva la fecha y cierra al crear", () => {
    expect(mealComposer).toContain("<ResponsiveDialog");
    expect(mealComposer).toContain("onSuccess={() => setOpen(false)}");
    expect(mealForm).toContain('name="date"');
    expect(mealForm).toContain("defaultValue={date}");
    expect(mealForm).toContain("[min-inline-size:0]");
    expect(mealForm).toContain("checkRecentDuplicateMealAction");
    expect(responsiveDialog).toContain("100dvh");
    expect(responsiveDialog).toContain("env(safe-area-inset-bottom)");
    expect(responsiveDialog).toContain("overflow-y-auto overscroll-contain");
  });

  it("deja espacio para los rings de foco de los campos de comida", () => {
    const mealFormTag = mealForm.slice(mealForm.indexOf("<form"), mealForm.indexOf(">", mealForm.indexOf("<form")));
    const dateFieldWrapper = mealForm.slice(mealForm.indexOf('<div className="min-w-0 space-y-1">'), mealForm.indexOf("</div>", mealForm.indexOf('<div className="min-w-0 space-y-1">')));

    expect(mealFormTag).not.toContain("overflow-x-hidden");
    expect(dateFieldWrapper).not.toContain("overflow-hidden");
  });

  it("autoguarda sólo pasos, agua y mate; las correcciones siguen explícitas", () => {
    expect(activityEditor).toContain("debounceMs: 650");
    expect(activityEditor.match(/queueRef\.current\?\.flush\(\)/g)?.length).toBe(3);
    expect(activityEditor).toContain("Guardando…");
    expect(activityEditor).toContain("Guardado");
    expect(activityEditor).toContain("text-destructive");
    for (const explicitAction of [
      "saveWorkOverrideAction",
      "saveGymOverrideAction",
      "saveExpenditureOverrideAction",
    ]) {
      expect(activityEditor).toContain(`submit(() => ${explicitAction}`);
    }
  });
});
