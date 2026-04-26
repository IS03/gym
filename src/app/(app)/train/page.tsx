import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function TrainPage() {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrenar</h1>
        <p className="text-sm text-muted-foreground">
          Sesiones del día, rutinas y biblioteca (Fase 2A).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Acciones rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Link
            href={`/train/session/new?date=${today}`}
            className={cn(buttonVariants(), "h-11 w-full")}
          >
            Iniciar sesión
          </Link>
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/train/exercises"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
            >
              Ejercicios
            </Link>
            <Link
              href="/train/routines"
              className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
            >
              Rutinas
            </Link>
          </div>
          <Link
            href="/train/history"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
          >
            Historial por ejercicio
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
