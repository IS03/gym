export type TrainingCalendarCell = {
  date: string;
  day: number;
};

export type TrainingCalendarWeek = (TrainingCalendarCell | null)[];

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function monthForDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function isoDateForDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildTrainingMonth(month: string): TrainingCalendarWeek[] {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new Error('Invalid training month');
  }
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const firstWeekdayMondayFirst =
    (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cellCount = Math.ceil((firstWeekdayMondayFirst + daysInMonth) / 7) * 7;
  const cells: (TrainingCalendarCell | null)[] = Array.from(
    { length: cellCount },
    (_, index) => {
      const day = index - firstWeekdayMondayFirst + 1;
      if (day < 1 || day > daysInMonth) {
        return null;
      }
      return {
        date: `${year}-${pad(monthIndex + 1)}-${pad(day)}`,
        day,
      };
    },
  );
  return Array.from({ length: cellCount / 7 }, (_, week) =>
    cells.slice(week * 7, week * 7 + 7),
  );
}

export function formatTrainingMonth(month: string): string {
  const match = MONTH_PATTERN.exec(month);
  if (!match) {
    throw new Error('Invalid training month');
  }
  const label = new Intl.DateTimeFormat('es-AR', {
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTrainingDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
