import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brandAssets, brandSymbolSources } from "./brand";
import { ownlevelManifest, ownlevelMetadata } from "./brand-metadata";

describe("identidad OWNLEVEL", () => {
  it("usa la variante violeta oscura sobre UI clara y lavanda sobre UI oscura", () => {
    expect(brandSymbolSources).toEqual({
      light: "/brand/ownlevel-symbol-on-light.png",
      dark: "/brand/ownlevel-symbol-on-dark.png",
    });
  });

  it("incluye todos los assets de marca locales", () => {
    for (const assetPath of Object.values(brandAssets)) {
      expect(existsSync(join(process.cwd(), "public", assetPath))).toBe(true);
    }
    expect(existsSync(join(process.cwd(), "src/app/favicon.ico"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/icon.png"))).toBe(true);
    expect(existsSync(join(process.cwd(), "src/app/apple-icon.png"))).toBe(true);
  });

  it("expone OWNLEVEL en metadata y manifest", () => {
    expect(ownlevelMetadata.applicationName).toBe("OWNLEVEL");
    expect(ownlevelMetadata.title).toMatchObject({
      default: "OWNLEVEL",
      template: "%s · OWNLEVEL",
    });

    expect(ownlevelManifest()).toMatchObject({
      name: "OWNLEVEL",
      short_name: "OWNLEVEL",
      start_url: "/home",
      background_color: "#0d0d12",
      theme_color: "#0d0d12",
      icons: [
        { src: brandAssets.appIcon192, sizes: "192x192", purpose: "any" },
        { src: brandAssets.appIcon512, sizes: "512x512", purpose: "any" },
      ],
    });
  });

  it("elimina Appgym de la identidad visible del login", () => {
    const loginSource = readFileSync(
      join(process.cwd(), "src/app/(auth)/login/login-form.tsx"),
      "utf8",
    );
    expect(loginSource).not.toContain("Appgym");
    expect(loginSource).toContain("brandAssets.lockupMobile");
    expect(loginSource).toContain("brandAssets.lockupHorizontal");
  });
});
