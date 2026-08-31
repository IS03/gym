import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  Dumbbell,
  History,
  ListChecks,
  ListPlus,
  Plus,
} from "lucide-react";
import { StartWorkoutSheet } from "@/components/training/start-workout-sheet";
import { TrainingMonthPreview } from "@/components/training/training-month-preview";
import {
  getInProgressSessionForUser,
  listTrainingDaysInMonth,
  listWorkoutStartRoutines,
} from "@/lib/phase2/training";
import { todayInCordoba } from "@/lib/phase2/training-robust";
import { formatSessionDate } from "@/lib/phase2/session-history";
import { toWorkoutStartActiveSession } from "@/lib/phase2/workout-start";
import { requireAuthenticatedRequestContext } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type TrainHubLinkProps = {
  href: string;
  title: string;
  description: string;
  icon: typeof ListChecks;
};

function TrainHubLink({ href, title, description, icon: Icon }: TrainHubLinkProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 outline-none transition-[background-color,border-color,transform] duration-150 hover:border-primary/25 hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.99]"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
      </span>
      <ChevronRight
        className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

export default async function TrainPage() {
  const today = todayInCordoba();
  const month = today.slice(0, 7) as `${number}-${number}`;
  const auth = await requireAuthenticatedRequestContext();
  const [inProgress, workoutStartRoutines, trainedDays] = await Promise.all([
    getInProgressSessionForUser(auth),
    listWorkoutStartRoutines(auth),
    listTrainingDaysInMonth({ month }, auth),
  ]);
  const activeSession = inProgress ? toWorkoutStartActiveSession(inProgress) : null;

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Entrenar</h1>
        <p className="text-sm text-muted-foreground">
          Entrená, organizá tus rutinas y revisá tu actividad.
        </p>
      </header>

      {activeSession ? (
        <section aria-labelledby="train-action-title" className="surface-elevated rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Dumbbell className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p id="train-action-title" className="text-sm font-medium text-primary">Sesión en curso</p>
                <h2 className="truncate text-lg font-semibold tracking-tight">
                  {activeSession.name}
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Iniciada {formatSessionDate(activeSession.logDate)}
                </p>
              </div>
            </div>
            <Link
              href={`/train/session/${activeSession.id}`}
              className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-[background-color,transform] hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              Continuar entrenamiento
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      ) : (
        <StartWorkoutSheet
          routines={workoutStartRoutines}
          activeSession={null}
          triggerAriaLabel="Iniciar entrenamiento"
          triggerClassName="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground outline-none transition-[background-color,transform] hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] sm:w-auto"
        >
          <Plus className="size-4" aria-hidden />
          Nueva sesión
        </StartWorkoutSheet>
      )}

      <div className="space-y-6 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6 lg:space-y-0">
        <section className="lg:col-span-7" aria-label="Constancia de entrenamiento">
          <TrainingMonthPreview month={month} today={today} trainedDays={trainedDays} />
        </section>

        <div className="space-y-6 lg:col-span-5">
          <section aria-labelledby="train-planning-title" className="space-y-3">
            <div>
              <h2 id="train-planning-title" className="text-base font-semibold tracking-tight">Planificar</h2>
              <p className="text-sm text-muted-foreground">Prepará lo que vas a entrenar.</p>
            </div>
            <div className="space-y-2">
              <TrainHubLink
                href="/train/routines"
                title="Rutinas"
                description="Crear y organizar tus planes"
                icon={ListChecks}
              />
              <TrainHubLink
                href="/train/exercises"
                title="Ejercicios"
                description="Administrar tu biblioteca"
                icon={ListPlus}
              />
            </div>
          </section>

          <section aria-labelledby="train-review-title" className="space-y-3">
            <div>
              <h2 id="train-review-title" className="text-base font-semibold tracking-tight">Revisar</h2>
              <p className="text-sm text-muted-foreground">Consultá lo que ya registraste.</p>
            </div>
            <TrainHubLink
              href="/train/history"
              title="Historial"
              description="Sesiones y registros por ejercicio"
              icon={History}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
