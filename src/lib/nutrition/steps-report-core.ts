import {
  addIsoDays,
  listIsoDates,
  type NutritionReportRange,
} from "./reports-core";

export type StepsDayLogFact = {
  log_date: string;
  steps: number | null;
};

export type StepsReportDay = {
  date: string;
  steps: number | null;
  isToday: boolean;
  isComplete: boolean;
};

export type StepsReportSummary = {
  averageSteps: number | null;
  bestDay: StepsReportDay | null;
  daysWithData: number;
  lastRecord: StepsReportDay | null;
};

export function lastSevenCompletedStepsRange(today: string) {
  return { start: addIsoDays(today, -7), end: addIsoDays(today, -1) };
}

export function buildStepsReportDays(input: {
  range: Pick<NutritionReportRange, "start" | "end">;
  today: string;
  dayLogs: StepsDayLogFact[];
}): StepsReportDay[] {
  const logs = new Map(input.dayLogs.map((day) => [day.log_date, day]));
  return listIsoDates(input.range.start, input.range.end).map((date) => ({
    date,
    steps: logs.get(date)?.steps ?? null,
    isToday: date === input.today,
    isComplete: date < input.today,
  }));
}

export function aggregateStepsReport(days: StepsReportDay[]): StepsReportSummary {
  const completed = days.filter((day) => day.isComplete && day.steps !== null);
  const values = completed.map((day) => day.steps as number);
  const lastRecord = days.find((day) => day.steps !== null) ?? null;
  return {
    averageSteps: values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length,
    bestDay: completed.reduce<StepsReportDay | null>(
      (best, day) => !best || (day.steps as number) > (best.steps as number) ? day : best,
      null,
    ),
    daysWithData: completed.length,
    lastRecord,
  };
}
