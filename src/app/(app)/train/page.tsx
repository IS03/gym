import Link from "next/link";
import {
  ChartNoAxesCombined,
  ListChecks,
  ListPlus,
  Plus,
  TimerReset,
} from "lucide-react";
import { StartWorkoutSheet } from "@/components/training/start-workout-sheet";
import { TrainingMonthPreview } from "@/components/training/training-month-preview";
import {
  getInProgressSessionForUser,
  listTrainingDaysInMonth,
  listWorkoutStartRoutines,
} from "@/lib/phase2/training";
import { todayInCordoba } from "@/lib/phase2/training-robust";
import { toWorkoutStartActiveSession } from "@/lib/phase2/workout-start";

export const dynamic = "force-dynamic";

const trainingLinks = [
  {
    href: "/train/routines",
    label: "Rutinas",
    description: "Tu plan",
    icon: ListChecks,
  },
  {
    href: "/train/progress",
    label: "Progreso",
    description: "Tu evolución",
    icon: ChartNoAxesCombined,
  },
  {
    href: "/train/history",
    label: "Historial",
    description: "Por ejercicio",
    icon: TimerReset,
  },
  {
    href: "/train/exercises",
    label: "Ejercicios",
    description: "Administrar",
    icon: ListPlus,
  },
] as const;

export default async function TrainPage() {
  const today = todayInCordoba();
  const month = today.slice(0, 7) as `${number}-${number}`;
  const [inProgress, workoutStartRoutines, trainedDays] = await Promise.all([
    getInProgressSessionForUser(),
    listWorkoutStartRoutines(),
    listTrainingDaysInMonth({ month }),
  ]);

  return (
    <div className="space-y-6 pb-16 lg:pb-0">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Entrenar</h1>
          <p className="text-sm text-muted-foreground">
            Registrá tu sesión y seguí tu progreso.
          </p>
        </div>
        <StartWorkoutSheet
          routines={workoutStartRoutines}
          activeSession={inProgress ? toWorkoutStartActiveSession(inProgress) : null}
          triggerAriaLabel="Iniciar entrenamiento"
          triggerClassName="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-[60] flex size-14 touch-manipulation items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_24px_-10px_color-mix(in_oklch,var(--primary)_65%,transparent)] outline-none transition-[background-color,box-shadow,transform,opacity] duration-200 ease-out motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:zoom-in-95 hover:bg-primary/90 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95 lg:static lg:ml-auto lg:inline-flex lg:h-11 lg:w-auto lg:gap-2 lg:rounded-lg lg:px-4 lg:text-sm lg:font-medium lg:shadow-sm"
        >
          <Plus className="size-5" aria-hidden />
          <span className="sr-only lg:not-sr-only">Nueva sesión</span>
        </StartWorkoutSheet>
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:items-start lg:gap-5">
        <section className="lg:col-span-7">
          <TrainingMonthPreview
            month={month}
            today={today}
            trainedDays={trainedDays}
          />
        </section>

        <section className="mt-6 space-y-3 lg:col-span-5 lg:mt-0">
          <h2 className="text-base font-semibold tracking-tight">Tu entrenamiento</h2>
          <div className="grid grid-cols-2 gap-3">
            {trainingLinks.map(({ href, label, description, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="surface-elevated flex min-h-28 flex-col justify-between rounded-2xl border bg-card p-4 outline-none transition-[border-color,box-shadow,transform] duration-150 hover:border-primary/25 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
              >
                <Icon className="size-5 text-primary" aria-hidden />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="text-xs text-muted-foreground">{description}</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
