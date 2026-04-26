import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listExercises } from "@/lib/phase2/training";
import {
  createExerciseAction,
  archiveExerciseAction,
  updateExerciseAction,
} from "../actions";

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
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                name="nombre"
                placeholder="Ej: Press banca"
                required
              />
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
                  <CardTitle className="text-base">{ex.nombre}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {ex.grupo_muscular ? ex.grupo_muscular : "Sin grupo"}
                    {" · "}
                    {ex.series_sugeridas ?? "—"}x{ex.reps_sugeridas ?? "—"}
                    {ex.peso_sugerido !== null && ex.peso_sugerido !== undefined
                      ? ` · ${ex.peso_sugerido} kg`
                      : ""}
                  </p>
                </CardHeader>
                <CardContent>
                  <details className="rounded-md border bg-background p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Editar
                    </summary>
                    <form action={updateExerciseAction} className="mt-3 space-y-3">
                      <input type="hidden" name="id" value={ex.id} />
                      <div className="space-y-1">
                        <Label htmlFor={`n-${ex.id}`}>Nombre</Label>
                        <Input
                          id={`n-${ex.id}`}
                          name="nombre"
                          defaultValue={ex.nombre}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`g-${ex.id}`}>Grupo muscular</Label>
                        <select
                          id={`g-${ex.id}`}
                          name="grupo_muscular"
                          className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                          defaultValue={ex.grupo_muscular ?? ""}
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
                        <Label>Valores sugeridos</Label>
                        <div className="grid grid-cols-3 gap-2">
                          <Input
                            name="series_sugeridas"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            defaultValue={
                              ex.series_sugeridas === null ? "" : String(ex.series_sugeridas)
                            }
                            placeholder="Series"
                          />
                          <Input
                            name="reps_sugeridas"
                            type="number"
                            min={0}
                            step={1}
                            inputMode="numeric"
                            defaultValue={
                              ex.reps_sugeridas === null ? "" : String(ex.reps_sugeridas)
                            }
                            placeholder="Reps"
                          />
                          <Input
                            name="peso_sugerido"
                            type="number"
                            min={0}
                            step="0.5"
                            inputMode="decimal"
                            defaultValue={
                              ex.peso_sugerido === null ? "" : String(ex.peso_sugerido)
                            }
                            placeholder="Peso"
                          />
                        </div>
                      </div>
                      <Button className="h-11 w-full" type="submit" variant="outline">
                        Guardar cambios
                      </Button>
                    </form>
                  </details>

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

