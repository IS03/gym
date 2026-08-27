import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { SECURITY_HEADERS } from "./src/lib/security/headers";

if (
  process.env.VERCEL === "1" &&
  !process.env.SUPABASE_SECRET_KEY &&
  !process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  throw new Error("Falta la credencial server-only de Supabase para la API privada.");
}

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  // OWNLEVEL muestra datos privados autenticados: las navegaciones, respuestas
  // RSC y APIs deben venir siempre de la red, nunca de un cache compartido del SW.
  cacheOnFrontEndNav: false,
  reloadOnOnline: true,
  extendDefaultRuntimeCaching: true,
  workboxOptions: {
    runtimeCaching: [
      {
        urlPattern: ({ sameOrigin, url }) =>
          sameOrigin && url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "apis" },
      },
      {
        urlPattern: ({ request, sameOrigin, url }) =>
          sameOrigin &&
          request.headers.get("RSC") === "1" &&
          request.headers.get("Next-Router-Prefetch") === "1" &&
          !url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "pages-rsc-prefetch" },
      },
      {
        urlPattern: ({ request, sameOrigin, url }) =>
          sameOrigin &&
          request.headers.get("RSC") === "1" &&
          !url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "pages-rsc" },
      },
      {
        urlPattern: ({ request, sameOrigin, url }) =>
          sameOrigin &&
          request.mode === "navigate" &&
          !url.pathname.startsWith("/api/"),
        handler: "NetworkOnly",
        method: "GET",
        options: { cacheName: "pages" },
      },
    ],
  },
});

const baseConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

// En desarrollo no envolvemos con PWA: el plugin añade Webpack y choca con Turbopack (`next dev`).
// En `next build` NODE_ENV es `production` y sí aplicamos PWA (el build sigue usando `next build --webpack`).
const isDev = process.env.NODE_ENV === "development";

export default isDev ? baseConfig : withPWA(baseConfig);
