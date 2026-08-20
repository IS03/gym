export type TrainingMonthDay = {
  date: string;
  inMonth: boolean;
};

function utcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

export function isoMonth(date: Date): `${number}-${number}` {
  return date.toISOString().slice(0, 7) as `${number}-${number}`;
}

export function addMonths(month: `${number}-${number}`, delta: number): `${number}-${number}` {
  const [year, monthNumber] = month.split("-").map(Number);
  return isoMonth(utcDate(year, monthNumber - 1 + delta, 1));
}

export function buildMonthGrid(
  month: `${number}-${number}`,
  options?: { full?: boolean },
): TrainingMonthDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const first = utcDate(year, monthIndex, 1);
  const last = utcDate(year, monthIndex + 1, 0);
  const leadingDays = (first.getUTCDay() + 6) % 7; // lunes = 0
  const trailingDays = (7 - ((leadingDays + last.getUTCDate()) % 7)) % 7;
  const totalDays = options?.full ? 42 : leadingDays + last.getUTCDate() + trailingDays;
  const start = utcDate(year, monthIndex, 1 - leadingDays);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = utcDate(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate() + index,
    );
    return {
      date: date.toISOString().slice(0, 10),
      inMonth: date.getUTCMonth() === monthIndex,
    };
  });
}

export function formatMonthLabel(month: `${number}-${number}`): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Cordoba",
  })
    .format(utcDate(year, monthNumber - 1, 1))
    .replace(" de ", " ");

  return value.charAt(0).toLocaleUpperCase("es-AR") + value.slice(1);
}

export function trainingCalendarHref(month: `${number}-${number}`, routineId?: string | null) {
  const params = new URLSearchParams({ month });
  if (routineId) params.set("routine_id", routineId);
  return `/train/calendar?${params.toString()}`;
}
