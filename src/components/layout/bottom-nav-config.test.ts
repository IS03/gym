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
      { id: "progress", href: "/progress", label: "Progreso" },
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
    ["/progress", 3],
    ["/progress/nutrition", 3],
  ])("selecciona la sección correcta para %s", (pathname, expected) => {
    expect(getActiveBottomNavIndex(pathname)).toBe(expected);
  });

  it.each(["/settings", "/settings/profile", "/history", "/", "/unknown"])(
    "no fuerza una pestaña para %s",
    (pathname) => {
      expect(getActiveBottomNavIndex(pathname)).toBe(-1);
    },
  );
});
