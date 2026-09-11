import { HomeDashboard } from "@/components/home/home-dashboard";
import { getCompactProfile } from "@/lib/home-header";
import { getNutritionDaySummary } from "@/lib/nutrition/day";
import { getMyProfile } from "@/lib/phase1/profile";
import { listWorkoutStartRoutines } from "@/lib/phase2/training";
import { measurePerformance } from "@/lib/request-performance";
import {
  getHomeActiveTrainingSnapshot,
  getHomeTrainingSnapshot,
  todayInCordoba,
} from "@/lib/phase2/training-robust";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = todayInCordoba();
  const auth = await requireAuthenticatedRequestContext();
  const [profile, todayData, activeSession, training, workoutStartRoutines] =
    await Promise.all([
      measurePerformance(
        { route: "/home", operation: "home.profile" },
        () => getMyProfile(auth),
      ),
      measurePerformance(
        { route: "/home", operation: "home.nutrition" },
        () => getNutritionDaySummary(today, auth),
      ),
      measurePerformance(
        { route: "/home", operation: "home.active-session" },
        () => getHomeActiveTrainingSnapshot(auth),
      ),
      measurePerformance(
        { route: "/home", operation: "home.training" },
        () => getHomeTrainingSnapshot(today, auth),
      ),
      measurePerformance(
        { route: "/home", operation: "home.routines" },
        () => listWorkoutStartRoutines(auth),
      ),
    ]);
  const { dayLog, mealCount, context } = todayData;

  return (
    <HomeDashboard
      today={today}
      profile={getCompactProfile(profile?.display_name)}
      activeSession={activeSession}
      workoutStartRoutines={workoutStartRoutines}
      nutrition={{
        calories: dayLog.total_calories_consumed ?? 0,
        calorieTarget: context.targets.calories,
        proteinG: dayLog.total_protein_g ?? 0,
        proteinTargetG: context.targets.proteinG,
        mealCount,
        waterL: context.consumption.waterL,
        waterTargetL: context.targets.waterL,
        energyBalanceKcal: context.metrics.energyBalanceKcal,
      }}
      week={training.currentWeek}
      todaySessions={training.todaySessions}
    />
  );
}
