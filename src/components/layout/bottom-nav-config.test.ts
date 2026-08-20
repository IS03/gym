import { describe, expect, it } from "vitest";
import {
  bottomNavItems,
  getActiveBottomNavIndex,
} from "./bottom-nav-config";

describe("bottomNavItems", () => {
  it("expone las cuatro áreas principales en el orden esperado", () => {
    expect(bottomNavItems).toEqual([
      { id: "home", href: "/home", label: "Inicio" },
      { id: "train", href: "/train", label: "Entrenar" },
      { id: "nutrition", href: "/today", label: "Nutrición" },
      { id: "history", href: "/history", label: "Historial" },
    ]);
    expect(bottomNavItems.map(({ label }) => label)).not.toContain("Ajustes");
  });
});

describe("getActiveBottomNavIndex", () => {
  it.each([
    ["/home", 0],
    ["/train", 1],
    ["/train/progress", 1],
    ["/train/history", 1],
    ["/today", 2],
    ["/today/meal", 2],
    ["/today/reports", 2],
    ["/history", 3],
    ["/history/2026-08-11", 3],
  ])("selecciona la sección correcta para %s", (pathname, expected) => {
    expect(getActiveBottomNavIndex(pathname)).toBe(expected);
  });

  it.each(["/settings", "/settings/profile", "/", "/unknown"])(
    "no fuerza una pestaña para %s",
    (pathname) => {
      expect(getActiveBottomNavIndex(pathname)).toBe(-1);
    },
  );
});
