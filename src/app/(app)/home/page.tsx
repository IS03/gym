import { HomeDashboard } from "@/components/home/home-dashboard";
import { getCompactProfile } from "@/lib/home-header";
import { getNutritionDaySummary } from "@/lib/nutrition/day";
import { getMyProfile } from "@/lib/phase1/profile";
import { listWorkoutStartRoutines } from "@/lib/phase2/training";
import {
  getHomeActiveTrainingSnapshot,
  getHomeTrainingSnapshot,
  todayInCordoba,
} from "@/lib/phase2/training-robust";
import { mapReadResult, resilientRead } from "@/lib/resilient-read";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = todayInCordoba();
  const auth = await requireAuthenticatedRequestContext();
  const [profile, todayData, activeSession, training, workoutStartRoutines] =
    await Promise.all([
      resilientRead(
        {
          route: "/home",
          operation: "home.profile",
          layer: "database",
          ...auth.requestPerformance,
        },
        () => getMyProfile(auth),
      ),
      resilientRead(
        {
          route: "/home",
          operation: "home.nutrition",
          layer: "database",
          ...auth.requestPerformance,
        },
        () => getNutritionDaySummary(today, auth),
      ),
      resilientRead(
        {
          route: "/home",
          operation: "home.active-session",
          layer: "database",
          ...auth.requestPerformance,
        },
        () => getHomeActiveTrainingSnapshot(auth),
      ),
      resilientRead(
        {
          route: "/home",
          operation: "home.training",
          layer: "database",
          ...auth.requestPerformance,
        },
        () => getHomeTrainingSnapshot(today, auth),
      ),
      resilientRead(
        {
          route: "/home",
          operation: "home.routines",
          layer: "database",
          ...auth.requestPerformance,
        },
        () => listWorkoutStartRoutines(auth),
      ),
    ]);

  return (
    <HomeDashboard
      today={today}
      profile={getCompactProfile(profile.status === "ok" ? profile.data?.display_name : undefined)}
      activeSession={activeSession}
      workoutStartRoutines={workoutStartRoutines}
      nutrition={mapReadResult(todayData, ({ dayLog, mealCount, context }) => ({
        calories: dayLog.total_calories_consumed ?? 0,
        calorieTarget: context.targets.calories,
        proteinG: dayLog.total_protein_g ?? 0,
        proteinTargetG: context.targets.proteinG,
        mealCount,
        waterL: context.consumption.waterL,
        waterTargetL: context.targets.waterL,
        energyBalanceKcal: context.metrics.energyBalanceKcal,
      }))}
      training={mapReadResult(training, ({ currentWeek, todaySessions }) => ({
        week: currentWeek,
        todaySessions,
      }))}
    />
  );
}
