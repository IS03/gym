const logicalDateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/** Formats an ISO logical date without letting a local timezone change its day. */
export function formatDateFieldValue(value: string | undefined, placeholder = "Elegir fecha") {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return placeholder;
  const parsed = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return placeholder;
  const parts = logicalDateFormatter.formatToParts(parsed);
  const day = parts.find((part) => part.type === "day")?.value;
  const month = parts.find((part) => part.type === "month")?.value.replace(".", "");
  const year = parts.find((part) => part.type === "year")?.value;
  return day && month && year ? `${day} ${month} ${year}` : placeholder;
}
