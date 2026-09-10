import Link from "next/link";
import {
  Activity,
  BicepsFlexed,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Flame,
  History,
  Scale,
  UserRound,
} from "lucide-react";
import { BrandSymbol } from "@/components/brand/brand-symbol";
import { StartWorkoutSheet } from "@/components/training/start-workout-sheet";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatHomeActiveSessionMeta,
  formatHomeActiveSessionTime,
  formatHomeEnergyBalance,
  isDateInRange,
  progressPercent,
  type HomeActiveSessionSummary,
} from "@/lib/home-dashboard";
import { HOME_SETTINGS_HREF, type CompactProfile } from "@/lib/home-header";
import {
  addUtcDays,
  formatTrainingMinutes,
  mondayOfIsoDate,
} from "@/lib/phase2/training-progress-summary";
import type {
  CompletedSessionSummary,
  WeeklyTrainingSummary,
} from "@/lib/phase2/types";
import type { WorkoutStartRoutine } from "@/lib/phase2/workout-start";
import {
  formatWorkoutDuration,
  formatWorkoutTimeRange,
} from "@/app/(app)/train/session/[id]/session-editor-helpers";

const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });

type HomeNutritionSummary = {
  calories: number;
  calorieTarget: number | null;
  proteinG: number;
  proteinTargetG: number | null;
  mealCount: number;
  waterL: number | null;
  waterTargetL: number | null;
  energyBalanceKcal: number | null;
};

type HomeDashboardProps = {
  today: string;
  profile: CompactProfile;
  activeSession: HomeActiveSessionSummary | null;
  workoutStartRoutines: WorkoutStartRoutine[];
  nutrition: HomeNutritionSummary;
  week: WeeklyTrainingSummary;
  todaySessions: CompletedSessionSummary[];
};

function plural(value: number, singular: string, pluralValue = `${singular}s`) {
  return `${value} ${value === 1 ? singular : pluralValue}`;
}

function entriesByValue(values: Record<string, number>) {
  return Object.entries(values).sort(
    ([leftName, leftValue], [rightName, rightValue]) =>
      rightValue - leftValue || leftName.localeCompare(rightName, "es-AR"),
  );
}

function metricWithTarget(
  value: number | null,
  target: number | null,
  unit: string,
) {
  const current = value === null ? "—" : decimal.format(value);
  return target === null
    ? `${current} ${unit}`
    : `${current} / ${decimal.format(target)} ${unit}`;
}

function SectionHeader({
  id,
  title,
  href,
  action,
}: {
  id: string;
  title: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3">
      <h2 id={id} className="text-base font-semibold tracking-tight lg:text-lg">
        {title}
      </h2>
      {href && action ? (
        <Link
          href={href}
          className="inline-flex min-h-8 shrink-0 items-center gap-0.5 text-xs font-medium text-primary outline-none hover:underline focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring lg:text-sm"
        >
          {action}
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      ) : null}
    </div>
  );
}

function PrimaryTrainingCard({
  today,
  activeSession,
  workoutStartRoutines,
}: Pick<HomeDashboardProps, "today" | "activeSession" | "workoutStartRoutines">) {
  const progressLabel = activeSession
    ? `${activeSession.exercisesCompleted}/${activeSession.totalExercises} ${activeSession.totalExercises === 1 ? "ejercicio" : "ejercicios"} · ${activeSession.completedSets}/${activeSession.totalSets} ${activeSession.totalSets === 1 ? "serie" : "series"}`
    : null;

  return (
    <section aria-labelledby="home-training-title" className="lg:col-span-7">
      <Card className="surface-elevated relative min-h-[13rem] border-primary/20 bg-primary text-primary-foreground ring-0">
        <span className="pointer-events-none absolute -right-7 -top-12 size-28 rounded-full bg-primary-foreground/8" aria-hidden />
        <span className="pointer-events-none absolute right-9 top-3 size-16 rounded-full bg-primary-foreground/7" aria-hidden />
        <span className="pointer-events-none absolute right-3 top-20 size-10 rounded-full bg-primary-foreground/10" aria-hidden />
        <CardContent className="relative flex min-h-[11rem] flex-col justify-between gap-4">
          {activeSession ? (
            <div className="space-y-2">
              <span className="inline-flex rounded-full bg-primary-foreground/14 px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                Sesión en curso
              </span>
              <div>
                <h1 id="home-training-title" className="max-w-[80%] truncate text-2xl font-semibold tracking-tight">
                  {activeSession.name}
                </h1>
                <p className="mt-0.5 text-sm text-primary-foreground/75">
                  {formatHomeActiveSessionMeta(activeSession, today)}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-primary-foreground/80">
                  <span>{progressLabel}</span>
                  <span className="metric-number shrink-0">{activeSession.progressPercent}%</span>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full bg-primary-foreground/20"
                  role="progressbar"
                  aria-label="Progreso de la sesión"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={activeSession.progressPercent}
                >
                  <div
                    className="h-full rounded-full bg-primary-foreground/90"
                    style={{ width: `${activeSession.progressPercent}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-[85%] space-y-1">
              <p className="text-sm font-medium text-primary-foreground/72">Entrenamiento</p>
              <h1 id="home-training-title" className="text-2xl font-semibold tracking-tight">
                Iniciar entrenamiento
              </h1>
              <p className="max-w-xs text-sm leading-relaxed text-primary-foreground/78">
                Elegí una rutina o empezá una sesión libre.
              </p>
            </div>
          )}

          {activeSession ? (
            <Link
              href={`/train/session/${activeSession.id}`}
              className="flex h-11 items-center justify-center rounded-lg bg-primary-foreground px-3 text-sm font-semibold text-primary outline-none transition-[background-color,transform] duration-150 hover:bg-primary-foreground/90 focus-visible:ring-2 focus-visible:ring-primary-foreground/70 active:scale-[0.98]"
            >
              Continuar entrenamiento
            </Link>
          ) : (
            <StartWorkoutSheet
              routines={workoutStartRoutines}
              activeSession={null}
              triggerAriaLabel="Iniciar entrenamiento"
              triggerClassName="flex h-11 items-center justify-center rounded-lg bg-primary-foreground px-3 text-sm font-semibold text-primary outline-none transition-[background-color,transform] duration-150 hover:bg-primary-foreground/90 focus-visible:ring-2 focus-visible:ring-primary-foreground/70 active:scale-[0.98]"
            >
              Iniciar entrenamiento
            </StartWorkoutSheet>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function TodaySummary({ nutrition }: { nutrition: HomeNutritionSummary }) {
  const calorieProgress = progressPercent(
    nutrition.calories,
    nutrition.calorieTarget ?? 0,
  );
  const proteinProgress = progressPercent(
    nutrition.proteinG,
    nutrition.proteinTargetG ?? 0,
  );
  const waterProgress = progressPercent(
    nutrition.waterL ?? 0,
    nutrition.waterTargetL ?? 0,
  );

  return (
    <section aria-labelledby="home-today-title" className="space-y-3 lg:col-span-5">
      <SectionHeader id="home-today-title" title="Resumen de hoy" href="/today" action="Ver nutrición" />
      <Card className="surface-elevated">
        <CardContent className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Flame className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Calorías consumidas</p>
                <div className="flex items-end justify-between gap-3">
                  <p className="metric-number truncate text-2xl font-semibold tracking-tight">
                    {integer.format(nutrition.calories)} <span className="text-sm font-medium text-muted-foreground">kcal</span>
                  </p>
                  <p className="shrink-0 pb-0.5 text-right text-xs text-muted-foreground">
                    {nutrition.calorieTarget && nutrition.calorieTarget > 0
                      ? `de ${integer.format(nutrition.calorieTarget)} kcal`
                      : "Sin objetivo"}
                  </p>
                </div>
              </div>
            </div>
            {nutrition.calorieTarget && nutrition.calorieTarget > 0 ? (
              <div
                className="h-2 overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Calorías consumidas"
                aria-valuemin={0}
                aria-valuemax={nutrition.calorieTarget}
                aria-valuenow={nutrition.calories}
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${calorieProgress}%` }} />
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="min-w-0 pr-2.5">
              <p className="metric-number truncate text-[15px] font-semibold">
                {metricWithTarget(nutrition.proteinG, nutrition.proteinTargetG, "g")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Proteína</p>
              {nutrition.proteinTargetG && nutrition.proteinTargetG > 0 ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${proteinProgress}%` }} />
                </div>
              ) : null}
            </div>
            <div className="min-w-0 px-2.5">
              <p className="metric-number text-[15px] font-semibold">{nutrition.mealCount}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{nutrition.mealCount === 1 ? "cargada" : "cargadas"}</p>
            </div>
            <div className="min-w-0 pl-2.5">
              <p className="metric-number truncate text-[15px] font-semibold">
                {metricWithTarget(nutrition.waterL, nutrition.waterTargetL, "L")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">Agua</p>
              {nutrition.waterTargetL && nutrition.waterTargetL > 0 ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${waterProgress}%` }} />
                </div>
              ) : null}
            </div>
          </div>

          <Link
            href="/today"
            className="group flex min-h-12 items-center gap-3 border-t border-border/70 pt-3 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Activity className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs text-muted-foreground">Balance estimado</span>
              <span className="metric-number mt-0.5 block font-semibold">
                {formatHomeEnergyBalance(nutrition.energyBalanceKcal)}
              </span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </CardContent>
      </Card>
    </section>
  );
}

function WeekDayIndicator({
  label,
  completed,
  active,
  today,
}: {
  label: string;
  completed: boolean;
  active: boolean;
  today: boolean;
}) {
  const state = active && completed
    ? "entrenamiento completado y sesión en curso"
    : active
      ? "sesión en curso"
      : completed
        ? "entrenamiento completado"
        : "sin entrenamiento";

  return (
    <div className="flex min-w-0 flex-col items-center text-[10px] text-muted-foreground">
      <span>{label}</span>
      <span className="mt-1 flex size-4 items-center justify-center" role="img" aria-label={`${label}: ${state}`}>
        {active ? (
          <span className="flex size-3.5 items-center justify-center rounded-full border-2 border-primary bg-card">
            {completed ? <span className="size-1.5 rounded-full bg-primary" /> : null}
          </span>
        ) : (
          <span className={`size-2.5 rounded-full ${completed ? "bg-primary shadow-[0_0_0_3px] shadow-primary/12" : "bg-muted-foreground/25"}`} />
        )}
      </span>
      <span className="mt-0.5 min-h-3 font-medium text-primary">{today ? "Hoy" : ""}</span>
    </div>
  );
}

function WeeklyProgress({
  today,
  week,
  activeSession,
}: Pick<HomeDashboardProps, "today" | "week" | "activeSession">) {
  const weekStart = week.weekStart ?? mondayOfIsoDate(today);
  const weekEnd = addUtcDays(weekStart, 6);
  const activeThisWeek = activeSession && isDateInRange(activeSession.logDate, weekStart, weekEnd)
    ? activeSession
    : null;
  const completedDays = new Set(week.trainingDays);
  const routines = entriesByValue(week.routines);
  const muscles = entriesByValue(week.muscleGroups);
  const visibleMuscles = muscles.slice(0, 3);
  const routineSummary = routines.length
    ? routines.map(([name, count]) => `${name} ×${count}`).join(" · ")
    : "Sin rutinas completadas";
  const muscleSummary = visibleMuscles.length
    ? `${visibleMuscles.map(([name, sets]) => `${name} ${sets}`).join(" · ")}${muscles.length > visibleMuscles.length ? ` · +${muscles.length - visibleMuscles.length}` : ""}`
    : "Sin series registradas";
  const hasCompletedTraining = week.sessions > 0;

  return (
    <section aria-labelledby="home-week-title" className="space-y-3 lg:col-span-7">
      <SectionHeader id="home-week-title" title="Progreso de la semana" href="/train/progress?period=1w" action="Ver reporte" />
      <Card className="surface-elevated">
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">Esta semana</p>
              <p className="metric-number mt-1 text-lg font-semibold tracking-tight">
                {activeThisWeek
                  ? `${week.sessions} ${week.sessions === 1 ? "completado" : "completados"} · 1 en curso`
                  : hasCompletedTraining
                    ? `${plural(week.sessions, "entrenamiento")} · ${formatTrainingMinutes(week.minutes)}`
                    : "0 entrenamientos"}
              </p>
              <p className="metric-number mt-0.5 text-sm text-muted-foreground">
                {activeThisWeek
                  ? `${plural(week.sets, "serie")} ${week.sets === 1 ? "completada" : "completadas"} · ${formatTrainingMinutes(week.minutes)}`
                  : hasCompletedTraining
                    ? `${plural(week.sets, "serie")} ${week.sets === 1 ? "completada" : "completadas"}`
                    : "Todavía no completaste una sesión esta semana."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1" aria-label="Actividad de esta semana">
            {["L", "M", "X", "J", "V", "S", "D"].map((label, index) => {
              const date = addUtcDays(weekStart, index);
              return (
                <WeekDayIndicator
                  key={date}
                  label={label}
                  completed={completedDays.has(date)}
                  active={activeThisWeek?.logDate === date}
                  today={date === today}
                />
              );
            })}
          </div>

          <div className="divide-y divide-border/70 border-t border-border/70">
            <Link
              href="/train/progress?view=routines&period=1w"
              className="group flex min-h-14 items-center gap-3 py-2.5 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Dumbbell className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Rutinas</span>
                <span className="mt-0.5 line-clamp-2 block text-sm font-medium">{routineSummary}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <Link
              href="/train/progress?view=muscles&period=1w"
              className="group flex min-h-14 items-center gap-3 py-2.5 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BicepsFlexed className="size-[18px]" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs text-muted-foreground">Músculos principales</span>
                <span className="mt-0.5 line-clamp-2 block text-sm font-medium">{muscleSummary}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function ActiveSessionRow({ session }: { session: HomeActiveSessionSummary }) {
  return (
    <Link
      href={`/train/session/${session.id}`}
      className="group flex min-h-[82px] items-center gap-3 px-4 py-3 outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Dumbbell className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{session.name}</span>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">En curso</span>
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">
          {formatHomeActiveSessionTime(session.startedAt)} · En curso
        </span>
        <span className="metric-number mt-1 block text-xs text-muted-foreground">
          {session.exercisesCompleted}/{session.totalExercises} {session.totalExercises === 1 ? "ejercicio" : "ejercicios"} · {session.completedSets}/{session.totalSets} {session.totalSets === 1 ? "serie" : "series"}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function CompletedSessionRow({ session }: { session: CompletedSessionSummary }) {
  const range = formatWorkoutTimeRange(session.startedAt, session.endedAt);
  const duration = formatWorkoutDuration(session.durationMilliseconds);
  return (
    <Link
      href={`/train/session/${session.id}`}
      className="group flex min-h-[82px] items-center gap-3 px-4 py-3 outline-none hover:bg-muted/35 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Dumbbell className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{session.routineName}</span>
        <span className="metric-number mt-1 block text-xs text-muted-foreground">
          {[range, duration].filter(Boolean).join(" · ") || "Sesión completada"}
        </span>
        <span className="metric-number mt-1 block text-xs text-muted-foreground">
          {plural(session.exercisesCompleted, "ejercicio")} · {plural(session.completedSets, "serie")}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

function TodaySessions({
  today,
  activeSession,
  sessions,
}: {
  today: string;
  activeSession: HomeActiveSessionSummary | null;
  sessions: CompletedSessionSummary[];
}) {
  const activeToday = activeSession?.logDate === today ? activeSession : null;
  if (!activeToday && sessions.length === 0) return null;

  return (
    <section aria-labelledby="home-sessions-title" className="space-y-3 lg:col-span-5">
      <SectionHeader id="home-sessions-title" title="Sesiones de hoy" href="/train/history?view=sessions" action="Ver historial" />
      <Card className="gap-0 py-0">
        <div className="divide-y divide-border/70">
          {activeToday ? <ActiveSessionRow session={activeToday} /> : null}
          {sessions.map((session) => <CompletedSessionRow key={session.id} session={session} />)}
        </div>
      </Card>
    </section>
  );
}

type QuickAccessProps = {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
};

function QuickAccess({ href, icon: Icon, title }: QuickAccessProps) {
  return (
    <Link
      href={href}
      className="group flex min-h-16 items-center gap-3 rounded-xl bg-card p-3.5 shadow-sm ring-1 ring-foreground/8 outline-none transition-[background-color,transform,box-shadow] duration-150 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 text-sm font-semibold">{title}</span>
    </Link>
  );
}

function QuickAccesses() {
  return (
    <section aria-labelledby="home-shortcuts-title" className="space-y-3 lg:col-span-12">
      <SectionHeader id="home-shortcuts-title" title="Accesos rápidos" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <QuickAccess href="/train/routines" icon={Dumbbell} title="Rutinas" />
        <QuickAccess href="/calendar" icon={CalendarDays} title="Calendario" />
        <QuickAccess href="/train/body" icon={Scale} title="Cuerpo" />
        <QuickAccess href="/history" icon={History} title="Historial diario" />
      </div>
    </section>
  );
}

export function HomeDashboard({
  today,
  profile,
  activeSession,
  workoutStartRoutines,
  nutrition,
  week,
  todaySessions,
}: HomeDashboardProps) {
  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-2">
      <header className="flex min-h-11 items-center justify-between gap-4">
        <Link href="/home" aria-label="Inicio de OWNLEVEL" className="inline-flex min-w-0 items-center gap-2 outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-ring">
          <BrandSymbol decorative className="size-8" />
          <span className="truncate text-xs font-bold tracking-[0.16em]">OWNLEVEL</span>
        </Link>
        <Link
          href={HOME_SETTINGS_HREF}
          aria-label="Abrir perfil y ajustes"
          className="home-profile-link group flex h-11 max-w-[55%] min-w-0 items-center gap-2 rounded-full border border-border/80 bg-card/80 px-2.5 shadow-sm outline-none transition-[background-color,border-color,transform,box-shadow] duration-[120ms] ease-out hover:border-border hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97]"
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary" aria-hidden>
            {profile.initial ?? <UserRound className="size-3.5" />}
          </span>
          <span className="truncate text-sm font-medium">{profile.label}</span>
          <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
        </Link>
      </header>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <PrimaryTrainingCard today={today} activeSession={activeSession} workoutStartRoutines={workoutStartRoutines} />
        <TodaySummary nutrition={nutrition} />
        <WeeklyProgress today={today} week={week} activeSession={activeSession} />
        <TodaySessions today={today} activeSession={activeSession} sessions={todaySessions} />
        <QuickAccesses />
      </div>
    </div>
  );
}
