import Link from "next/link";
import {
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  Dumbbell,
  ListChecks,
  Play,
  Utensils,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getDayLogWithMeals } from "@/lib/phase1/day-log";
import { getMyProfile } from "@/lib/phase1/profile";
import { getInProgressSessionForUser } from "@/lib/phase2/training";
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

  return (
    <div className="space-y-7 pb-1">
      <header className="space-y-1">
        <p className="text-sm font-medium capitalize text-primary">{todayLabel(today)}</p>
        <h1 className="text-3xl font-semibold tracking-tight">Hola, {displayName}</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Todo lo importante de tu día, en un solo lugar.
        </p>
      </header>

      <section aria-labelledby="home-focus-title" className="space-y-3">
        <h2 id="home-focus-title" className="sr-only">Acción principal</h2>
        <Card className="bg-primary text-primary-foreground ring-0">
          <CardContent className="flex flex-col gap-4 pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary-foreground/75">
                  {inProgress ? "Entrenamiento en curso" : "Tu próximo paso"}
                </p>
                <h2 className="text-xl font-semibold tracking-tight">
                  {inProgress ? "Volvé a tu sesión" : "Movete hoy"}
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
          <Link href="/train/progress" className="text-xs font-medium text-primary hover:underline">
            Ver detalle
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Card size="sm">
            <CardContent className="pt-3 text-center">
              <p className="text-xl font-semibold">{currentWeek?.sessions ?? 0}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">Sesiones</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="pt-3 text-center">
              <p className="text-xl font-semibold">{currentWeek?.sets ?? 0}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">Series</p>
            </CardContent>
          </Card>
          <Card size="sm">
            <CardContent className="pt-3 text-center">
              <p className="text-xl font-semibold">{currentWeek?.minutes ?? 0}</p>
              <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">Minutos</p>
            </CardContent>
          </Card>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {hasTraining
            ? `Llevás ${currentWeek?.exercises ?? 0} ejercicios y ${number(currentWeek?.volumeKg ?? 0)} kg de volumen registrado.`
            : "Cuando finalices tu primera sesión, vas a ver acá tu avance semanal."}
        </p>
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

      <Link
        href="/train"
        className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
      >
        Abrir entrenamiento
      </Link>
    </div>
  );
}
