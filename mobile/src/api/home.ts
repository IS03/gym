import {
  MOBILE_HOME_API_PATH,
  type MobileHomeActiveSessionDto,
  type MobileHomeNutritionDto,
  type MobileHomeProfileDto,
  type MobileHomeResponse,
  type MobileHomeTodaySessionDto,
  type MobileHomeWeekDto,
  type MobileReadResult,
} from "../../../src/lib/mobile-api/contracts";
import {
  defaultMobileApiDependencies,
  fetchMobileApiJson,
  type MobileApiClientDependencies,
} from "./client";

export type MobileHomeResult =
  | { status: "ok"; data: MobileHomeResponse }
  | { status: "unauthorized" }
  | { status: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    isNonNegativeNumber(value)
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isNullableNonNegativeNumber(value: unknown): value is number | null {
  return value === null || isNonNegativeNumber(value);
}

function parseReadResult<T>(
  value: unknown,
  parse: (data: unknown) => T | undefined,
): MobileReadResult<T> | null {
  if (!isRecord(value) || value.status === "unavailable") {
    return isRecord(value) && value.status === "unavailable"
      ? { status: "unavailable" }
      : null;
  }
  if (value.status !== "ok" || !("data" in value)) return null;
  const data = parse(value.data);
  return data === undefined ? null : { status: "ok", data };
}

function parseProfile(value: unknown): MobileHomeProfileDto | null {
  if (
    !isRecord(value) ||
    !(typeof value.displayName === "string" || value.displayName === null)
  ) {
    return null;
  }
  return { displayName: value.displayName };
}

function parseNutrition(value: unknown): MobileHomeNutritionDto | null {
  if (
    !isRecord(value) ||
    !isNonNegativeNumber(value.calories) ||
    !isNullableNonNegativeNumber(value.calorieTarget) ||
    !isNonNegativeNumber(value.proteinG) ||
    !isNullableNonNegativeNumber(value.proteinTargetG) ||
    !isCount(value.mealCount) ||
    !isNullableNonNegativeNumber(value.waterL) ||
    !isNullableNonNegativeNumber(value.waterTargetL) ||
    !isNullableFiniteNumber(value.energyBalanceKcal)
  ) {
    return null;
  }
  return {
    calories: value.calories,
    calorieTarget: value.calorieTarget,
    proteinG: value.proteinG,
    proteinTargetG: value.proteinTargetG,
    mealCount: value.mealCount,
    waterL: value.waterL,
    waterTargetL: value.waterTargetL,
    energyBalanceKcal: value.energyBalanceKcal,
  };
}

function parseActiveSession(value: unknown): MobileHomeActiveSessionDto | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !isIsoDate(value.logDate) ||
    typeof value.startedAt !== "string" ||
    !isCount(value.exercisesCompleted) ||
    !isCount(value.totalExercises) ||
    !isCount(value.completedSets) ||
    !isCount(value.totalSets) ||
    !isCount(value.progressPercent) ||
    value.progressPercent > 100
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    logDate: value.logDate,
    startedAt: value.startedAt,
    exercisesCompleted: value.exercisesCompleted,
    totalExercises: value.totalExercises,
    completedSets: value.completedSets,
    totalSets: value.totalSets,
    progressPercent: value.progressPercent,
  };
}

function parseNullableActiveSession(
  value: unknown,
): MobileHomeActiveSessionDto | null | undefined {
  if (value === null) return null;
  return parseActiveSession(value) ?? undefined;
}

function parseWeek(value: unknown): MobileHomeWeekDto | null {
  if (
    !isRecord(value) ||
    !isIsoDate(value.weekStart) ||
    !isIsoDate(value.weekEnd) ||
    !isCount(value.sessions) ||
    !isCount(value.sets) ||
    !isNonNegativeNumber(value.minutes) ||
    !Array.isArray(value.trainingDays) ||
    !value.trainingDays.every(isIsoDate)
  ) {
    return null;
  }
  return {
    weekStart: value.weekStart,
    weekEnd: value.weekEnd,
    sessions: value.sessions,
    sets: value.sets,
    minutes: value.minutes,
    trainingDays: [...value.trainingDays],
  };
}

function parseTodaySession(value: unknown): MobileHomeTodaySessionDto | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.startedAt !== "string" ||
    typeof value.endedAt !== "string" ||
    !isNullableNonNegativeNumber(value.durationMilliseconds) ||
    !isCount(value.exercisesCompleted) ||
    !isCount(value.completedSets) ||
    value.status !== "completed"
  ) {
    return null;
  }
  return {
    id: value.id,
    name: value.name,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    durationMilliseconds: value.durationMilliseconds,
    exercisesCompleted: value.exercisesCompleted,
    completedSets: value.completedSets,
    status: "completed",
  };
}

function parseWeekBlock(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.todaySessions)) return null;
  const summary = parseWeek(value.summary);
  const todaySessions = value.todaySessions.map(parseTodaySession);
  if (!summary || todaySessions.some((session) => session === null)) return null;
  return {
    summary,
    todaySessions: todaySessions as MobileHomeTodaySessionDto[],
  };
}

export function parseMobileHomeResponse(value: unknown): MobileHomeResponse | null {
  if (!isRecord(value) || !isIsoDate(value.date) || !isRecord(value.training)) {
    return null;
  }

  const profile = parseReadResult(
    value.profile,
    (data) => parseProfile(data) ?? undefined,
  );
  const nutrition = parseReadResult(
    value.nutrition,
    (data) => parseNutrition(data) ?? undefined,
  );
  const activeSession = parseReadResult(
    value.training.activeSession,
    (data) => {
      const parsed = parseNullableActiveSession(data);
      return parsed === undefined ? null : parsed;
    },
  );
  const week = parseReadResult(
    value.training.week,
    (data) => parseWeekBlock(data) ?? undefined,
  );
  if (!profile || !nutrition || !activeSession || !week) return null;

  return {
    date: value.date,
    profile,
    nutrition,
    training: { activeSession, week },
  };
}

export async function fetchMobileHome(
  dependencies: MobileApiClientDependencies = defaultMobileApiDependencies,
): Promise<MobileHomeResult> {
  const result = await fetchMobileApiJson(MOBILE_HOME_API_PATH, dependencies);
  if (result.status !== "ok") return result;

  const data = parseMobileHomeResponse(result.data);
  return data ? { status: "ok", data } : { status: "unavailable" };
}
