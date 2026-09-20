export const MOBILE_DAILY_METRICS_API_PATH =
  "/api/mobile/v1/daily-metrics" as const;
export const MOBILE_HOME_API_PATH = "/api/mobile/v1/home" as const;

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
  trainingDays: string[];
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
    week: MobileReadResult<{
      summary: MobileHomeWeekDto;
      todaySessions: MobileHomeTodaySessionDto[];
    }>;
  };
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

export type MobileApiErrorCode = "UNAUTHORIZED" | "DATA_UNAVAILABLE";

export type MobileApiErrorResponse = {
  error: MobileApiErrorCode;
};
