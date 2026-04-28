/** Lógica pura del autosave (testeable, sin dependencias de React). */

export function toNullableNumber(value: string): number | null {
  const raw = value.trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Añade series / reps / peso al FormData. Siempre incluye las claves
 * (vacío = numOptional → null en servidor) para poder limpiar valores.
 */
export function appendNumericSessionFields(
  formData: FormData,
  series: string,
  reps: string,
  peso: string,
) {
  const s = toNullableNumber(series);
  const r = toNullableNumber(reps);
  const p = toNullableNumber(peso);
  formData.set("series_reales", s === null ? "" : String(s));
  formData.set("reps_reales", r === null ? "" : String(r));
  formData.set("peso_real", p === null ? "" : String(p));
}
