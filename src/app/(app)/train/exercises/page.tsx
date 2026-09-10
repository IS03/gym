import { listExerciseRoutineMemberships, listExercises, listRoutines } from "@/lib/phase2/training";
import { ExerciseLibrary } from "./exercise-library";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const [exercises, routines] = await Promise.all([
    listExercises({ includeArchived: true }),
    listRoutines({ includeArchived: false }),
  ]);
  const memberships = await listExerciseRoutineMemberships(routines.map((routine) => routine.id));
  const libraryExercises = exercises.map((exercise) => ({
    ...exercise,
    memberships: memberships.get(exercise.id) ?? [],
  }));

  return (
    <div className="lg:mx-auto lg:max-w-6xl">
      <ExerciseLibrary initialExercises={libraryExercises} initialRoutines={routines} />
    </div>
  );
}
