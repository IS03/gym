import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listRoutines } from "@/lib/phase2/training";
import { createRoutineAction } from "../actions";

export const dynamic = "force-dynamic";

const ROUTINE_TYPES = [
  { value: "strength", label: "Fuerza" },
  { value: "abs", label: "Abdomen" },
  { value: "cardio", label: "Cardio" },
  { value: "mixed", label: "Mixta" },
] as const;

export default async function RoutinesPage() {
  const routines = await listRoutines({ includeArchived: false });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Rutinas</h1>
        <p className="text-sm text-muted-foreground">Plantillas reutilizables.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Nueva rutina</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createRoutineAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="name">Nombre</Label>
              <Input id="name" name="name" placeholder="Ej: Pecho" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="routine_type">Tipo</Label>
              <select
                id="routine_type"
                name="routine_type"
                className="h-11 w-full rounded-md border bg-background px-3 text-sm"
                defaultValue="strength"
                required
              >
                {ROUTINE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="notes">Notas</Label>
              <Input id="notes" name="notes" placeholder="Opcional" />
            </div>
            <Button className="h-11 w-full" type="submit">
              Crear
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Activas</h2>
        {routines.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tenés rutinas.</p>
        ) : (
          <div className="space-y-2">
            {routines.map((r) => (
              <Link
                key={r.id}
                href={`/train/routines/${r.id}`}
                className="block rounded-md border bg-background px-4 py-3"
              >
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">{r.routine_type}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

