import { Apple, CookingPot } from "lucide-react";
import { SettingsHeader, SettingsRow, SettingsSection } from "../settings-components";

export default function LibrarySettingsPage() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <SettingsHeader
        title="Biblioteca"
        description="Alimentos y comidas que guardaste para registrar más rápido."
        backHref="/settings"
      />
      <SettingsSection title="Nutrición">
        <SettingsRow
          href="/settings/nutrition/foods"
          icon={Apple}
          title="Alimentos"
          description="Porciones y valores nutricionales por cantidad"
        />
        <SettingsRow
          href="/settings/nutrition/meals"
          icon={CookingPot}
          title="Comidas guardadas"
          description="Preparaciones habituales listas para reutilizar"
        />
      </SettingsSection>
    </div>
  );
}
