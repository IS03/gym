import { listExercises } from "@/lib/phase2/training";
import { ExerciseLibrary } from "./exercise-library";

export const dynamic = "force-dynamic";

export default async function ExercisesPage() {
  const exercises = await listExercises({ includeArchived: false });

  return (
    <div className="lg:mx-auto lg:max-w-6xl">
      <ExerciseLibrary initialExercises={exercises} />
    </div>
  );
}
