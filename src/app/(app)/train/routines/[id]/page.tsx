import { listExercises } from "@/lib/phase2/training";
import { getRoutineTemplate } from "@/lib/phase2/training-robust";
import { RoutineEditorShell } from "./routine-editor-shell";

export const dynamic = "force-dynamic";

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [allExercises, template] = await Promise.all([
    listExercises({ includeArchived: false }),
    getRoutineTemplate(id),
  ]);
  const exercises = allExercises.map((exercise) => ({
    id: exercise.id,
    nombre: exercise.nombre,
    grupo_muscular: exercise.grupo_muscular,
    muscle_group_label: exercise.muscle_group_label,
    implement: exercise.implement,
    weight_mode: exercise.weight_mode,
  }));

  return <RoutineEditorShell routine={template.routine} items={template.exercises} exercises={exercises} />;
}
