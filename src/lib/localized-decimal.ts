export const LOCALIZED_DECIMAL_MAX_FRACTION_DIGITS = 2;

function decimalPattern(maxFractionDigits: number, allowTrailingSeparator: boolean) {
  const fraction = allowTrailingSeparator
    ? `(?:[,.]\\d{0,${maxFractionDigits}})?`
    : `(?:[,.]\\d{1,${maxFractionDigits}})?`;
  return new RegExp(`^\\d+${fraction}$`);
}

export function isLocalizedDecimalDraft(
  value: string,
  maxFractionDigits = LOCALIZED_DECIMAL_MAX_FRACTION_DIGITS,
) {
  const trimmed = value.trim();
  return trimmed === "" || decimalPattern(maxFractionDigits, true).test(trimmed);
}

export function parseLocalizedDecimal(
  value: unknown,
  maxFractionDigits = LOCALIZED_DECIMAL_MAX_FRACTION_DIGITS,
): number | null {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return null;
  if (!decimalPattern(maxFractionDigits, false).test(trimmed)) return null;
  const parsed = Number(trimmed.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatLocalizedDecimal(value: number | null) {
  return value === null ? "" : String(value).replace(".", ",");
}
