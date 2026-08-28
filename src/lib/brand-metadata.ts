import type { Metadata, MetadataRoute } from "next";
import { brandAssets } from "./brand";

export const ownlevelMetadata = {
  title: {
    default: "OWNLEVEL",
    template: "%s · OWNLEVEL",
  },
  description: "Seguimiento personal de nutrición y entrenamiento.",
  applicationName: "OWNLEVEL",
  appleWebApp: {
    capable: true,
    title: "OWNLEVEL",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
} satisfies Metadata;

export function ownlevelManifest(): MetadataRoute.Manifest {
  return {
    name: "OWNLEVEL",
    short_name: "OWNLEVEL",
    description: "Seguimiento personal de nutrición y entrenamiento.",
    start_url: "/home",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d0d12",
    theme_color: "#0d0d12",
    lang: "es",
    icons: [
      {
        src: brandAssets.appIcon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brandAssets.appIcon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
