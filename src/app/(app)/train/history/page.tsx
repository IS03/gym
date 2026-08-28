import Link from "next/link";
import { cn } from "@/lib/utils";
import { listExerciseRoutineMemberships, listExercises, listRoutines } from "@/lib/phase2/training";
import { getSessionContinuity, getTrainingProgress, listCompletedSessionHistory, todayInCordoba } from "@/lib/phase2/training-robust";
import { HistoryExerciseList } from "./history-exercise-list";
import { HistorySessionList } from "./history-session-list";

export const dynamic = "force-dynamic";

export default async function TrainHistoryPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const view = sp.view === "exercises" ? "exercises" : "sessions";
  const rawLimit = typeof sp.limit === "string" ? Number(sp.limit) : 20;
  const sessionLimit = Number.isInteger(rawLimit) ? Math.min(Math.max(rawLimit, 20), 100) : 20;
  if (view === "sessions") {
    const [sessions, continuity] = await Promise.all([
      listCompletedSessionHistory({ limit: sessionLimit + 1 }),
      getSessionContinuity(),
    ]);
    return <div className="space-y-6">
      <HistoryTabs view={view} />
      <HistorySessionList sessions={sessions.slice(0, sessionLimit)} continuity={continuity} hasMore={sessions.length > sessionLimit} currentLimit={sessionLimit} currentDate={todayInCordoba()} notice={typeof sp.notice === "string" ? sp.notice : null} />
    </div>;
  }
  const [exercises, progress, routines] = await Promise.all([
    listExercises({ includeArchived: false }),
    getTrainingProgress(),
    listRoutines({ includeArchived: false }),
  ]);
  const memberships = await listExerciseRoutineMemberships(routines.map((routine) => routine.id));
  const progressByExerciseId = new Map(
    progress.exercises.map((exercise) => [exercise.exerciseId, exercise]),
  );

  return (
    <div className="space-y-6">
      <HistoryTabs view={view} />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Por ejercicio</h1>
        <p className="text-sm text-muted-foreground">
          Buscá un ejercicio y compará tus registros reales.
        </p>
      </div>
      <HistoryExerciseList
        exercises={exercises.map((exercise) => ({
          ...exercise,
          progress: progressByExerciseId.get(exercise.id) ?? null,
          routineIds: (memberships.get(exercise.id) ?? []).map((membership) => membership.id),
        }))}
        routines={routines.map((routine) => ({ id: routine.id, nombre: routine.nombre }))}
      />
    </div>
  );
}

function HistoryTabs({ view }: { view: "sessions" | "exercises" }) {
  return <div className="space-y-3">
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial</h1>
      <p className="text-sm text-muted-foreground">Revisá tus sesiones y el progreso de cada ejercicio.</p>
    </div>
    <nav className="grid grid-cols-2 rounded-xl border bg-muted/35 p-1" aria-label="Vista de historial">
      <Link href="/train/history?view=sessions" className={cn("flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors", view === "sessions" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Sesiones</Link>
      <Link href="/train/history?view=exercises" className={cn("flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors", view === "exercises" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Por ejercicio</Link>
    </nav>
  </div>;
}
