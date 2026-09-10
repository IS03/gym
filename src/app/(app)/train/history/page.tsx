import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionContinuity, getTrainingHistoryDirectory, listCompletedSessionHistory, todayInCordoba } from "@/lib/phase2/training-robust";
import { trainingHistoryFiltersFromSearchParams } from "@/lib/phase2/training-history";
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
  const directory = await getTrainingHistoryDirectory();
  const initialFilters = trainingHistoryFiltersFromSearchParams(sp, directory.routines.map((routine) => routine.id));

  return (
    <div className="space-y-6">
      <HistoryTabs view={view} />
      <HistoryExerciseList
        exercises={directory.exercises}
        routines={directory.routines}
        initialFilters={initialFilters}
      />
    </div>
  );
}

function HistoryTabs({ view }: { view: "sessions" | "exercises" }) {
  return <div className="space-y-2.5">
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Historial</h1>
        <p className="text-sm text-muted-foreground">Revisá tus entrenamientos anteriores.</p>
      </div>
      <Link href="/train/calendar" className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-background text-primary outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring" aria-label="Abrir calendario de entrenamiento">
        <CalendarDays className="size-4" aria-hidden />
      </Link>
    </div>
    <nav className="grid grid-cols-2 rounded-xl border bg-muted/35 p-1" aria-label="Vista de historial">
      <Link href="/train/history?view=sessions" className={cn("flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors", view === "sessions" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Sesiones</Link>
      <Link href="/train/history?view=exercises" className={cn("flex h-10 items-center justify-center rounded-lg text-sm font-medium transition-colors", view === "exercises" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>Ejercicios</Link>
    </nav>
  </div>;
}
