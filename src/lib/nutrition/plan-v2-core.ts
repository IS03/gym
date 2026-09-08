export const ACTIVITY_FACTORS = {
  low: 1.2,
  moderate: 1.25,
  high: 1.35,
} as const;

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS;

export const WEEKDAYS = [
  { value: 1, short: "Lun", label: "Lunes" },
  { value: 2, short: "Mar", label: "Martes" },
  { value: 3, short: "Mié", label: "Miércoles" },
  { value: 4, short: "Jue", label: "Jueves" },
  { value: 5, short: "Vie", label: "Viernes" },
  { value: 6, short: "Sáb", label: "Sábado" },
  { value: 7, short: "Dom", label: "Domingo" },
] as const;

export type WeekdayNumber = (typeof WEEKDAYS)[number]["value"];

export type NutritionWeekdayTarget = {
  weekday: WeekdayNumber;
  calorieTargetKcal: number;
  proteinTargetG: number;
};

export function calculateAgeOnDate(birthDate: string, onDate: string): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split("-").map(Number);
  const [year, month, day] = onDate.split("-").map(Number);
  let age = year - birthYear;
  if (month < birthMonth || (month === birthMonth && day < birthDay)) age -= 1;
  return age;
}

export function estimateBaseExpenditure(bmrKcal: number, activityLevel: ActivityLevel): number {
  return Math.round(bmrKcal * ACTIVITY_FACTORS[activityLevel]);
}

export function resolveV2Energy(input: {
  bmrKcal: number | null;
  activityLevel: ActivityLevel;
  trainingExpenditureDeltaKcal: number;
  workoutStatuses: string[];
}): number | null {
  if (input.bmrKcal == null) return null;
  const completed = input.workoutStatuses.some((status) => status === "completed");
  return estimateBaseExpenditure(input.bmrKcal, input.activityLevel)
    + (completed ? input.trainingExpenditureDeltaKcal : 0);
}

export function resolveV2Targets(input: {
  date: string;
  weekdays: NutritionWeekdayTarget[];
  baseWaterL: number;
  trainingCalorieDeltaKcal: number;
  trainingWaterDeltaL: number;
  workoutStatuses: string[];
}) {
  const weekday = isoWeekday(input.date);
  const target = input.weekdays.find((item) => item.weekday === weekday) ?? null;
  const completed = input.workoutStatuses.some((status) => status === "completed");
  return {
    calories: target ? target.calorieTargetKcal + (completed ? input.trainingCalorieDeltaKcal : 0) : null,
    proteinG: target?.proteinTargetG ?? null,
    waterL: input.baseWaterL + (completed ? input.trainingWaterDeltaL : 0),
    completedTraining: completed,
  };
}

export function isoWeekday(date: string): WeekdayNumber {
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return (day === 0 ? 7 : day) as WeekdayNumber;
}

export function configurationForDate<T extends { effectiveFrom: string }>(periods: T[], date: string): T | null {
  return [...periods]
    .filter((period) => period.effectiveFrom <= date)
    .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0] ?? null;
}
