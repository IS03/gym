import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listExercises } from "@/lib/phase2/training";
import { getRoutineTemplate } from "@/lib/phase2/training-robust";
import { RoutineExerciseAddDialog } from "./routine-exercise-manager";
import { RoutineTemplateEditor } from "./routine-template-editor";
import { RoutineRestoreButton } from "../routine-restore-button";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import { RoutineSettingsForm } from "./routine-settings-form";

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
  const editorKey = template.exercises
    .map((exercise) => `${exercise.id}:${exercise.updated_at}`)
    .join(",");
  const exercises = allExercises.map((exercise) => ({
    id: exercise.id,
    nombre: exercise.nombre,
    grupo_muscular: exercise.grupo_muscular,
    muscle_group_label: exercise.muscle_group_label,
    implement: exercise.implement,
    weight_mode: exercise.weight_mode,
  }));

  return (
    <div className="space-y-6 lg:mx-auto lg:max-w-6xl">
      <div
        className="space-y-1 border-l-[3px] pl-3"
        style={{ borderColor: routineColorCssVariable(template.routine.color) }}
      >
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            {template.routine.nombre}
          </h1>
          {!template.routine.is_active ? (
            <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
              Archivada
            </span>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          Orden y objetivo independiente para cada serie.
        </p>
      </div>

      <RoutineSettingsForm routine={template.routine} />

      {!template.routine.is_active ? (
        <Card className="border-amber-500/25 bg-amber-500/[0.04]">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Rutina archivada</CardTitle>
            <p className="text-sm text-muted-foreground">
              Podés revisar y editar su estructura. Restaurala para volver a iniciarla.
            </p>
          </CardHeader>
          <CardContent>
            <RoutineRestoreButton
              routineId={template.routine.id}
              routineName={template.routine.nombre}
              fullWidth
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">Ejercicios</h2>
          {template.exercises.length > 0 ? (
            <RoutineExerciseAddDialog routineId={id} exercises={exercises} />
          ) : null}
        </div>
        {template.exercises.length > 0 ? (
          <RoutineTemplateEditor
            key={editorKey}
            routineId={id}
            items={template.exercises}
          />
        ) : (
          <Card className="surface-elevated">
            <CardContent className="space-y-4 py-6">
              <p className="text-sm text-muted-foreground">
                Esta rutina todavía no tiene ejercicios.
              </p>
              <RoutineExerciseAddDialog routineId={id} exercises={exercises} fullWidth />
            </CardContent>
          </Card>
        )}
      </section>

      {template.routine.is_active ? (
        <Card className="surface-elevated">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div>
              <CardTitle className="text-base">Iniciar sesión desde rutina</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Ejercicios disponibles en tu biblioteca: {allExercises.length}
              </p>
            </div>
            <Link
              href={`/train/session/new?routine_id=${id}`}
              className={cn(buttonVariants(), "h-11")}
            >
              Iniciar sesión
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Link
        href="/train/routines"
        className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
      >
        Volver
      </Link>
    </div>
  );
}
