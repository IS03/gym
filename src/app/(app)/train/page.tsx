import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getInProgressSessionForUser } from "@/lib/phase2/training";
import { todayInCordoba } from "@/lib/phase2/training-robust";

export const dynamic = "force-dynamic";

export default async function TrainPage() {
  const today = todayInCordoba();
  const inProgress = await getInProgressSessionForUser();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Entrenar</h1>
        <p className="text-sm text-muted-foreground">
          Series reales, objetivos y progreso sin alterar el historial.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Acciones rápidas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {inProgress ? (
            <>
              <p className="text-sm text-muted-foreground">
                Tenés un entrenamiento en curso
                {inProgress.log_date ? ` (${inProgress.log_date})` : ""}. Podés
                retomarlo o finalizarlo desde la sesión.
              </p>
              <Link
                href={`/train/session/${inProgress.session.id}`}
                className={cn(buttonVariants(), "h-11 w-full")}
              >
                Continuar sesión
              </Link>
              <p className="text-xs text-muted-foreground">
                Para iniciar otra, abrí la sesión y tocá &quot;Terminar sesión&quot;.
              </p>
            </>
          ) : (
            <Link
              href={`/train/session/new?date=${today}`}
              className={cn(buttonVariants(), "h-11 w-full")}
            >
              Iniciar sesión
            </Link>
          )}
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
            href="/train/progress"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
          >
            Progreso y resumen semanal
          </Link>
          <Link
            href="/train/history"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
          >
            Historial por ejercicio
          </Link>
          <Link
            href="/train/calendar"
            className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
          >
            Calendario
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
