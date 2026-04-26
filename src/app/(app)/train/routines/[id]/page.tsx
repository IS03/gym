import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { listExercises, listRoutineExercises } from "@/lib/phase2/training";
import { removeRoutineExerciseAction } from "../../actions";
import { RoutineExerciseAddForm } from "./routine-exercise-manager";

export const dynamic = "force-dynamic";

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [allExercises, routineExercises] = await Promise.all([
    listExercises({ includeArchived: false }),
    listRoutineExercises(id),
  ]);

  const { data: routine } = await supabase
    .from("routines")
    .select("id, nombre")
    .eq("id", id)
    .maybeSingle();

  const routineName = routine?.nombre ?? "Rutina";

  const grouped = new Map<string, typeof routineExercises>();
  for (const re of routineExercises) {
    const key = re.exercise.grupo_muscular ?? "Sin grupo";
    const arr = grouped.get(key) ?? [];
    arr.push(re);
    grouped.set(key, arr);
  }
  const groupKeys = Array.from(grouped.keys()).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{routineName}</h1>
        <p className="text-sm text-muted-foreground">
          Agregar / quitar ejercicios.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agregar ejercicio</CardTitle>
        </CardHeader>
        <CardContent>
          <RoutineExerciseAddForm
            routineId={id}
            exercises={allExercises.map((e) => ({ id: e.id, nombre: e.nombre }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ejercicios en la rutina</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {routineExercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Esta rutina no tiene ejercicios todavía.
            </p>
          ) : (
            <div className="space-y-2">
              {groupKeys.map((k) => (
                <div key={k} className="space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {k}
                  </div>
                  {(grouped.get(k) ?? []).map((re) => (
                    <div
                      key={re.id}
                      className="rounded-md border bg-background px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{re.exercise.nombre}</span>
                        <form action={removeRoutineExerciseAction}>
                          <input type="hidden" name="routine_id" value={id} />
                          <input
                            type="hidden"
                            name="routine_exercise_id"
                            value={re.id}
                          />
                          <button className="text-sm font-medium text-destructive underline">
                            Quitar
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <div className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
            Orden estable: por fecha de agregado (routine_exercises.created_at asc).
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

