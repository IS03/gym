export const MOBILE_DAILY_METRICS_API_PATH =
  "/api/mobile/v1/daily-metrics" as const;
export const MOBILE_HOME_API_PATH = "/api/mobile/v1/home" as const;
export const MOBILE_NUTRITION_TODAY_API_PATH =
  "/api/mobile/v1/nutrition/today" as const;
export const MOBILE_NUTRITION_MEALS_API_PATH =
  "/api/mobile/v1/nutrition/meals" as const;

export function mobileNutritionMealApiPath(id: string) {
  return `${MOBILE_NUTRITION_MEALS_API_PATH}/${encodeURIComponent(id)}` as const;
}

export type MobileReadResult<T> =
  | { status: "ok"; data: T }
  | { status: "unavailable" };

export type MobileHomeProfileDto = {
  displayName: string | null;
};

export type MobileHomeActiveSessionDto = {
  id: string;
  name: string;
  logDate: string;
  startedAt: string;
  exercisesCompleted: number;
  totalExercises: number;
  completedSets: number;
  totalSets: number;
  progressPercent: number;
};

export type MobileHomeNutritionDto = {
  calories: number;
  calorieTarget: number | null;
  proteinG: number;
  proteinTargetG: number | null;
  mealCount: number;
  waterL: number | null;
  waterTargetL: number | null;
  energyBalanceKcal: number | null;
};

export type MobileHomeWeekDto = {
  weekStart: string;
  weekEnd: string;
  sessions: number;
  sets: number;
  minutes: number;
  // M2 fields are emitted by the current server. Optional typing keeps
  // installed/legacy v1 clients source-compatible with this additive DTO.
  routines?: Record<string, number>;
  muscleGroups?: Record<string, number>;
  trainingDays: string[];
};

export type MobileRoutineColorKey =
  | "violet"
  | "indigo"
  | "blue"
  | "cyan"
  | "green"
  | "yellow"
  | "orange"
  | "rose";

export type MobileHomeWorkoutStartRoutineDto = {
  id: string;
  name: string;
  color: MobileRoutineColorKey | null;
  exerciseCount: number;
  setCount: number;
};

export type MobileHomeTodaySessionDto = {
  id: string;
  name: string;
  startedAt: string;
  endedAt: string;
  durationMilliseconds: number | null;
  exercisesCompleted: number;
  completedSets: number;
  status: "completed";
};

export type MobileHomeResponse = {
  date: string;
  profile: MobileReadResult<MobileHomeProfileDto>;
  nutrition: MobileReadResult<MobileHomeNutritionDto>;
  training: {
    activeSession: MobileReadResult<MobileHomeActiveSessionDto | null>;
    // Emitted by the current server; optional for additive v1 compatibility.
    workoutStartRoutines?: MobileReadResult<MobileHomeWorkoutStartRoutineDto[]>;
    week: MobileReadResult<{
      summary: MobileHomeWeekDto;
      todaySessions: MobileHomeTodaySessionDto[];
    }>;
  };
};

export type MobileNutritionSummaryDto = {
  calories: number;
  calorieTarget: number | null;
  proteinG: number;
  proteinTargetG: number | null;
  carbsG: number;
  fatG: number;
  mealCount: number;
  waterL: number | null;
  waterTargetL: number | null;
  energyBalanceKcal: number | null;
};

export type MobileMealDto = {
  id: string;
  title: string | null;
  description: string | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  consumedAt: string;
  updatedAt: string;
};

export type MobileNutritionTodayResponse = {
  date: string;
  summary: MobileReadResult<MobileNutritionSummaryDto>;
  meals: MobileReadResult<MobileMealDto[]>;
};

export type MobileMealMutationPayload = {
  title: string;
  description: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
  idempotencyKey?: string;
};

export type MobileMealMutationResponse = {
  meal: MobileMealDto;
};

export type MobileMealDeleteResponse = {
  deleted: true;
};

export type MobileMetricValueType = "integer" | "decimal" | "duration";

export type MobileDailyMetricDto = {
  id: string;
  key: string | null;
  label: string;
  unit: string | null;
  valueType: MobileMetricValueType;
  value: number;
};

export type MobileDailyMetricsResponse = {
  date: string;
  metrics: MobileDailyMetricDto[];
};

export type MobileApiErrorCode =
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "DATA_UNAVAILABLE";

export type MobileApiErrorResponse = {
  error: MobileApiErrorCode;
  message?: string;
};
