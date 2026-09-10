import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(path, "utf8");
const preview = source("src/components/training/training-month-preview.tsx");
const calendar = source("src/app/(app)/train/calendar/page.tsx");
const day = source("src/app/(app)/train/day/page.tsx");

describe("calendario y detalle de entrenamiento", () => {
  it("compacta el contenedor mensual sin reducir las celdas del preview", () => {
    expect(preview).toContain('<Card size="sm"');
    expect(preview).toContain('"flex min-h-9 flex-col');
    expect(preview).toContain("gap-y-0.5");
  });

  it("abre cada fecha directamente y deja de exponer el calendario duplicado desde Entrenar", () => {
    expect(preview).toContain('trainingDayHref(day.date, { source: "train" })');
    expect(preview).toContain("`${activeDayCount} días con entrenamiento`");
    expect(preview).not.toContain("/train/calendar?month=");
    expect(preview).not.toContain("Constancia del mes");
  });

  it("conserva el mes navegable y comunica hoy/entrenamiento en el calendario", () => {
    expect(calendar).toContain(
      "trainingCalendarHref(addMonths(month, -1), routineId)",
    );
    expect(calendar).toContain(
      "trainingCalendarHref(addMonths(month, 1), routineId)",
    );
    expect(calendar).toContain(
      "trainingDayHref(entry.date, { routineId: routineId || null })",
    );
    expect(calendar).toContain('aria-current={isToday ? "date" : undefined}');
    expect(calendar).toContain('trained ? ", entrenaste" : ""');
  });

  it("mantiene resumen y sesiones con el mismo layout para uno o varios entrenamientos", () => {
    expect(day).toContain("listCompletedSessionHistory({");
    expect(day).toContain("logDate: date");
    expect(day).toContain("limit: 100");
    expect(day).toContain("formatTrainingDayHeading(date)");
    expect(day).toContain("summarizeTrainingDay(sessions)");
    expect(day).toContain(
      "formatWorkoutTimeRange(session.startedAt, session.endedAt)",
    );
    expect(day).toContain(
      "formatWorkoutDuration(session.durationMilliseconds)",
    );
    expect(day).toContain("Resumen del día");
    expect(day).toContain('aria-labelledby="day-summary-title"');
    expect(day).toContain("plural(summary.sessionCount, \"entrenamiento\")");
    expect(day).toContain("formatTrainingDayVolume(summary.volumeKg)");
    expect(day).toContain("formatTrainingDayVolume(session.volumeKg)");
    expect(day).toContain("Sesiones del día");
    expect(day).toContain("sessions.map((session, index)");
    expect(day).not.toContain("sessions.length === 1");
    expect(day).not.toContain("SessionHero");
  });

  it("usa snapshots históricos y la identidad de color canónica sin acento gris", () => {
    expect(day).toContain("routineColorCssVariable");
    expect(day).toContain("routineColorCssVariable(color)");
    expect(day).toContain("<SessionIdentity color={session.routineColor} />");
    expect(day).toContain("Volumen sin registrar");
    expect(day).toContain("href={`/train/session/${session.id}`}");
    expect(day).toContain(
      "trainingDayReturnTarget(date, routineId || null, source)",
    );
    expect(day).toContain("{returnTarget.label}");
    expect(day).not.toContain("listEndedSessionsByDate");
    expect(day).not.toContain("listRoutines");
    expect(day).not.toContain("bg-muted-foreground/45");
    expect(day).not.toContain("Toca una sesión");
    expect(day).not.toContain("Aplicar");
  });
});
