import { describe, expect, it } from "vitest";
import {
  getCompactProfile,
  HOME_SETTINGS_HREF,
  mobileHomeDateLabel,
} from "./home-header";

describe("getCompactProfile", () => {
  it("usa sólo la primera palabra sin modificar el nombre real", () => {
    expect(getCompactProfile("Ignacio Senestrari")).toEqual({
      label: "Ignacio",
      initial: "I",
    });
  });

  it("respeta un nombre corto configurado", () => {
    expect(getCompactProfile("  Nacho  ")).toEqual({
      label: "Nacho",
      initial: "N",
    });
  });

  it.each([null, undefined, "", "   "])(
    "usa Perfil sin inicial cuando falta display name",
    (displayName) => {
      expect(getCompactProfile(displayName)).toEqual({
        label: "Perfil",
        initial: null,
      });
    },
  );
});

describe("cabecera mobile de Home", () => {
  it("enlaza al hub existente de perfil y ajustes", () => {
    expect(HOME_SETTINGS_HREF).toBe("/settings");
  });

  it("presenta la fecha como metadata breve", () => {
    expect(mobileHomeDateLabel("2026-08-11")).toBe("11 de agosto");
  });
});
