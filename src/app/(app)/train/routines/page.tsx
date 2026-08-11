import Link from "next/link";
import { ArrowRight, Dumbbell, Layers3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listRoutineOverviews, listRoutines } from "@/lib/phase2/training";
import { getInitialPlanStatus } from "@/lib/phase2/training-robust";
import { RoutineCreateForm } from "./routine-create-form";
import { RoutineDeleteButton } from "./routine-delete-button";
import { InitialPlanImportButton } from "./initial-plan-import-button";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const [routines, initialPlan] = await Promise.all([
    listRoutines({ includeArchived: false }),
    getInitialPlanStatus(),
  ]);
  const overviews = await listRoutineOverviews(routines.map((routine) => routine.id));

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">Rutinas</h1>
        <p className="text-sm text-muted-foreground">
          Plantillas por serie. Editarlas no cambia tu historial.
        </p>
      </div>

      <div className="space-y-6 lg:hidden">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan de la planilla</CardTitle>
        </CardHeader>
        <CardContent>
          <InitialPlanImportButton imported={initialPlan.imported} />
        </CardContent>
      </Card>

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
              <div
                key={r.id}
                className="flex min-h-[52px] items-stretch gap-0 rounded-md border bg-background"
              >
                <Link
                  href={`/train/routines/${r.id}`}
                  className="flex min-w-0 flex-1 items-center px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block size-3 shrink-0 rounded-full border"
                      style={{ backgroundColor: r.color ?? "transparent" }}
                      aria-hidden
                    />
                    <span className="text-sm font-medium">{r.nombre}</span>
                  </div>
                </Link>
                <div className="flex shrink-0 border-l p-0">
                  <RoutineDeleteButton
                    routineId={r.id}
                    routineName={r.nombre}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      <div className="hidden grid-cols-12 items-start gap-6 lg:grid">
        <section className="col-span-8 space-y-4" aria-labelledby="desktop-active-routines">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="desktop-active-routines" className="text-lg font-semibold tracking-tight">Rutinas activas</h2>
              <p className="text-sm text-muted-foreground">Revisá la estructura de tu semana y abrí una rutina para editarla.</p>
            </div>
            <span className="metric-number text-sm text-muted-foreground">{routines.length} activas</span>
          </div>

          {routines.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Todavía no tenés rutinas.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {routines.map((routine) => {
                const overview = overviews.get(routine.id);
                return (
                  <Card key={routine.id} className="min-h-64 justify-between">
                    <CardContent className="flex h-full flex-col gap-5 pt-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2.5">
                            <span className="size-3 shrink-0 rounded-full border" style={{ backgroundColor: routine.color ?? "transparent" }} aria-hidden />
                            <h3 className="truncate text-lg font-semibold tracking-tight">{routine.nombre}</h3>
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">Editar la plantilla no cambia sesiones anteriores.</p>
                        </div>
                        <RoutineDeleteButton routineId={routine.id} routineName={routine.nombre} />
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
                        {(overview?.muscleGroups.length ?? 0) > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {overview?.muscleGroups.slice(0, 4).map((group) => (
                              <span key={group} className="rounded-full bg-primary/9 px-2.5 py-1 text-[11px] font-medium text-primary">{group}</span>
                            ))}
                          </div>
                        )}
                        {(overview?.exerciseNames.length ?? 0) > 0 && (
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {overview?.exerciseNames.slice(0, 4).join(" · ")}
                            {(overview?.exerciseNames.length ?? 0) > 4 ? ` · +${(overview?.exerciseNames.length ?? 0) - 4}` : ""}
                          </p>
                        )}
                      </div>

                      <Link href={`/train/routines/${routine.id}`} className="flex h-10 items-center justify-between rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted">
                        Abrir rutina <ArrowRight className="size-4 text-muted-foreground" aria-hidden />
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <aside className="col-span-4 space-y-4 lg:sticky lg:top-8">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nueva rutina</CardTitle>
              <p className="text-sm text-muted-foreground">Creá una plantilla y después agregá sus ejercicios.</p>
            </CardHeader>
            <CardContent><RoutineCreateForm /></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Plan de la planilla</CardTitle>
            </CardHeader>
            <CardContent><InitialPlanImportButton imported={initialPlan.imported} /></CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
