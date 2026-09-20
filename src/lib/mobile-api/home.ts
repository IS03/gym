import type { HomeActiveSessionSummary } from "@/lib/home-dashboard";
import type { Profile } from "@/lib/phase1/profile";
import type {
  CompletedSessionSummary,
  WeeklyTrainingSummary,
} from "@/lib/phase2/types";
import type { ReadResult } from "@/lib/resilient-read";
import { handleMobileAuthenticatedRequest } from "./auth";
import type {
  MobileApiErrorResponse,
  MobileHomeResponse,
  MobileReadResult,
} from "./contracts";

export type MobileHomeNutritionSource = {
  dayLog: {
    total_calories_consumed: number | null;
    total_protein_g: number | null;
  };
  mealCount: number;
  context: {
    targets: {
      calories: number | null;
      proteinG: number | null;
      waterL: number | null;
    };
    consumption: { waterL: number | null };
    metrics: { energyBalanceKcal: number | null };
  };
};

export type MobileHomeTrainingSource = {
  currentWeek: WeeklyTrainingSummary;
  todaySessions: CompletedSessionSummary[];
};

export type MobileHomeSources = {
  profile: ReadResult<Profile | null>;
  nutrition: ReadResult<MobileHomeNutritionSource>;
  activeSession: ReadResult<HomeActiveSessionSummary | null>;
  training: ReadResult<MobileHomeTrainingSource>;
};

function mapReadResult<T, U>(
  result: ReadResult<T>,
  transform: (data: T) => U,
): MobileReadResult<U> {
  return result.status === "ok"
    ? { status: "ok", data: transform(result.data) }
    : { status: "unavailable" };
}

export class MobileHomeUnavailableError extends Error {
  constructor() {
    super("Mobile Home unavailable");
    this.name = "MobileHomeUnavailableError";
  }
}

export function buildMobileHomeResponse(
  date: string,
  sources: MobileHomeSources,
): MobileHomeResponse {
  const allProductSourcesUnavailable =
    sources.nutrition.status === "unavailable" &&
    sources.activeSession.status === "unavailable" &&
    sources.training.status === "unavailable";

  if (allProductSourcesUnavailable) {
    throw new MobileHomeUnavailableError();
  }

  return {
    date,
    profile: mapReadResult(sources.profile, (profile) => ({
      displayName: profile?.display_name?.trim() || null,
    })),
    nutrition: mapReadResult(sources.nutrition, ({ dayLog, mealCount, context }) => ({
      calories: dayLog.total_calories_consumed ?? 0,
      calorieTarget: context.targets.calories,
      proteinG: dayLog.total_protein_g ?? 0,
      proteinTargetG: context.targets.proteinG,
      mealCount,
      waterL: context.consumption.waterL,
      waterTargetL: context.targets.waterL,
      energyBalanceKcal: context.metrics.energyBalanceKcal,
    })),
    training: {
      activeSession: mapReadResult(sources.activeSession, (session) =>
        session
          ? {
              id: session.id,
              name: session.name,
              logDate: session.logDate,
              startedAt: session.startedAt,
              exercisesCompleted: session.exercisesCompleted,
              totalExercises: session.totalExercises,
              completedSets: session.completedSets,
              totalSets: session.totalSets,
              progressPercent: session.progressPercent,
            }
          : null,
      ),
      week: mapReadResult(sources.training, ({ currentWeek, todaySessions }) => ({
        summary: {
          weekStart: currentWeek.weekStart,
          weekEnd: currentWeek.weekEnd,
          sessions: currentWeek.sessions,
          sets: currentWeek.sets,
          minutes: currentWeek.minutes,
          trainingDays: currentWeek.trainingDays,
        },
        todaySessions: todaySessions.map((session) => ({
          id: session.id,
          name: session.routineName,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          durationMilliseconds: session.durationMilliseconds,
          exercisesCompleted: session.exercisesCompleted,
          completedSets: session.completedSets,
          status: "completed" as const,
        })),
      })),
    },
  };
}

export type MobileHomeHandlerResult =
  | { status: 200; body: MobileHomeResponse }
  | { status: 401 | 503; body: MobileApiErrorResponse };

export async function handleMobileHomeRequest<TContext>(
  authorization: string | null,
  dependencies: {
    authenticate: (accessToken: string) => Promise<TContext>;
    read: (context: TContext) => Promise<MobileHomeResponse>;
  },
): Promise<MobileHomeHandlerResult> {
  return handleMobileAuthenticatedRequest(authorization, dependencies);
}
