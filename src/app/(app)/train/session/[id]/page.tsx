import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants, Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listExercises, getSession } from "@/lib/phase2/training";
import {
  addExistingExerciseToSessionAction,
  removeSessionExerciseAction,
  finishSessionAction,
} from "../../actions";
import { SessionCreateExerciseForm } from "./session-create-exercise-form";
import { SessionExerciseAutosave } from "./session-exercise-autosave";

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
        <form action={finishSessionAction}>
          <input type="hidden" name="session_id" value={id} />
          <Button
            className="h-11 w-full"
            type="submit"
            variant={session.ended_at ? "outline" : "default"}
            disabled={Boolean(session.ended_at)}
          >
            {session.ended_at ? "Sesión terminada" : "Terminar sesión"}
          </Button>
        </form>
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
          <SessionCreateExerciseForm sessionId={id} muscleGroups={[...MUSCLE_GROUPS]} />
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
                    <SessionExerciseAutosave
                      sessionId={id}
                      id={se.id}
                      initial={{
                        is_completed: se.is_completed,
                        series_reales: se.series_reales,
                        reps_reales: se.reps_reales,
                        peso_real: se.peso_real,
                      }}
                    />

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

