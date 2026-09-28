export const MOBILE_DAILY_METRICS_API_PATH =
  "/api/mobile/v1/daily-metrics" as const;
export const MOBILE_HOME_API_PATH = "/api/mobile/v1/home" as const;
export const MOBILE_NUTRITION_TODAY_API_PATH =
  "/api/mobile/v1/nutrition/today" as const;
export const MOBILE_NUTRITION_MEALS_API_PATH =
  "/api/mobile/v1/nutrition/meals" as const;
export const MOBILE_TRAINING_API_PATH = "/api/mobile/v1/training" as const;
export const MOBILE_TRAINING_ROUTINES_API_PATH =
  "/api/mobile/v1/training/routines" as const;
export const MOBILE_TRAINING_INITIAL_PLAN_API_PATH =
  "/api/mobile/v1/training/routines/initial-plan" as const;
export const MOBILE_TRAINING_EXERCISES_API_PATH =
  "/api/mobile/v1/training/exercises" as const;

export function mobileNutritionMealApiPath(id: string) {
  return `${MOBILE_NUTRITION_MEALS_API_PATH}/${encodeURIComponent(id)}` as const;
}

export function mobileTrainingRoutineApiPath(id: string) {
  return `${MOBILE_TRAINING_ROUTINES_API_PATH}/${encodeURIComponent(id)}` as const;
}

export function mobileTrainingExerciseApiPath(id: string) {
  return `${MOBILE_TRAINING_EXERCISES_API_PATH}/${encodeURIComponent(id)}` as const;
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

export type MobileTrainingActiveSessionDto = {
  id: string;
  name: string;
  logDate: string;
};

export type MobileTrainingCalendarDayDto = {
  date: string;
  colors: MobileRoutineColorKey[];
};

export type MobileTrainingResponse = {
  activeSession: MobileReadResult<MobileTrainingActiveSessionDto | null>;
  calendar: MobileReadResult<{
    month: string;
    days: MobileTrainingCalendarDayDto[];
  }>;
};

export type MobileTrainingRoutineDto = {
  id: string;
  name: string;
  color: MobileRoutineColorKey | null;
  order: number;
  isActive: boolean;
  exerciseCount: number;
  setCount: number;
};

export type MobileTrainingRoutinesResponse = {
  routines: MobileReadResult<MobileTrainingRoutineDto[]>;
  initialPlan: MobileReadResult<{
    imported: boolean;
    routinesFound: number;
  }>;
};

export type MobileTrainingRoutineCreatePayload = {
  name: string;
  color: MobileRoutineColorKey | null;
  idempotencyKey: string;
};

export type MobileTrainingRoutineCreateResponse = {
  routine: MobileTrainingRoutineDto;
};

export type MobileTrainingRoutineStatusPayload = {
  isActive: boolean;
};

export type MobileTrainingRoutineStatusResponse = {
  routine: {
    id: string;
    isActive: boolean;
    updatedAt: string;
  };
};

export type MobileTrainingInitialPlanResponse = {
  routines: number;
  exercises: number;
};

export type MobileTrainingMuscleGroup =
  | "pecho"
  | "espalda"
  | "piernas"
  | "hombros"
  | "bíceps"
  | "tríceps"
  | "abdomen"
  | "cardio";

export type MobileTrainingExerciseMutationDto = {
  name: string;
  muscleGroup: MobileTrainingMuscleGroup | null;
  muscleGroupLabel: string | null;
  implement: string | null;
  weightMode: string | null;
  suggestedSets: number | null;
  suggestedReps: number | null;
  suggestedWeight: number | null;
  suggestedRir: number | null;
  suggestedRestMinSeconds: number | null;
  suggestedRestMaxSeconds: number | null;
  notes: string | null;
};

export type MobileTrainingExerciseDto = MobileTrainingExerciseMutationDto & {
  id: string;
  isActive: boolean;
  routineIds: string[];
  updatedAt: string;
};

export type MobileTrainingActiveRoutineDto = {
  id: string;
  name: string;
  color: MobileRoutineColorKey | null;
};

export type MobileTrainingExercisesResponse = {
  catalog: MobileReadResult<{
    exercises: MobileTrainingExerciseDto[];
    routines: MobileTrainingActiveRoutineDto[];
  }>;
};

export type MobileTrainingExerciseCreatePayload = {
  exercise: MobileTrainingExerciseMutationDto;
  routineIds: [] | [string];
  idempotencyKey: string;
};

export type MobileTrainingExerciseMutationResponse = {
  exercise: MobileTrainingExerciseDto;
  warning?: string;
};

export type MobileTrainingExerciseUpdatePayload = {
  operation: "update";
  exercise: MobileTrainingExerciseMutationDto;
  routineIds: string[];
};

export type MobileTrainingExerciseStatusPayload = {
  operation: "set_status";
  isActive: boolean;
};

export type MobileTrainingExerciseStatusResponse = {
  exercise: {
    id: string;
    isActive: boolean;
    updatedAt: string;
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
  | "IDEMPOTENCY_KEY_REUSED"
  | "DATA_UNAVAILABLE";

export type MobileApiErrorResponse = {
  error: MobileApiErrorCode;
  message?: string;
};
