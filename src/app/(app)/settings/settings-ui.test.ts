import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const profile = source("src/app/(app)/settings/profile-form.tsx");
const profilePage = source("src/app/(app)/settings/profile/page.tsx");
const theme = source("src/app/(app)/settings/theme-settings.tsx");
const settings = source("src/app/(app)/settings/page.tsx");

describe("PR 16 — Perfil y Apariencia", () => {
  it("usa la misma grilla responsive para los dos pares de Perfil", () => {
    expect(profile.match(/min-\[430px\]:grid-cols-2/g)).toHaveLength(2);
    expect(profile).toContain("min-w-0");
    expect(profilePage).toContain("mx-auto w-full max-w-2xl");
    expect(profilePage).toContain('<Card className="w-full">');
  });

  it("mantiene el placeholder de hydration y compacta el selector de tema sin reducir su touch target", () => {
    expect(theme).toContain("const [mounted, setMounted]");
    expect(theme).toContain('className="h-10 rounded-lg border bg-muted/40"');
    expect(theme).toContain('role="group" aria-label="Tema"');
    expect(theme).toContain("aria-pressed={theme === id}");
    expect(theme).toContain("theme === \"system\"");
    expect(theme).toContain("setTheme(id)");
    expect(theme).toContain("h-10");
    expect(settings).toContain(">Tema</p>");
    expect(settings).toContain('className="flex min-h-20 items-center gap-3 py-3"');
    expect(settings).not.toContain('<CardTitle className="text-base">Apariencia</CardTitle>');
  });
});
