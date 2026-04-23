import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
});

const baseConfig: NextConfig = {
  reactStrictMode: true,
};

// En desarrollo no envolvemos con PWA: el plugin añade Webpack y choca con Turbopack (`next dev`).
// En `next build` NODE_ENV es `production` y sí aplicamos PWA (el build sigue usando `next build --webpack`).
const isDev = process.env.NODE_ENV === "development";

export default isDev ? baseConfig : withPWA(baseConfig);
