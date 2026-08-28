import type { RoutineContinuity } from "./types";

const CORDOBA_TIME_ZONE = "America/Argentina/Cordoba";

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00Z`);
}

export function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: CORDOBA_TIME_ZONE,
  })
    .format(dateAtNoon(value))
    .replace(".", "");
}

export function formatRelativeTrainingDays(days: number | null) {
  if (days === null) return "Sin registros";
  if (days <= 0) return "Hoy";
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}

export function daysBetweenIsoDates(fromDate: string, toDate: string) {
  const from = dateAtNoon(fromDate).getTime();
  const to = dateAtNoon(toDate).getTime();
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

export function leastRecentRoutine(items: RoutineContinuity[]) {
  return items
    .filter((item): item is RoutineContinuity & { lastLogDate: string; daysSince: number } =>
      item.lastLogDate !== null && item.daysSince !== null,
    )
    .sort((left, right) => right.daysSince - left.daysSince || left.routineName.localeCompare(right.routineName, "es-AR"))[0] ?? null;
}
