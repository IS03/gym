import Link from "next/link";
import {
  ArrowRight,
  ChevronDown,
  Dumbbell,
  Layers3,
  Plus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { listRoutineOverviews, listRoutines } from "@/lib/phase2/training";
import { getInitialPlanStatus } from "@/lib/phase2/training-robust";
import { partitionRoutines } from "@/lib/phase2/routine-list";
import { routineColorCssVariable } from "@/lib/phase2/routine-colors";
import { ArchivedRoutines } from "./archived-routines";
import { InitialPlanImportButton } from "./initial-plan-import-button";
import { RoutineArchiveButton } from "./routine-archive-button";
import { RoutineCreateSheet } from "./routine-create-sheet";

export const dynamic = "force-dynamic";

function RoutineMeta({
  exerciseCount,
  setCount,
}: {
  exerciseCount: number;
  setCount: number;
}) {
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {exerciseCount} ejercicio{exerciseCount === 1 ? "" : "s"} · {setCount} serie
      {setCount === 1 ? "" : "s"}
    </p>
  );
}

export default async function RoutinesPage() {
  const [allRoutines, initialPlan] = await Promise.all([
    listRoutines({ includeArchived: true }),
    getInitialPlanStatus(),
  ]);
  const { active, archived } = partitionRoutines(allRoutines);
  const overviews = await listRoutineOverviews(active.map((routine) => routine.id));

  return (
    <div className="space-y-6 pb-8 lg:mx-auto lg:max-w-6xl">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Rutinas</h1>
          <p className="text-sm text-muted-foreground">
            Organizá tus rutinas. Editarlas no modifica sesiones anteriores.
          </p>
        </div>
        <RoutineCreateSheet triggerClassName="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground outline-none transition-[background-color,transform] hover:bg-primary/85 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98] lg:h-11 lg:px-4">
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">Nueva rutina</span>
          <span className="sm:hidden">Nueva</span>
        </RoutineCreateSheet>
      </header>

      <section className="space-y-3" aria-labelledby="active-routines-title">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="active-routines-title" className="text-base font-semibold tracking-tight lg:text-lg">
            Activas
          </h2>
          {active.length > 0 ? (
            <span className="metric-number text-xs text-muted-foreground lg:text-sm">
              {active.length} activa{active.length === 1 ? "" : "s"}
            </span>
          ) : null}
        </div>

        {active.length === 0 ? (
          <Card className="border-dashed bg-muted/20">
            <CardContent className="space-y-2 py-7 text-center">
              <p className="text-sm font-medium">No tenés rutinas activas.</p>
              <p className="text-sm text-muted-foreground">
                Creá una nueva o restaurá una archivada.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-2 lg:hidden">
              {active.map((routine) => {
                const overview = overviews.get(routine.id);
                return (
                  <div
                    key={routine.id}
                    className="relative flex min-h-16 items-stretch overflow-hidden rounded-xl border bg-card shadow-sm ring-1 ring-foreground/5"
                  >
                    <span
                      className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
                      style={{ backgroundColor: routineColorCssVariable(routine.color) }}
                      aria-hidden
                    />
                    <Link
                      href={`/train/routines/${routine.id}`}
                      className="flex min-w-0 flex-1 items-center gap-3 px-5 py-3 outline-none transition-colors hover:bg-muted/35 focus-visible:rounded-l-xl focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{routine.nombre}</span>
                        <RoutineMeta
                          exerciseCount={overview?.exerciseCount ?? 0}
                          setCount={overview?.setCount ?? 0}
                        />
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </Link>
                    <div className="flex items-center pr-2">
                      <RoutineArchiveButton routineId={routine.id} routineName={routine.nombre} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden grid-cols-2 gap-4 lg:grid">
              {active.map((routine) => {
                const overview = overviews.get(routine.id);
                return (
                  <Card key={routine.id} className="relative min-h-64 justify-between overflow-hidden">
                    <span
                      className="absolute inset-y-4 left-0 w-[3px] rounded-r-full"
                      style={{ backgroundColor: routineColorCssVariable(routine.color) }}
                      aria-hidden
                    />
                    <Link
                      href={`/train/routines/${routine.id}`}
                      className="flex h-full flex-col gap-5 rounded-xl p-4 pl-5 pt-1 outline-none transition-colors hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Abrir rutina ${routine.nombre}`}
                    >
                      <div className="min-w-0 pr-10">
                        <div className="flex items-center gap-2.5">
                          <h3 className="truncate text-lg font-semibold tracking-tight">{routine.nombre}</h3>
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          Editar la plantilla no cambia sesiones anteriores.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-muted/55 p-3">
                          <Dumbbell className="size-4 text-primary" aria-hidden />
                          <p className="metric-number mt-2 text-xl font-semibold">{overview?.exerciseCount ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Ejercicios</p>
                        </div>
                        <div className="rounded-xl bg-muted/55 p-3">
                          <Layers3 className="size-4 text-primary" aria-hidden />
                          <p className="metric-number mt-2 text-xl font-semibold">{overview?.setCount ?? 0}</p>
                          <p className="text-xs text-muted-foreground">Series objetivo</p>
                        </div>
                      </div>

                      <div className="min-h-10 space-y-2">
                        {(overview?.muscleGroups.length ?? 0) > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {overview?.muscleGroups.slice(0, 4).map((group) => (
                              <span key={group} className="rounded-full bg-primary/9 px-2.5 py-1 text-[11px] font-medium text-primary">
                                {group}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {(overview?.exerciseNames.length ?? 0) > 0 ? (
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {overview?.exerciseNames.slice(0, 4).join(" · ")}
                            {(overview?.exerciseNames.length ?? 0) > 4
                              ? ` · +${(overview?.exerciseNames.length ?? 0) - 4}`
                              : ""}
                          </p>
                        ) : null}
                      </div>

                      <span className="mt-auto flex h-10 items-center justify-between rounded-lg border px-3 text-sm font-medium">
                        Abrir rutina <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                      </span>
                    </Link>
                    <div className="absolute right-3 top-3">
                      <RoutineArchiveButton routineId={routine.id} routineName={routine.nombre} />
                    </div>
                  </Card>
                );
              })}
            </div>
          </>
        )}
      </section>

      <ArchivedRoutines routines={archived} />

      <details className="group border-t pt-2 lg:pt-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-1 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
          Opciones avanzadas
          <ChevronDown className="size-4 transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
        </summary>
        <div className="pt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">
          <Card className="bg-muted/20" size="sm">
            <CardContent className="space-y-3">
              <div>
                <h2 className="text-sm font-medium">Restaurar plan inicial</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Vuelve a importar las rutinas iniciales sin modificar entrenamientos ya guardados.
                </p>
              </div>
              <InitialPlanImportButton imported={initialPlan.imported} />
            </CardContent>
          </Card>
        </div>
      </details>
    </div>
  );
}
