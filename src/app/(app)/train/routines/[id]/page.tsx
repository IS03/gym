import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listExercises, listRoutineExercises } from "@/lib/phase2/training";

export const dynamic = "force-dynamic";

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [allExercises, routineExercises] = await Promise.all([
    listExercises({ includeArchived: false }),
    listRoutineExercises(id),
  ]);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rutina</h1>
        <p className="text-sm text-muted-foreground">
          Editar ejercicios (mínimo por ahora).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ejercicios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {routineExercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta rutina no tiene ejercicios todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {routineExercises.map((re) => (
                <div
                  key={re.id}
                  className="rounded-md border bg-background px-4 py-3"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">
                      {re.exercise.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      #{re.exercise_order}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
            UI de edición completa de rutina (orden, defaults, etc.) la hago en el
            próximo paso: por ahora lo dejamos como pantalla de lectura.
          </div>
        </CardContent>
      </Card>

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

      <Link
        href="/train/routines"
        className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
      >
        Volver
      </Link>
    </div>
  );
}

