import { describe, expect, it } from "vitest";

import {
  activeProductTab,
  isProductPath,
  PRODUCT_TABS,
  safeProductPath,
  settingsReturnPath,
  tabPathForContext,
} from "./routes";

describe("native product routes", () => {
  it("defines Home as the safe authenticated default", () => {
    expect(safeProductPath("/")).toBe("/home");
    expect(safeProductPath("/unknown")).toBe("/home");
    expect(isProductPath("/home")).toBe(true);
  });

  it("keeps the four canonical tabs and resolves their active state", () => {
    expect(PRODUCT_TABS.map(({ label }) => label)).toEqual([
      "Inicio",
      "Entrenar",
      "Nutrición",
      "Progreso",
    ]);
    expect(activeProductTab("/today")).toBe("nutrition");
    expect(activeProductTab("/settings")).toBeNull();
  });

  it("returns from Settings to a valid prior tab and never to an arbitrary route", () => {
    expect(settingsReturnPath({ returnTo: "/train" })).toBe("/train");
    expect(settingsReturnPath({ returnTo: "/settings/diagnostics" })).toBe(
      "/home",
    );
    expect(tabPathForContext("/progress")).toBe("/progress");
    expect(tabPathForContext("/settings")).toBe("/home");
  });

  it("keeps Diagnostics as a known secondary route", () => {
    expect(isProductPath("/settings/diagnostics")).toBe(true);
  });
});
