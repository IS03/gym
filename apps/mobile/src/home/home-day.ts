import { nutritionToday } from '@/nutrition/day-format';

import { addIsoDays } from './format';

/**
 * Home's day context with the server's day semantics: the logical day is the
 * America/Argentina/Cordoba date (same as `todayInCordoba` on the server) and the week
 * starts on Monday (same as `mondayOfIsoDate`). Computed at read time so a read issued
 * after midnight already asks for the new day and week.
 */
export type HomeDay = { today: string; weekStart: string };

export function mondayOf(date: string): string {
  const offset = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
  return addIsoDays(date, -offset);
}

export function homeDay(now: Date = new Date()): HomeDay {
  const today = nutritionToday(now);
  return { today, weekStart: mondayOf(today) };
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, index) => addIsoDays(weekStart, index));
}

export const WEEKDAY_LETTERS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const;

/** "SÁBADO 10 DE OCTUBRE" for an ISO logical date. */
export function headerDate(date: string): string {
  return new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC', weekday: 'long' })
    .format(new Date(`${date}T12:00:00Z`))
    .replace(/,/gu, '')
    .toLocaleUpperCase('es-AR');
}

/** Age of the last confirmed read, for the offline notice ("hace 2 h"). */
export function readAge(confirmedAt: number, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((now - confirmedAt) / 60_000));
  if (minutes < 1) return 'hace un momento';
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'hace 1 día' : `hace ${days} días`;
}

/** Minutes elapsed since an ISO timestamp (active session hero). */
export function elapsedMinutes(startedAt: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 60_000));
}
