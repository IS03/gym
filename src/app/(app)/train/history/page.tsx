import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listExercises } from "@/lib/phase2/training";

export const dynamic = "force-dynamic";

export default async function TrainHistoryPage() {
  const exercises = await listExercises({ includeArchived: false });

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Historial</h1>
        <p className="text-sm text-muted-foreground">Elegí un ejercicio.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Ejercicios</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {exercises.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay ejercicios todavía.</p>
          ) : (
            <div className="space-y-2">
              {exercises.map((ex) => (
                <Link
                  key={ex.id}
                  href={`/train/history/${ex.id}`}
                  className="block rounded-md border bg-background px-4 py-3"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{ex.name}</span>
                    <span className="text-xs text-muted-foreground">{ex.exercise_type}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

