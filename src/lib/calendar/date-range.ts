export type DateRangeValue = {
  start: string | null;
  end: string | null;
};

export type DateRangeSelection = {
  value: DateRangeValue;
  error: string | null;
};

function inclusiveDays(start: string, end: string) {
  return Math.floor(
    (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000,
  ) + 1;
}

export function isDateInRange(date: string, range: DateRangeValue) {
  return Boolean(range.start && range.end && date >= range.start && date <= range.end);
}

export function isDateSelectable(date: string, today: string) {
  return date <= today;
}

export function selectDateRange(
  current: DateRangeValue,
  date: string,
  maxDays: number,
): DateRangeSelection {
  if (!current.start || current.end) {
    return { value: { start: date, end: null }, error: null };
  }

  const start = date < current.start ? date : current.start;
  const end = date < current.start ? current.start : date;
  if (inclusiveDays(start, end) > maxDays) {
    return {
      value: current,
      error: `El período personalizado admite hasta ${maxDays} días.`,
    };
  }

  return { value: { start, end }, error: null };
}
