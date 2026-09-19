export const MOBILE_DAILY_METRICS_API_PATH =
  "/api/mobile/v1/daily-metrics" as const;

export type MobileMetricValueType = "integer" | "decimal" | "duration";

export type MobileDailyMetricDto = {
  id: string;
  key: string | null;
  label: string;
  unit: string | null;
  valueType: MobileMetricValueType;
  value: number;
};

export type MobileDailyMetricsResponse = {
  date: string;
  metrics: MobileDailyMetricDto[];
};

export type MobileApiErrorCode = "UNAUTHORIZED" | "DATA_UNAVAILABLE";

export type MobileApiErrorResponse = {
  error: MobileApiErrorCode;
};
