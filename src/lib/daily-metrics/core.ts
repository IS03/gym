import { parseLocalizedDecimal } from "../localized-decimal";

export const SYSTEM_METRIC_KEYS = ["steps", "water", "mate", "sleep"] as const;
export const METRIC_VALUE_TYPES = ["integer", "decimal", "duration"] as const;

export type SystemMetricKey = (typeof SYSTEM_METRIC_KEYS)[number];
export type MetricValueType = (typeof METRIC_VALUE_TYPES)[number];

export type UserMetric = {
  id: string;
  user_id: string;
  system_key: SystemMetricKey | null;
  name: string;
  unit: string | null;
  value_type: MetricValueType;
  target_value: number | null;
  sort_order: number;
  is_active: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  has_history: boolean;
};

export type DailyMetricWithValue = UserMetric & {
  value: number | null;
};

export type DailyMetricValueFact = {
  metric_id: string;
  value: number | null;
};

export function buildHistoricalDailyMetrics(
  metrics: UserMetric[],
  values: DailyMetricValueFact[],
) {
  const valueByMetric = new Map(values.map((row) => [row.metric_id, row.value]));
  const merged = metrics.map((metric) => ({
    ...metric,
    value: valueByMetric.get(metric.id) ?? null,
  }));
  return {
    recorded: merged.filter((metric) => metric.value !== null),
    editable: merged.filter((metric) => metric.is_active || metric.value !== null),
  };
}

export const SYSTEM_METRIC_DEFAULTS = [
  { systemKey: "steps", name: "Pasos", unit: "pasos", valueType: "integer", target: 10_000, sortOrder: 0 },
  { systemKey: "water", name: "Agua", unit: "L", valueType: "decimal", target: 2.5, sortOrder: 1 },
  { systemKey: "mate", name: "Mate", unit: "L", valueType: "decimal", target: null, sortOrder: 2 },
  { systemKey: "sleep", name: "Sueño", unit: "min", valueType: "duration", target: 480, sortOrder: 3 },
] as const satisfies ReadonlyArray<{
  systemKey: SystemMetricKey;
  name: string;
  unit: string;
  valueType: MetricValueType;
  target: number | null;
  sortOrder: number;
}>;

export function metricTypeLabel(type: MetricValueType) {
  if (type === "integer") return "Número entero";
  if (type === "decimal") return "Decimal";
  return "Duración";
}

export function parseMetricTarget(value: unknown, type: MetricValueType) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = parseLocalizedDecimal(raw, 4);
  if (parsed === null || parsed < 0) throw new Error("El objetivo debe ser un número válido.");
  if ((type === "integer" || type === "duration") && !Number.isInteger(parsed)) {
    throw new Error("El objetivo debe ser entero.");
  }
  return parsed;
}

export function parseDailyMetricValue(value: unknown, type: MetricValueType) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = parseLocalizedDecimal(raw, 4);
  if (parsed === null || parsed < 0) throw new Error("El valor debe ser un número válido.");
  if ((type === "integer" || type === "duration") && !Number.isInteger(parsed)) {
    throw new Error("El valor debe ser entero.");
  }
  return parsed;
}

export function normalizeMetricName(value: unknown) {
  const name = String(value ?? "").trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  if (name.length > 80) throw new Error("El nombre no puede superar 80 caracteres.");
  return name;
}

export function normalizeMetricUnit(value: unknown, type: MetricValueType) {
  if (type === "duration") return "min";
  const unit = String(value ?? "").trim();
  if (unit.length > 16) throw new Error("La unidad no puede superar 16 caracteres.");
  return unit || null;
}

export function formatMetricTarget(metric: Pick<UserMetric, "target_value" | "unit" | "value_type">) {
  if (metric.target_value === null) return "Sin objetivo";
  if (metric.value_type === "duration") {
    const hours = Math.floor(metric.target_value / 60);
    const minutes = metric.target_value % 60;
    if (!hours && !minutes) return "Objetivo 0 min";
    return `Objetivo ${hours ? `${hours} h` : ""}${hours && minutes ? " " : ""}${minutes ? `${minutes} min` : ""}`;
  }
  return `Objetivo ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 }).format(metric.target_value)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

const metricNumberFormatter = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 4 });

export function formatDurationMinutes(value: number) {
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

export function formatDailyMetricValue(
  value: number | null,
  metric: Pick<UserMetric, "unit" | "value_type">,
) {
  if (value === null) return "—";
  if (metric.value_type === "duration") return formatDurationMinutes(value);
  return `${metricNumberFormatter.format(value)}${metric.unit ? ` ${metric.unit}` : ""}`;
}

export function formatDailyMetricProgress(
  value: number | null,
  metric: Pick<UserMetric, "target_value" | "unit" | "value_type">,
) {
  const current = formatDailyMetricValue(value, metric);
  if (metric.target_value === null) return current;
  return `${current} / ${formatDailyMetricValue(metric.target_value, metric)}`;
}

export function moveMetric<T>(items: T[], index: number, direction: -1 | 1) {
  const destination = index + direction;
  if (destination < 0 || destination >= items.length) return items;
  const next = [...items];
  [next[index], next[destination]] = [next[destination], next[index]];
  return next;
}
