import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Clock3,
  Dumbbell,
  Flame,
  ListChecks,
  Play,
  Utensils,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BrandSymbol } from "@/components/brand/brand-symbol";
import { MuscleDistribution, WeeklyVolumeChart } from "@/components/training/training-insights";
import { getDayLogWithMeals } from "@/lib/phase1/day-log";
import { getMyProfile } from "@/lib/phase1/profile";
import { getInProgressSessionForUser } from "@/lib/phase2/training";
import { addUtcDays, formatTrainingMinutes, mondayOfIsoDate } from "@/lib/phase2/training-progress-summary";
import { getTrainingProgress, todayInCordoba } from "@/lib/phase2/training-robust";

export const dynamic = "force-dynamic";

function number(value: number) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(value);
}

function todayLabel(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(`${date}T12:00:00Z`));
}

function descendingEntries(values: Record<string, number>) {
  return Object.entries(values).sort(
    ([leftName, leftValue], [rightName, rightValue]) =>
      rightValue - leftValue || leftName.localeCompare(rightName, "es"),
  );
}

function trainingLabel(sessions: number) {
  return `${sessions} ${sessions === 1 ? "entrenamiento" : "entrenamientos"}`;
}

type QuickAccessProps = {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
};

function QuickAccess({ href, icon: Icon, title, description }: QuickAccessProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-32 flex-col justify-between rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/8 transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-muted/60 active:scale-[0.98]"
    >
      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/12 text-primary">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="space-y-0.5">
        <span className="flex items-center gap-1 text-sm font-semibold">
          {title}
          <ArrowUpRight
            className="size-3.5 text-muted-foreground transition-transform duration-150 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
        <span className="block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </Link>
  );
}

export default async function HomePage() {
  const today = todayInCordoba();
  const [profile, todayData, inProgress, trainingProgress] = await Promise.all([
    getMyProfile(),
    getDayLogWithMeals(today),
    getInProgressSessionForUser(),
    getTrainingProgress(),
  ]);
  const { dayLog, meals } = todayData;
  const currentWeek = trainingProgress.weeks[0];
  const calories = dayLog.total_calories_consumed ?? 0;
  const target = dayLog.target_kcal_snapshot;
  const calorieProgress = target && target > 0 ? Math.min((calories / target) * 100, 100) : 0;
  const displayName = profile?.display_name?.trim() || "vos";
  const hasTraining = (currentWeek?.sessions ?? 0) > 0;
  const weekStart = currentWeek?.weekStart ?? mondayOfIsoDate(today);
  const trainingDays = new Set(currentWeek?.trainingDays ?? []);
  const routines = descendingEntries(currentWeek?.routines ?? {});
  const muscleGroups = descendingEntries(currentWeek?.muscleGroups ?? {});
  const visibleMuscles = muscleGroups.slice(0, 3);

  return (
    <>
    <div className="space-y-6 pb-1 lg:hidden">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <BrandSymbol decorative className="size-8" />
          <p className="text-right text-xs font-medium capitalize tracking-wide text-muted-foreground">
            {todayLabel(today)}
          </p>
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Hola, {displayName}</h1>
      </header>

      <section aria-labelledby="home-focus-title" className="space-y-3">
        <h2 id="home-focus-title" className="sr-only">Acción principal</h2>
        <Card className="surface-elevated border-primary/20 bg-primary text-primary-foreground ring-0">
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary-foreground/75">
                  {inProgress ? "Entrenamiento en curso" : "Tu próximo paso"}
                </p>
                <h2 className="text-xl font-semibold tracking-tight">
                  {inProgress ? "Continuar entrenamiento" : "Iniciar entrenamiento"}
                </h2>
                <p className="text-sm leading-relaxed text-primary-foreground/75">
                  {inProgress
                    ? `La sesión del ${inProgress.log_date} sigue lista para continuar.`
                    : hasTraining
                      ? "Ya sumaste una sesión esta semana. Mantené el ritmo."
                      : "Elegí una rutina y empezá a registrar tu progreso."}
                </p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
                {inProgress ? <Play className="size-5" aria-hidden /> : <Dumbbell className="size-5" aria-hidden />}
              </span>
            </div>
            <Link
              href={
                inProgress
                  ? `/train/session/${inProgress.session.id}`
                  : `/train/session/new?date=${today}`
              }
              className="flex h-11 items-center justify-center rounded-lg bg-primary-foreground px-3 text-sm font-medium text-primary transition-colors duration-150 hover:bg-primary-foreground/90 active:scale-[0.98]"
            >
              {inProgress ? "Continuar sesión" : "Iniciar entrenamiento"}
            </Link>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="home-summary-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-summary-title" className="text-base font-semibold tracking-tight">
            Resumen de hoy
          </h2>
          <Link href="/today" className="text-xs font-medium text-primary hover:underline">
            Ver nutrición
          </Link>
        </div>
        <Card>
          <CardContent className="space-y-4 pt-4">
            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Calorías consumidas</p>
                  <p className="mt-0.5 text-2xl font-semibold tracking-tight">
                    {number(calories)} <span className="text-sm font-medium text-muted-foreground">kcal</span>
                  </p>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  {target && target > 0 ? `de ${number(target)} kcal` : "Sin objetivo configurado"}
                </p>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Calorías consumidas"
                aria-valuemin={0}
                aria-valuemax={target ?? undefined}
                aria-valuenow={calories}
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-300"
                  style={{ width: `${calorieProgress}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border">
              <div className="pr-3">
                <p className="text-lg font-semibold">{number(dayLog.total_protein_g ?? 0)} g</p>
                <p className="text-xs text-muted-foreground">Proteína</p>
              </div>
              <div className="pl-3">
                <p className="text-lg font-semibold">{meals.length}</p>
                <p className="text-xs text-muted-foreground">{meals.length === 1 ? "Comida cargada" : "Comidas cargadas"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="home-progress-title" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="home-progress-title" className="text-base font-semibold tracking-tight">
            Progreso de la semana
          </h2>
          <Link href="/train/progress#weekly-report" className="text-xs font-medium text-primary hover:underline">
            Ver reporte semanal
          </Link>
        </div>
        <Card className="surface-elevated">
          <CardContent className="space-y-4 pt-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                Esta semana
              </p>
              <p className="mt-1 text-xl font-semibold tracking-tight">
                {hasTraining
                  ? `${trainingLabel(currentWeek?.sessions ?? 0)} · ${formatTrainingMinutes(currentWeek?.minutes ?? 0)}`
                  : "0 entrenamientos"}
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {hasTraining
                  ? `${currentWeek?.sets ?? 0} ${(currentWeek?.sets ?? 0) === 1 ? "serie" : "series"} completadas`
                  : "Todavía no registraste una sesión esta semana."}
              </p>
            </div>

            <div className="grid grid-cols-7 gap-1.5" aria-label="Días entrenados de esta semana">
              {["L", "M", "X", "J", "V", "S", "D"].map((label, index) => {
                const date = addUtcDays(weekStart, index);
                const trained = trainingDays.has(date);
                return (
                  <div key={date} className="flex flex-col items-center gap-1 text-[10px] text-muted-foreground">
                    <span>{label}</span>
                    <span
                      className={`size-2 rounded-full ${trained ? "bg-primary shadow-[0_0_0_3px] shadow-primary/12" : "bg-muted-foreground/25"}`}
                      aria-label={trained ? `${label}: entrenaste` : `${label}: sin entrenamiento`}
                    />
                  </div>
                );
              })}
            </div>

            {hasTraining && (
              <div className="space-y-2 border-t border-border/70 pt-3 text-xs leading-relaxed">
                {routines.length > 0 && (
                  <p className="text-foreground">
                    {routines.map(([name, count]) => `${name} ×${count}`).join(" · ")}
                  </p>
                )}
                {visibleMuscles.length > 0 && (
                  <p className="text-muted-foreground">
                    {visibleMuscles.map(([name, sets]) => `${name} ${sets}`).join(" · ")}
                    {muscleGroups.length > visibleMuscles.length
                      ? ` · +${muscleGroups.length - visibleMuscles.length} ${muscleGroups.length - visibleMuscles.length === 1 ? "músculo" : "músculos"}`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section aria-labelledby="home-shortcuts-title" className="space-y-3">
        <h2 id="home-shortcuts-title" className="text-base font-semibold tracking-tight">
          Accesos rápidos
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <QuickAccess
            href="/today"
            icon={Utensils}
            title="Nutrición"
            description="Cargá comidas y revisá tu día."
          />
          <QuickAccess
            href="/train/routines"
            icon={ListChecks}
            title="Rutinas"
            description="Organizá y editá tu plan."
          />
          <QuickAccess
            href="/train/calendar"
            icon={CalendarDays}
            title="Calendario"
            description="Mirá tu constancia semanal."
          />
          <QuickAccess
            href="/train/history"
            icon={ChartNoAxesCombined}
            title="Historial"
            description="Consultá tus ejercicios."
          />
        </div>
      </section>

    </div>

    <div className="hidden space-y-8 lg:block">
      <header className="flex items-end justify-between gap-6">
        <div className="space-y-1">
          <p className="text-sm font-medium capitalize text-muted-foreground">{todayLabel(today)}</p>
          <h1 className="text-4xl font-semibold tracking-tight">Hola, {displayName}</h1>
          <p className="text-sm text-muted-foreground">Tu entrenamiento, nutrición y progreso en un solo lugar.</p>
        </div>
        <Link
          href="/train/progress"
          className="flex h-10 items-center gap-2 rounded-lg border bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          Abrir reportes <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </header>

      <section className="grid grid-cols-12 gap-5" aria-label="Estado de hoy">
        <Card className="surface-elevated col-span-8 justify-between border-primary/20 bg-primary text-primary-foreground ring-0">
          <CardContent className="flex min-h-56 flex-col justify-between gap-8 pt-5">
            <div className="flex items-start justify-between gap-8">
              <div className="max-w-xl space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/65">
                  {inProgress ? "Entrenamiento en curso" : "Tu próximo paso"}
                </p>
                <h2 className="text-3xl font-semibold tracking-tight">
                  {inProgress ? "Continuá donde lo dejaste" : "¿Listo para entrenar?"}
                </h2>
                <p className="text-sm leading-relaxed text-primary-foreground/75">
                  {inProgress
                    ? `Tu sesión del ${inProgress.log_date} está guardada y lista para continuar.`
                    : hasTraining
                      ? "Ya sumaste una sesión esta semana. Elegí tu próxima rutina y mantené el ritmo."
                      : "Elegí una rutina, registrá tus series y empezá a construir la semana."}
                </p>
              </div>
              <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/14">
                {inProgress ? <Play className="size-7" aria-hidden /> : <Dumbbell className="size-7" aria-hidden />}
              </span>
            </div>
            <Link
              href={inProgress ? `/train/session/${inProgress.session.id}` : `/train/session/new?date=${today}`}
              className="flex h-11 w-fit min-w-52 items-center justify-center gap-2 rounded-lg bg-primary-foreground px-5 text-sm font-semibold text-primary transition-[background-color,transform] hover:bg-primary-foreground/90 active:scale-[0.98]"
            >
              {inProgress ? "Continuar sesión" : "Iniciar entrenamiento"}
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </CardContent>
        </Card>

        <Card className="surface-elevated col-span-4">
          <CardContent className="flex h-full min-h-56 flex-col justify-between gap-5 pt-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-muted-foreground">Nutrición de hoy</p>
                <p className="mt-2 metric-number text-3xl font-semibold tracking-tight">
                  {number(calories)} <span className="text-sm font-medium text-muted-foreground">kcal</span>
                </p>
              </div>
              <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Flame className="size-5" aria-hidden />
              </span>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{target && target > 0 ? `${Math.max(target - calories, 0)} kcal restantes` : "Sin objetivo configurado"}</span>
                <span>{target && target > 0 ? `${number(target)} kcal` : "—"}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${calorieProgress}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 divide-x divide-border border-t pt-4">
              <div>
                <p className="metric-number text-lg font-semibold">{number(dayLog.total_protein_g ?? 0)} g</p>
                <p className="text-xs text-muted-foreground">Proteína</p>
              </div>
              <div className="pl-4">
                <p className="metric-number text-lg font-semibold">{meals.length}</p>
                <p className="text-xs text-muted-foreground">Comidas</p>
              </div>
            </div>
            <Link href="/today" className="text-sm font-medium text-primary hover:underline">Abrir nutrición</Link>
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-4 gap-4" aria-label="Métricas de esta semana">
        {[
          { label: "Sesiones", value: String(currentWeek?.sessions ?? 0), icon: Dumbbell },
          { label: "Series completadas", value: String(currentWeek?.sets ?? 0), icon: ListChecks },
          { label: "Tiempo entrenado", value: formatTrainingMinutes(currentWeek?.minutes ?? 0), icon: Clock3 },
          { label: "Volumen total", value: `${number(currentWeek?.volumeKg ?? 0)} kg`, icon: Activity },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} size="sm">
            <CardContent className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="metric-number mt-1 text-2xl font-semibold tracking-tight">{value}</p>
              </div>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid grid-cols-12 gap-5" aria-label="Análisis semanal">
        <Card className="col-span-8">
          <CardContent className="pt-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Evolución de volumen</h2>
                <p className="text-sm text-muted-foreground">Últimas ocho semanas con sesiones registradas.</p>
              </div>
              <Link href="/train/progress" className="text-sm font-medium text-primary hover:underline">Ver detalle</Link>
            </div>
            <WeeklyVolumeChart weeks={trainingProgress.weeks} />
          </CardContent>
        </Card>

        <Card className="col-span-4">
          <CardContent className="space-y-5 pt-5">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Distribución semanal</h2>
              <p className="text-sm text-muted-foreground">Series completadas por músculo.</p>
            </div>
            <MuscleDistribution values={currentWeek?.muscleGroups ?? {}} limit={6} />
            {routines.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rutinas realizadas</p>
                <p className="mt-2 text-sm leading-relaxed">{routines.map(([name, count]) => `${name} ×${count}`).join(" · ")}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3" aria-labelledby="desktop-home-shortcuts">
        <div className="flex items-center justify-between">
          <div>
            <h2 id="desktop-home-shortcuts" className="text-lg font-semibold tracking-tight">Planificá y revisá</h2>
            <p className="text-sm text-muted-foreground">Accesos a las herramientas que más usás fuera del entrenamiento.</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <QuickAccess href="/today" icon={Utensils} title="Nutrición" description="Cargá comidas y revisá tu día." />
          <QuickAccess href="/train/routines" icon={ListChecks} title="Rutinas" description="Organizá y editá tu plan." />
          <QuickAccess href="/train/calendar" icon={CalendarDays} title="Calendario" description="Mirá tu constancia mensual." />
          <QuickAccess href="/train/history" icon={ChartNoAxesCombined} title="Historial" description="Compará registros por ejercicio." />
        </div>
      </section>
    </div>
    </>
  );
}
