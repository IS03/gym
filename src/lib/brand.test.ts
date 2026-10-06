import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { palette } from "@brand/tokens";
import { brandAssets, brandSymbolSize, brandSymbolSources } from "./brand";
import { ownlevelManifest, ownlevelMetadata } from "./brand-metadata";

const root = process.cwd();
const canon = (path: string) => join(root, "docs/brand/ownlevel-marca", path);
const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

// Runtime copy → canonical source in docs/brand/ownlevel-marca (must stay byte-identical).
const runtimeCopies: Record<string, string> = {
  "public/brand/icon-192.png": "web/icon-192.png",
  "public/brand/icon-512.png": "web/icon-512.png",
  "public/brand/icon-maskable-512.png": "web/icon-maskable-512.png",
  "public/brand/logo/isotipo-claro.png": "logo/png/isotipo-claro.png",
  "public/brand/logo/isotipo-oscuro.png": "logo/png/isotipo-oscuro.png",
  "src/app/favicon.ico": "web/favicon.ico",
  "src/app/icon.svg": "web/favicon.svg",
  "src/app/apple-icon.png": "web/apple-touch-icon.png",
  "apps/mobile/assets/brand/app-icon/ios/icon-1024.png": "app-icon/ios/icon-1024.png",
  "apps/mobile/assets/brand/app-icon/ios/icon-1024-dark.png": "app-icon/ios/icon-1024-dark.png",
  "apps/mobile/assets/brand/app-icon/ios/icon-1024-tinted.png": "app-icon/ios/icon-1024-tinted.png",
  "apps/mobile/assets/brand/app-icon/android/adaptive-foreground.png": "app-icon/android/adaptive-foreground.png",
  "apps/mobile/assets/brand/app-icon/android/adaptive-monochrome.png": "app-icon/android/adaptive-monochrome.png",
  "apps/mobile/assets/brand/splash/splash-isotipo-claro.png": "splash/splash-isotipo-claro.png",
  "apps/mobile/assets/brand/splash/splash-isotipo-oscuro.png": "splash/splash-isotipo-oscuro.png",
  "apps/mobile/assets/brand/logo/isotipo-claro.png": "logo/png/isotipo-claro.png",
  "apps/mobile/assets/brand/logo/isotipo-oscuro.png": "logo/png/isotipo-oscuro.png",
  "apps/mobile/assets/brand/logo/logo-horizontal-claro.png": "logo/png/logo-horizontal-claro.png",
  "apps/mobile/assets/brand/logo/logo-horizontal-oscuro.png": "logo/png/logo-horizontal-oscuro.png",
};

describe("identidad OWNLEVEL", () => {
  it("usa el isotipo oficial: claro sobre UI clara y oscuro sobre UI oscura", () => {
    expect(brandSymbolSources).toEqual({
      light: "/brand/logo/isotipo-claro.png",
      dark: "/brand/logo/isotipo-oscuro.png",
    });
    const png = readFileSync(join(root, "public", brandSymbolSources.light));
    expect({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }).toEqual(brandSymbolSize);
  });

  it("las copias runtime son idénticas a la fuente canónica de marca", () => {
    for (const [runtime, source] of Object.entries(runtimeCopies)) {
      expect(existsSync(join(root, runtime)), runtime).toBe(true);
      expect(sha(join(root, runtime)), runtime).toBe(sha(canon(source)));
    }
    for (const assetPath of Object.values(brandAssets)) {
      expect(existsSync(join(root, "public", assetPath)), assetPath).toBe(true);
    }
    // One mechanism per asset: App Router file conventions for favicon / icon / apple-icon.
    expect(existsSync(join(root, "src/app/icon.png"))).toBe(false);
  });

  it("expone OWNLEVEL en metadata y manifest con íconos y colores de marca", () => {
    expect(ownlevelMetadata.applicationName).toBe("OWNLEVEL");
    expect(ownlevelMetadata.title).toMatchObject({
      default: "OWNLEVEL",
      template: "%s · OWNLEVEL",
    });

    expect(ownlevelManifest()).toMatchObject({
      name: "OWNLEVEL",
      short_name: "OWNLEVEL",
      start_url: "/home",
      display: "standalone",
      orientation: "portrait",
      lang: "es",
      background_color: "#09090B",
      theme_color: "#09090B",
      icons: [
        { src: brandAssets.appIcon192, sizes: "192x192", purpose: "any" },
        { src: brandAssets.appIcon512, sizes: "512x512", purpose: "any" },
        { src: brandAssets.appIconMaskable512, sizes: "512x512", purpose: "maskable" },
      ],
    });
    expect(ownlevelManifest().background_color).toBe(palette.dark.bg);
  });

  it("Expo usa los assets oficiales: ícono iOS claro/oscuro/teñido, adaptativo Android y splash por modo", () => {
    const expo = JSON.parse(readFileSync(join(root, "apps/mobile/app.json"), "utf8")).expo;
    const splash = expo.plugins.find((plugin: unknown) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen")[1];
    expect(expo.ios.icon).toEqual({
      light: "./assets/brand/app-icon/ios/icon-1024.png",
      dark: "./assets/brand/app-icon/ios/icon-1024-dark.png",
      tinted: "./assets/brand/app-icon/ios/icon-1024-tinted.png",
    });
    expect(expo.android.adaptiveIcon).toEqual({
      backgroundColor: palette.dark.bg,
      foregroundImage: "./assets/brand/app-icon/android/adaptive-foreground.png",
      monochromeImage: "./assets/brand/app-icon/android/adaptive-monochrome.png",
    });
    expect(splash).toMatchObject({
      image: "./assets/brand/splash/splash-isotipo-claro.png",
      imageWidth: 96,
      backgroundColor: palette.light.bg,
      dark: { image: "./assets/brand/splash/splash-isotipo-oscuro.png", backgroundColor: palette.dark.bg },
    });
    const referenced = [expo.icon, expo.web.favicon, ...Object.values(expo.ios.icon), expo.android.adaptiveIcon.foregroundImage,
      expo.android.adaptiveIcon.monochromeImage, splash.image, splash.dark.image] as string[];
    for (const path of referenced) expect(existsSync(join(root, "apps/mobile", path)), path).toBe(true);
  });

  it("usa los símbolos de marca canónicos en la entrada", () => {
    const loginSource = readFileSync(join(root, "src/app/(auth)/login/login-form.tsx"), "utf8");
    expect(loginSource).not.toContain("Appgym");
    expect(loginSource).toContain("brandAssets.symbolOnLight");
    expect(loginSource).toContain("brandAssets.symbolOnDark");
  });
});
