import "server-only";

import { getNutritionDaySummary } from "@/lib/nutrition/day";
import { getMyProfile } from "@/lib/phase1/profile";
import { listWorkoutStartRoutines } from "@/lib/phase2/training";
import {
  getHomeActiveTrainingSnapshot,
  getHomeTrainingSnapshot,
} from "@/lib/phase2/training-robust";
import type { RequestPerformanceContext } from "@/lib/request-performance";
import { resilientRead } from "@/lib/resilient-read";
import type { AuthenticatedRequestContext } from "@/lib/supabase/server";
import { buildMobileHomeResponse } from "./home";
import type { MobileSupabaseAuthenticatedContext } from "./supabase";

export async function readMobileHome(
  date: string,
  context: MobileSupabaseAuthenticatedContext,
  requestPerformance: RequestPerformanceContext,
) {
  const auth: AuthenticatedRequestContext = {
    supabase: context.supabase,
    userId: context.userId,
    requestPerformance,
  };
  const performanceBase = {
    route: "/api/mobile/v1/home",
    layer: "database" as const,
    ...requestPerformance,
  };

  const [profile, nutrition, activeSession, training, workoutStartRoutines] =
    await Promise.all([
      resilientRead(
        { ...performanceBase, operation: "mobile.home.profile" },
        () => getMyProfile(auth),
      ),
      resilientRead(
        { ...performanceBase, operation: "mobile.home.nutrition" },
        () => getNutritionDaySummary(date, auth),
      ),
      resilientRead(
        { ...performanceBase, operation: "mobile.home.active-session" },
        () => getHomeActiveTrainingSnapshot(auth),
      ),
      resilientRead(
        { ...performanceBase, operation: "mobile.home.training" },
        () => getHomeTrainingSnapshot(date, auth),
      ),
      resilientRead(
        { ...performanceBase, operation: "mobile.home.routines" },
        () => listWorkoutStartRoutines(auth),
      ),
    ]);

  return buildMobileHomeResponse(date, {
    profile,
    nutrition,
    activeSession,
    training,
    workoutStartRoutines,
  });
}
