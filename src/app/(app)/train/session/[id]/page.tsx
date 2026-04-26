import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listExercises, getSession, listSetsForSessionExercise } from "@/lib/phase2/training";
import {
  addExistingExerciseToSessionAction,
  createExerciseFromSessionAction,
  removeSessionExerciseAction,
  upsertWorkoutSetAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const EXERCISE_TYPES = [
  { value: "strength", label: "Fuerza" },
  { value: "abs", label: "Abdomen" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Movilidad" },
  { value: "other", label: "Otro" },
] as const;

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ session, exercises }, allExercises] = await Promise.all([
    getSession(id),
    listExercises({ includeArchived: false }),
  ]);

  const setsBySessionExerciseId = new Map(
    await Promise.all(
      exercises.map(async (se) => [se.id, await listSetsForSessionExercise(se.id)] as const),
    ),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sesión</h1>
        <p className="text-sm text-muted-foreground">
          {session.title ?? "Sin título"}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Agregar ejercicio existente</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={addExistingExerciseToSessionAction} className="space-y-3">
            <input type="hidden" name="session_id" value={id} />
            <select
              name="exercise_id"
              className="h-11 w-full rounded-md border bg-background px-3 text-sm"
              required
            >
              {allExercises.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
            </select>
            <Button className="h-11 w-full" type="submit" disabled={allExercises.length === 0}>
              Agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Crear ejercicio nuevo (y agregar)</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createExerciseFromSessionAction} className="space-y-3">
            <input type="hidden" name="session_id" value={id} />
            <div className="space-y-1">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" placeholder="Ej: Cinta" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Categoría</Label>
              <Input id="category" name="category" placeholder="Opcional" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="exercise_type">Tipo</Label>
              <select
                id="exercise_type"
                name="exercise_type"
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue="strength"
                required
              >
                {EXERCISE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <Button className="h-11 w-full" type="submit">
              Crear y agregar
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Ejercicios de la sesión</h2>
        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no agregaste ejercicios.</p>
        ) : (
          <div className="space-y-3">
            {exercises.map((se) => {
              const sets = setsBySessionExerciseId.get(se.id) ?? [];
              return (
                <Card key={se.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{se.exercise_name_snapshot}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {se.exercise_type_snapshot} · {se.source_type}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <form action={removeSessionExerciseAction}>
                      <input type="hidden" name="session_id" value={id} />
                      <input type="hidden" name="id" value={se.id} />
                      <Button className="h-11 w-full" variant="destructive" type="submit">
                        Quitar de la sesión
                      </Button>
                    </form>

                    <details className="rounded-md border bg-background p-3">
                      <summary className="cursor-pointer text-sm font-medium">
                        Sets ({sets.length})
                      </summary>
                      <div className="mt-3 space-y-3">
                        {sets.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Sin sets todavía.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {sets.map((st) => (
                              <div
                                key={st.id}
                                className="rounded-md border bg-background px-3 py-2 text-sm"
                              >
                                Set {st.set_number}:{" "}
                                {st.reps !== null ? `${st.reps} reps` : "—"}{" "}
                                {st.weight_kg !== null ? `· ${st.weight_kg} kg` : ""}
                                {st.duration_seconds !== null
                                  ? ` · ${st.duration_seconds}s`
                                  : ""}
                                {st.distance_meters !== null
                                  ? ` · ${st.distance_meters}m`
                                  : ""}
                              </div>
                            ))}
                          </div>
                        )}

                        <form action={upsertWorkoutSetAction} className="space-y-2">
                          <input type="hidden" name="session_id" value={id} />
                          <input
                            type="hidden"
                            name="workout_session_exercise_id"
                            value={se.id}
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor={`set-${se.id}`}>Set #</Label>
                              <Input
                                id={`set-${se.id}`}
                                name="set_number"
                                type="number"
                                min={1}
                                step={1}
                                required
                                inputMode="numeric"
                                placeholder="1"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`reps-${se.id}`}>Reps</Label>
                              <Input id={`reps-${se.id}`} name="reps" inputMode="numeric" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`kg-${se.id}`}>Kg</Label>
                              <Input id={`kg-${se.id}`} name="weight_kg" inputMode="numeric" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`rest-${se.id}`}>Descanso (s)</Label>
                              <Input id={`rest-${se.id}`} name="rest_seconds" inputMode="numeric" />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`dur-${se.id}`}>Duración (s)</Label>
                              <Input
                                id={`dur-${se.id}`}
                                name="duration_seconds"
                                inputMode="numeric"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label htmlFor={`dist-${se.id}`}>Distancia (m)</Label>
                              <Input
                                id={`dist-${se.id}`}
                                name="distance_meters"
                                inputMode="numeric"
                              />
                            </div>
                          </div>
                          <Button className="h-11 w-full" type="submit" variant="outline">
                            Guardar set
                          </Button>
                        </form>
                      </div>
                    </details>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Link
        href="/train"
        className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
      >
        Volver
      </Link>
    </div>
  );
}

