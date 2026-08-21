export type CalendarMonth = `${number}-${number}`;

export type CalendarMonthDay = {
  date: string;
  inMonth: boolean;
};

function utcDate(year: number, monthIndex: number, day: number) {
  return new Date(Date.UTC(year, monthIndex, day, 12));
}

export function isCalendarMonth(value: string | undefined | null): value is CalendarMonth {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isoMonth(date: Date): CalendarMonth {
  return date.toISOString().slice(0, 7) as CalendarMonth;
}

export function addMonths(month: CalendarMonth, delta: number): CalendarMonth {
  const [year, monthNumber] = month.split("-").map(Number);
  return isoMonth(utcDate(year, monthNumber - 1 + delta, 1));
}

export function buildMonthGrid(
  month: CalendarMonth,
  options?: { full?: boolean },
): CalendarMonthDay[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthIndex = monthNumber - 1;
  const first = utcDate(year, monthIndex, 1);
  const last = utcDate(year, monthIndex + 1, 0);
  const leadingDays = (first.getUTCDay() + 6) % 7;
  const trailingDays = (7 - ((leadingDays + last.getUTCDate()) % 7)) % 7;
  const totalDays = options?.full ? 42 : leadingDays + last.getUTCDate() + trailingDays;
  const start = utcDate(year, monthIndex, 1 - leadingDays);

  return Array.from({ length: totalDays }, (_, index) => {
    const date = utcDate(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), inMonth: date.getUTCMonth() === monthIndex };
  });
}

export function formatMonthLabel(month: CalendarMonth): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const value = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Cordoba",
  }).format(utcDate(year, monthNumber - 1, 1)).replace(" de ", " ");
  return value.charAt(0).toLocaleUpperCase("es-AR") + value.slice(1);
}

/** Normaliza URLs manuales e impide navegar el calendario a meses futuros. */
export function resolveCalendarMonth(value: string | undefined, currentMonth: CalendarMonth): CalendarMonth {
  return isCalendarMonth(value) && value <= currentMonth ? value : currentMonth;
}
