import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listExercises } from "@/lib/phase2/training";
import { getRoutineTemplate } from "@/lib/phase2/training-robust";
import { RoutineExerciseAddForm } from "./routine-exercise-manager";
import { RoutineTemplateEditor } from "./routine-template-editor";
import { RoutineRestoreButton } from "../routine-restore-button";

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

  return (
    <div className="space-y-6 lg:mx-auto lg:max-w-6xl">
      <div className="space-y-1">
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agregar ejercicio</CardTitle>
        </CardHeader>
        <CardContent>
          <RoutineExerciseAddForm
            routineId={id}
            exercises={allExercises.map((e) => ({
              id: e.id,
              nombre: e.nombre,
              grupo_muscular: e.grupo_muscular,
            }))}
          />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Objetivos</h2>
        <RoutineTemplateEditor
          key={editorKey}
          routineId={id}
          items={template.exercises}
        />
      </section>

      {template.routine.is_active ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Iniciar sesión desde rutina</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/train/session/new?routine_id=${id}`}
              className={cn(buttonVariants(), "h-11 w-full")}
            >
              Iniciar sesión
            </Link>
            <p className="text-xs text-muted-foreground">
              Ejercicios disponibles en tu biblioteca: {allExercises.length}
            </p>
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
