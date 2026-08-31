import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const preview = source("src/components/training/training-month-preview.tsx");
const calendar = source("src/app/(app)/train/calendar/page.tsx");
const day = source("src/app/(app)/train/day/page.tsx");

describe("calendario y detalle de entrenamiento", () => {
  it("compacta el contenedor mensual sin reducir las celdas del preview", () => {
    expect(preview).toContain('<Card size="sm"');
    expect(preview).toContain('"flex min-h-8 flex-col');
    expect(preview).toContain('gap-y-0.5');
  });

  it("conserva el mes navegable y comunica hoy/entrenamiento en el calendario", () => {
    expect(calendar).toContain("trainingCalendarHref(addMonths(month, -1), routineId)");
    expect(calendar).toContain("trainingCalendarHref(addMonths(month, 1), routineId)");
    expect(calendar).toContain('aria-current={isToday ? "date" : undefined}');
    expect(calendar).toContain('trained ? ", entrenaste" : ""');
  });

  it("usa sesiones completed con snapshots y elimina el filtro administrativo del día", () => {
    expect(day).toContain("listCompletedSessionHistory({ logDate: date, limit: 100 })");
    expect(day).toContain("formatTrainingDayHeading(date)");
    expect(day).toContain("summarizeTrainingDay(sessions)");
    expect(day).toContain("formatWorkoutTimeRange(session.startedAt, session.endedAt)");
    expect(day).toContain("formatWorkoutDuration(session.durationMilliseconds)");
    expect(day).toContain('href={`/train/session/${session.id}`}');
    expect(day).toContain("trainingCalendarHref(date.slice(0, 7)");
    expect(day).not.toContain("listEndedSessionsByDate");
    expect(day).not.toContain("listRoutines");
    expect(day).not.toContain("Aplicar");
  });
});
