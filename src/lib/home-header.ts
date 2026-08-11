export const HOME_SETTINGS_HREF = "/settings";

export type CompactProfile = {
  label: string;
  initial: string | null;
};

export function getCompactProfile(displayName: string | null | undefined): CompactProfile {
  const normalized = displayName?.trim();

  if (!normalized) {
    return { label: "Perfil", initial: null };
  }

  const label = normalized.split(/\s+/u)[0];
  const initial = Array.from(label)[0]?.toLocaleUpperCase("es-AR") ?? null;

  return { label, initial };
}

export function mobileHomeDateLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(`${date}T12:00:00Z`));
}
