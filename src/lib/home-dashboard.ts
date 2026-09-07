import type { WorkoutSession } from "@/lib/phase2/types";

const CORDOBA_TIME_ZONE = "America/Argentina/Cordoba";
const integer = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export type HomeActiveSessionExercise = {
  sets: Array<{ isCompleted: boolean }>;
};

export type HomeActiveSessionSummary = {
  id: string;
  name: string;
  logDate: string;
  startedAt: string;
  exercisesCompleted: number;
  totalExercises: number;
  completedSets: number;
  totalSets: number;
  progressPercent: number;
};

export function progressPercent(completed: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((completed / total) * 100)));
}

export function buildHomeActiveSessionSummary(input: {
  session: Pick<
    WorkoutSession,
    "id" | "session_name" | "routine_name_snapshot" | "started_at"
  >;
  logDate: string;
  exercises: HomeActiveSessionExercise[];
}): HomeActiveSessionSummary {
  const completedSets = input.exercises.reduce(
    (total, exercise) =>
      total + exercise.sets.filter((set) => set.isCompleted).length,
    0,
  );
  const totalSets = input.exercises.reduce(
    (total, exercise) => total + exercise.sets.length,
    0,
  );
  const exercisesCompleted = input.exercises.filter(
    (exercise) =>
      exercise.sets.length > 0 && exercise.sets.every((set) => set.isCompleted),
  ).length;
  const totalExercises = input.exercises.length;

  return {
    id: input.session.id,
    name:
      input.session.session_name?.trim() ||
      input.session.routine_name_snapshot?.trim() ||
      "Sesión libre",
    logDate: input.logDate,
    startedAt: input.session.started_at,
    exercisesCompleted,
    totalExercises,
    completedSets,
    totalSets,
    progressPercent:
      totalSets > 0
        ? progressPercent(completedSets, totalSets)
        : progressPercent(exercisesCompleted, totalExercises),
  };
}

export function formatHomeActiveSessionMeta(
  session: Pick<HomeActiveSessionSummary, "logDate" | "startedAt">,
  today: string,
) {
  const time = formatHomeActiveSessionTime(session.startedAt);
  const day = session.logDate === today
    ? "Hoy"
    : new Intl.DateTimeFormat("es-AR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
        .format(new Date(`${session.logDate}T12:00:00Z`))
        .replace(".", "");

  return `${day} · iniciada ${time}`;
}

export function formatHomeActiveSessionTime(startedAt: string) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: CORDOBA_TIME_ZONE,
  }).format(new Date(startedAt));
}

export function formatHomeEnergyBalance(value: number | null) {
  if (value === null) return "—";
  const rounded = Math.round(value);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  if (normalized === 0) return "0 kcal";
  return `${normalized < 0 ? "−" : "+"}${integer.format(Math.abs(normalized))} kcal`;
}

export function isDateInRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}
