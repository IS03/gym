import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  TrainingAnalysisWorkspace,
} from "@/components/training/training-analysis-workspace";
import { isTrainingAnalysisPeriod } from "@/lib/phase2/training-analysis";
import { isTrainingAnalysisView } from "@/lib/phase2/training-analysis-navigation";
import { getTrainingAnalysis } from "@/lib/phase2/training-robust";

export const dynamic = "force-dynamic";

export default async function TrainingProgressPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const rawView = typeof sp.view === "string" ? sp.view : null;
  const rawPeriod = typeof sp.period === "string" ? sp.period : null;
  const view = isTrainingAnalysisView(rawView) ? rawView : "general";
  const period = isTrainingAnalysisPeriod(rawPeriod) ? rawPeriod : "8w";
  const analysis = await getTrainingAnalysis(period);
  const requestedRoutine = typeof sp.routine === "string" ? sp.routine : null;
  const requestedMuscle = typeof sp.muscle === "string" ? sp.muscle : null;
  const exerciseQuery = typeof sp.query === "string" ? sp.query : undefined;
  const exerciseRoutineId = typeof sp.routine_filter === "string" ? sp.routine_filter : undefined;
  const exerciseMuscleKey = typeof sp.muscle_filter === "string" ? sp.muscle_filter : undefined;
  const routineId = requestedRoutine && analysis.routines.some((routine) => routine.id === requestedRoutine) ? requestedRoutine : null;
  const muscleKey = requestedMuscle && analysis.muscles.some((muscle) => muscle.key === requestedMuscle) ? requestedMuscle : null;

  return <div className="space-y-6 lg:mx-auto lg:max-w-6xl">
    <header className="space-y-3">
      <Link href="/progress" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Progreso
      </Link>
      <div>
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Progreso de entrenamiento</h1>
      <p className="mt-1 text-sm text-muted-foreground">Analizá tus sesiones finalizadas, rutinas, músculos y ejercicios.</p>
      </div>
    </header>
    <TrainingAnalysisWorkspace analysis={analysis} view={view} routineId={routineId} muscleKey={muscleKey} exerciseQuery={exerciseQuery} exerciseRoutineId={exerciseRoutineId} exerciseMuscleKey={exerciseMuscleKey} />
  </div>;
}
