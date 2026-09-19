import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const mobileRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, "");

  return {
    root: mobileRoot,
    base: "./",
    plugins: [react()],
    define: {
      __OWNLEVEL_SUPABASE_URL__: JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      ),
      __OWNLEVEL_SUPABASE_ANON_KEY__: JSON.stringify(
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
      ),
      __OWNLEVEL_API_BASE_URL__: JSON.stringify(
        env.NEXT_PUBLIC_OWNLEVEL_API_BASE_URL ?? "https://www.ownlevel.fit",
      ),
    },
    build: {
      outDir: fileURLToPath(new URL("../mobile-dist", import.meta.url)),
      emptyOutDir: true,
    },
  };
});
