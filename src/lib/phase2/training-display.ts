function formatSeconds(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatRestRange(
  minimum: number | null,
  maximum: number | null,
): string | null {
  if (minimum === null && maximum === null) return null;
  const start = minimum ?? maximum;
  const end = maximum ?? minimum;
  if (start === null || end === null) return null;
  return start === end
    ? formatSeconds(start)
    : `${formatSeconds(start)}–${formatSeconds(end)}`;
}
