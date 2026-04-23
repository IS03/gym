import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Appgym",
    short_name: "Appgym",
    description: "Seguimiento personal de nutrición y entrenamiento.",
    start_url: "/today",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: "es",
  };
}
