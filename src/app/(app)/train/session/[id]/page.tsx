import { notFound } from "next/navigation";
import { listExercises } from "@/lib/phase2/training";
import { getWorkoutSessionDetail } from "@/lib/phase2/training-robust";
import { SessionEditor } from "./session-editor";
import { clientDetailFromWorkoutDetail } from "./session-editor-helpers";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getWorkoutSessionDetail(id);
  if (!detail) notFound();
  const exercises = await listExercises({ includeArchived: false });
  const clientDetail = clientDetailFromWorkoutDetail(detail);
  const editorKey = `${detail.session.updated_at}:${clientDetail.exercises
    .map((exercise) => `${exercise.id}:${exercise.updated_at}`)
    .join(",")}`;

  return (
    <div className="lg:mx-auto lg:max-w-[760px]">
      <SessionEditor
        key={editorKey}
        detail={clientDetail}
        libraryExercises={exercises.map((exercise) => ({
          id: exercise.id,
          nombre: exercise.nombre,
          grupo_muscular: exercise.grupo_muscular,
        }))}
      />
    </div>
  );
}
