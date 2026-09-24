const CORDOBA_TIME_ZONE = 'America/Argentina/Cordoba';
const integer = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

export function formatInteger(value: number): string {
  return integer.format(value);
}

export function formatDecimal(value: number): string {
  return decimal.format(value);
}

export function firstName(displayName: string | null): string {
  return displayName?.trim().split(/\s+/u)[0] || 'Perfil';
}

export function profileInitial(displayName: string | null): string | null {
  const name = firstName(displayName);
  return name === 'Perfil'
    ? null
    : Array.from(name)[0]?.toLocaleUpperCase('es-AR') ?? null;
}

export function formatEnergyBalance(value: number | null): string {
  if (value === null) {
    return '—';
  }
  const rounded = Math.round(value);
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  if (normalized === 0) {
    return '0 kcal';
  }
  return `${normalized < 0 ? '−' : '+'}${integer.format(Math.abs(normalized))} kcal`;
}

export function formatClockTime(timestamp: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    hour: '2-digit',
    hourCycle: 'h23',
    minute: '2-digit',
    timeZone: CORDOBA_TIME_ZONE,
  }).format(new Date(timestamp));
}

export function formatTimeRange(startedAt: string, endedAt: string): string {
  return `${formatClockTime(startedAt)}–${formatClockTime(endedAt)}`;
}

export function formatDuration(milliseconds: number | null): string | null {
  if (milliseconds === null || !Number.isFinite(milliseconds) || milliseconds < 0) {
    return null;
  }
  const minutes = Math.floor(milliseconds / 60_000);
  if (minutes === 0) {
    return '<1 min';
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours === 0
    ? `${minutes} min`
    : `${hours} h ${remainingMinutes > 0 ? `${remainingMinutes} min` : ''}`.trim();
}

export function formatTrainingMinutes(minutes: number): string {
  if (minutes < 60) {
    return `${integer.format(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0
    ? `${hours} h ${remainingMinutes} min`
    : `${hours} h`;
}

export function plural(
  value: number,
  singular: string,
  pluralValue = `${singular}s`,
): string {
  return `${integer.format(value)} ${value === 1 ? singular : pluralValue}`;
}

export function addIsoDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function entriesByCount(values: Record<string, number>) {
  return Object.entries(values).sort(
    ([leftName, leftValue], [rightName, rightValue]) =>
      rightValue - leftValue || leftName.localeCompare(rightName, 'es-AR'),
  );
}
