import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const page = source("src/app/(app)/settings/metrics/page.tsx");
const editor = source("src/app/(app)/settings/metrics/daily-metrics-editor.tsx");
const settings = source("src/app/(app)/settings/page.tsx");

describe("PR72 — Ajustes de métricas diarias", () => {
  it("expone la ruta real desde Ajustes y mantiene el parent correcto", () => {
    expect(settings).toContain('href="/settings/metrics"');
    expect(page).toContain('href="/settings"');
    expect(page).toContain("Elegí qué querés registrar cada día.");
  });

  it("separa activas y archivadas sin duplicar secciones", () => {
    expect(editor).toContain('role="tablist"');
    expect(editor).toContain("Activas");
    expect(editor).toContain("Archivadas");
    expect(editor).toContain('tab === "active" ? active : archived');
    expect(editor).toContain("No tenés métricas archivadas.");
  });

  it("permite crear, editar, archivar, reactivar, borrar sin historial y reordenar", () => {
    expect(editor).toContain("Agregar métrica");
    expect(editor).toContain("Crear métrica");
    expect(editor).toContain("archiveMetricAction");
    expect(editor).toContain("restoreMetricAction");
    expect(editor).toContain("!selected.system_key && !selected.has_history");
    expect(editor).toContain("reorderMetricsAction");
    expect(editor).toContain("Subir ${metric.name}");
    expect(editor).toContain("Bajar ${metric.name}");
  });

  it("edita duración como horas y minutos y usa el footer canónico mobile", () => {
    expect(editor).toContain("Horas");
    expect(editor).toContain("Minutos");
    expect(editor).toContain("minutes > 59");
    expect(editor).toContain("<ResponsiveDialog");
    expect(editor).toContain("footer={footer}");
  });
});
