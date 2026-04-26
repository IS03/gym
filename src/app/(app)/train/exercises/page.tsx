import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listExercises } from "@/lib/phase2/training";
import { createExerciseAction, archiveExerciseAction } from "../actions";

export const dynamic = "force-dynamic";

const EXERCISE_TYPES = [
  { value: "strength", label: "Fuerza" },
  { value: "abs", label: "Abdomen" },
  { value: "cardio", label: "Cardio" },
  { value: "mobility", label: "Movilidad" },
  { value: "other", label: "Otro" },
] as const;

export default async function ExercisesPage() {
  const exercises = await listExercises({ includeArchived: false });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Biblioteca</h1>
        <p className="text-sm text-muted-foreground">Tus ejercicios generales.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nuevo ejercicio</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createExerciseAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" placeholder="Ej: Press banca" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Categoría</Label>
              <Input id="category" name="category" placeholder="Ej: Pecho" />
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
              Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Activos</h2>
        {exercises.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no creaste ejercicios.
          </p>
        ) : (
          <div className="space-y-2">
            {exercises.map((ex) => (
              <Card key={ex.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{ex.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {ex.exercise_type}
                    {ex.category ? ` · ${ex.category}` : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <form action={archiveExerciseAction}>
                    <input type="hidden" name="id" value={ex.id} />
                    <Button
                      className="h-11 w-full"
                      type="submit"
                      variant="outline"
                    >
                      Archivar
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

