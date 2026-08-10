import Link from "next/link";
import { CalendarDays, ChartNoAxesCombined, Dumbbell, ListChecks, Play, Plus, TimerReset } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
          Registrá tu sesión y seguí tu progreso.
        </p>
      </div>

      <Card className="surface-elevated border-primary/20 bg-primary text-primary-foreground ring-0">
        <CardContent className="space-y-4 pt-4">
          {inProgress ? (
            <>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"><Play className="size-5" aria-hidden /></span>
                <div>
                  <p className="text-sm font-medium text-primary-foreground/75">Sesión en curso</p>
                  <h2 className="text-xl font-semibold tracking-tight">Continuar entrenamiento</h2>
                  <p className="mt-1 text-sm text-primary-foreground/75">{inProgress.log_date ? `Iniciada el ${inProgress.log_date}.` : "Tu sesión sigue lista."}</p>
                </div>
              </div>
              <Link
                href={`/train/session/${inProgress.session.id}`}
                className="flex h-11 items-center justify-center rounded-xl bg-primary-foreground px-3 text-sm font-medium text-primary transition-transform duration-150 active:scale-[0.98]"
              >
                Retomar sesión
              </Link>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"><Dumbbell className="size-5" aria-hidden /></span>
                <div>
                  <p className="text-sm font-medium text-primary-foreground/75">Listo cuando vos estés</p>
                  <h2 className="text-xl font-semibold tracking-tight">Empezá a entrenar</h2>
                  <p className="mt-1 text-sm text-primary-foreground/75">Elegí una rutina o iniciá una sesión libre.</p>
                </div>
              </div>
              <Link href={`/train/session/new?date=${today}`} className="flex h-11 items-center justify-center rounded-xl bg-primary-foreground px-3 text-sm font-medium text-primary transition-transform duration-150 active:scale-[0.98]">
                <Plus className="size-4" aria-hidden /> Iniciar sesión
              </Link>
            </>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight">Tu entrenamiento</h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/train/routines" className="surface-elevated flex min-h-28 flex-col justify-between rounded-2xl border bg-card p-4 transition-transform duration-150 active:scale-[0.98]">
            <ListChecks className="size-5 text-primary" aria-hidden />
            <span><span className="block text-sm font-semibold">Rutinas</span><span className="text-xs text-muted-foreground">Tu plan</span></span>
          </Link>
          <Link href="/train/progress" className="surface-elevated flex min-h-28 flex-col justify-between rounded-2xl border bg-card p-4 transition-transform duration-150 active:scale-[0.98]">
            <ChartNoAxesCombined className="size-5 text-primary" aria-hidden />
            <span><span className="block text-sm font-semibold">Progreso</span><span className="text-xs text-muted-foreground">Esta semana</span></span>
          </Link>
          <Link href="/train/history" className="surface-elevated flex min-h-28 flex-col justify-between rounded-2xl border bg-card p-4 transition-transform duration-150 active:scale-[0.98]">
            <TimerReset className="size-5 text-primary" aria-hidden />
            <span><span className="block text-sm font-semibold">Historial</span><span className="text-xs text-muted-foreground">Por ejercicio</span></span>
          </Link>
          <Link href="/train/calendar" className="surface-elevated flex min-h-28 flex-col justify-between rounded-2xl border bg-card p-4 transition-transform duration-150 active:scale-[0.98]">
            <CalendarDays className="size-5 text-primary" aria-hidden />
            <span><span className="block text-sm font-semibold">Calendario</span><span className="text-xs text-muted-foreground">Constancia</span></span>
          </Link>
        </div>
      </section>

      <Link href="/train/exercises" className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}>
        Administrar ejercicios
      </Link>
    </div>
  );
}
