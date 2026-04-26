import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRoutines } from "@/lib/phase2/training";
import { RoutineCreateForm } from "./routine-create-form";

export const dynamic = "force-dynamic";

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
          <RoutineCreateForm />
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
                  <span className="text-sm font-medium">{r.nombre}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

