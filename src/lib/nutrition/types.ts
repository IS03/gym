import type { DayLog, MealEntry } from "@/lib/phase1/types";

export type NutritionWorkSource = "schedule" | "override" | null;
export type NutritionGymSource = "workout" | "override" | "none";

export type NutritionContext = {
  work: {
    effective: boolean | null;
    source: NutritionWorkSource;
  };
  gym: {
    effective: boolean;
    source: NutritionGymSource;
  };
  periodIds: {
    workSchedule: string | null;
    nutritionGoal: string | null;
    expenditureRule: string | null;
  };
  targets: {
    calories: number | null;
    proteinG: number | null;
    waterL: number | null;
  };
  expenditureKcal: number | null;
  consumption: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    waterL: number | null;
    mateL: number | null;
    steps: number | null;
  };
  metrics: {
    deltaVsNutritionTarget: number | null;
    energyBalanceKcal: number | null;
  };
  resolvedAt: string | null;
};

export type ExistingNutritionDay = {
  date: string;
  dayLog: DayLog;
  meals: MealEntry[];
  context: NutritionContext;
};

export type NutritionDayReadModel =
  | ExistingNutritionDay
  | {
      date: string;
      dayLog: null;
      meals: [];
      context: null;
    };

export type ResolvedNutritionContext = Omit<NutritionContext, "resolvedAt"> & {
  dayLogId: string | null;
};
