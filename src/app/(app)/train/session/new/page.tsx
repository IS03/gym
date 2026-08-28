import { StartWorkoutSheet } from "@/components/training/start-workout-sheet";
import {
  getInProgressSessionForUser,
  listWorkoutStartRoutines,
} from "@/lib/phase2/training";
import { toWorkoutStartActiveSession } from "@/lib/phase2/workout-start";

export const dynamic = "force-dynamic";

export default async function NewSessionPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await searchParams) ?? {};
  const initialRoutineId =
    typeof sp.routine_id === "string" ? sp.routine_id : undefined;
  const [inProgress, routines] = await Promise.all([
    getInProgressSessionForUser(),
    listWorkoutStartRoutines(),
  ]);

  return (
    <div className="py-2 lg:py-8">
      <StartWorkoutSheet
        routines={routines}
        activeSession={
          inProgress ? toWorkoutStartActiveSession(inProgress) : null
        }
        initialRoutineId={initialRoutineId}
        presentation="inline"
      />
    </div>
  );
}
