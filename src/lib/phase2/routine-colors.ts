export const ROUTINE_COLOR_KEYS = [
  "violet",
  "indigo",
  "blue",
  "cyan",
  "green",
  "yellow",
  "orange",
  "rose",
] as const;

export type RoutineColorKey = (typeof ROUTINE_COLOR_KEYS)[number];

export type RoutineColorPreset = {
  key: RoutineColorKey;
  label: string;
  cssVariable: `--routine-${RoutineColorKey}`;
};

export const ROUTINE_COLOR_PRESETS: readonly RoutineColorPreset[] = [
  { key: "violet", label: "Violeta", cssVariable: "--routine-violet" },
  { key: "indigo", label: "Índigo", cssVariable: "--routine-indigo" },
  { key: "blue", label: "Azul", cssVariable: "--routine-blue" },
  { key: "cyan", label: "Celeste", cssVariable: "--routine-cyan" },
  { key: "green", label: "Verde", cssVariable: "--routine-green" },
  { key: "yellow", label: "Amarillo", cssVariable: "--routine-yellow" },
  { key: "orange", label: "Naranja", cssVariable: "--routine-orange" },
  { key: "rose", label: "Rosa", cssVariable: "--routine-rose" },
];

export const LEGACY_ROUTINE_COLOR_TO_KEY = {
  "#a855f7": "violet",
  "#3b82f6": "blue",
  "#06b6d4": "cyan",
  "#22c55e": "green",
  "#eab308": "yellow",
  "#f97316": "orange",
  "#ef4444": "rose",
} as const satisfies Record<string, RoutineColorKey>;

const presetsByKey = new Map(ROUTINE_COLOR_PRESETS.map((preset) => [preset.key, preset]));

export function isRoutineColorKey(value: unknown): value is RoutineColorKey {
  return typeof value === "string" && presetsByKey.has(value as RoutineColorKey);
}

/** Missing or legacy values resolve visually to OWNLEVEL violet without changing persistence. */
export function resolveRoutineColor(value: unknown): RoutineColorKey {
  return isRoutineColorKey(value) ? value : "violet";
}

export function assertRoutineColor(value: unknown): RoutineColorKey | null {
  if (value === null || value === undefined || value === "") return null;
  if (isRoutineColorKey(value)) return value;
  throw new Error("Elegí un color de rutina válido.");
}

export function normalizeLegacyRoutineColor(value: string | null): RoutineColorKey | null {
  if (value === null) return null;
  return LEGACY_ROUTINE_COLOR_TO_KEY[value as keyof typeof LEGACY_ROUTINE_COLOR_TO_KEY] ?? null;
}

export function routineColorLabel(value: unknown): string {
  return presetsByKey.get(resolveRoutineColor(value))!.label;
}

export function routineColorCssVariable(value: unknown): `var(--routine-${RoutineColorKey})` {
  return `var(${presetsByKey.get(resolveRoutineColor(value))!.cssVariable})`;
}
