import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listExercises, getSession } from "@/lib/phase2/training";
import {
  addExistingExerciseToSessionAction,
  createExerciseFromSessionAction,
  removeSessionExerciseAction,
  updateSessionExerciseAction,
} from "../../actions";

export const dynamic = "force-dynamic";

const MUSCLE_GROUPS = [
  { value: "pecho", label: "Pecho" },
  { value: "espalda", label: "Espalda" },
  { value: "piernas", label: "Piernas" },
  { value: "hombros", label: "Hombros" },
  { value: "bíceps", label: "Bíceps" },
  { value: "tríceps", label: "Tríceps" },
  { value: "abdomen", label: "Abdomen" },
  { value: "cardio", label: "Cardio" },
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
  const completed = exercises.filter((e) => e.is_completed).length;
  const total = exercises.length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Sesión</h1>
        <p className="text-sm text-muted-foreground">{session.created_at}</p>
        <p className="text-sm text-muted-foreground">
          Progreso: {completed}/{total}
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
                  {ex.nombre}
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
              <Label htmlFor="nombre">Nombre</Label>
              <Input id="nombre" name="nombre" placeholder="Ej: Press banca" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="grupo_muscular">Grupo muscular</Label>
              <select
                id="grupo_muscular"
                name="grupo_muscular"
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue=""
              >
                <option value="">(Sin grupo)</option>
                {MUSCLE_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Recomendados</Label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  name="series_sugeridas"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder="Series"
                />
                <Input
                  name="reps_sugeridas"
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  placeholder="Reps"
                />
                <Input
                  name="peso_sugerido"
                  type="number"
                  min={0}
                  step="0.5"
                  inputMode="decimal"
                  placeholder="Peso"
                />
              </div>
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
              return (
                <Card key={se.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">{se.nombre_snapshot}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {se.grupo_muscular_snapshot ?? "Sin grupo"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <form action={updateSessionExerciseAction} className="space-y-3">
                      <input type="hidden" name="session_id" value={id} />
                      <input type="hidden" name="id" value={se.id} />

                      <label className="flex items-center gap-3 rounded-md border bg-background px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          name="is_completed"
                          defaultChecked={se.is_completed}
                          className="size-5"
                        />
                        <span className="font-medium">Hecho</span>
                        {se.completed_at ? (
                          <span className="ml-auto text-xs text-muted-foreground">
                            {new Date(se.completed_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        ) : null}
                      </label>

                      <div className="space-y-1">
                        <Label>Real</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            name="series_reales"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            defaultValue={
                              se.series_reales === null ? "" : String(se.series_reales)
                            }
                            placeholder="Series"
                          />
                          <Input
                            name="reps_reales"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            defaultValue={
                              se.reps_reales === null ? "" : String(se.reps_reales)
                            }
                            placeholder="Reps"
                          />
                          <Input
                            name="peso_real"
                            type="number"
                            min={0}
                            step="0.5"
                            inputMode="decimal"
                            defaultValue={
                              se.peso_real === null ? "" : String(se.peso_real)
                            }
                            placeholder="Peso"
                          />
                        </div>
                      </div>
                      <Button className="h-11 w-full" type="submit" variant="outline">
                        Guardar
                      </Button>
                    </form>

                    <form action={removeSessionExerciseAction}>
                      <input type="hidden" name="session_id" value={id} />
                      <input type="hidden" name="id" value={se.id} />
                      <Button className="h-11 w-full" variant="destructive" type="submit">
                        Quitar de la sesión
                      </Button>
                    </form>
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

