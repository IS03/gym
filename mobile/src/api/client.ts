import type {
  MobileDailyMetricDto,
  MobileDailyMetricsResponse,
  MobileMetricValueType,
} from "../../../src/lib/mobile-api/contracts";
import { MOBILE_DAILY_METRICS_API_PATH } from "../../../src/lib/mobile-api/contracts";
import { getMobileSupabaseClient } from "../auth/client";
import { native } from "../native/bridge";
import {
  createMobileClientHeaders,
  type MobileClientHeaders,
} from "../native/versioning";
import { mobileApiBaseUrl } from "./config";

export type MobileDailyMetricsResult =
  | { status: "ok"; data: MobileDailyMetricsResponse }
  | { status: "unauthorized" }
  | { status: "unavailable" };

type MobileApiClientDependencies = {
  baseUrl: string;
  fetchImplementation: typeof fetch;
  getAccessToken: () => Promise<string | null>;
  getVersionHeaders: () => Promise<MobileClientHeaders>;
};

const VALUE_TYPES = new Set<MobileMetricValueType>([
  "integer",
  "decimal",
  "duration",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseMetric(value: unknown): MobileDailyMetricDto | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.id !== "string" ||
    !(typeof value.key === "string" || value.key === null) ||
    typeof value.label !== "string" ||
    !(typeof value.unit === "string" || value.unit === null) ||
    typeof value.valueType !== "string" ||
    !VALUE_TYPES.has(value.valueType as MobileMetricValueType) ||
    typeof value.value !== "number" ||
    !Number.isFinite(value.value) ||
    value.value < 0
  ) {
    return null;
  }

  return {
    id: value.id,
    key: value.key,
    label: value.label,
    unit: value.unit,
    valueType: value.valueType as MobileMetricValueType,
    value: value.value,
  };
}

export function parseMobileDailyMetricsResponse(
  value: unknown,
): MobileDailyMetricsResponse | null {
  if (
    !isRecord(value) ||
    typeof value.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    !Array.isArray(value.metrics)
  ) {
    return null;
  }

  const metrics = value.metrics.map(parseMetric);
  if (metrics.some((metric) => metric === null)) {
    return null;
  }

  return {
    date: value.date,
    metrics: metrics as MobileDailyMetricDto[],
  };
}

const defaultDependencies: MobileApiClientDependencies = {
  baseUrl: mobileApiBaseUrl(),
  fetchImplementation: globalThis.fetch.bind(globalThis),
  getAccessToken: async () => {
    const { data, error } = await getMobileSupabaseClient().auth.getSession();
    if (error) throw error;
    return data.session?.access_token ?? null;
  },
  getVersionHeaders: async () => createMobileClientHeaders(await native.info()),
};

export async function fetchMobileDailyMetrics(
  dependencies: MobileApiClientDependencies = defaultDependencies,
): Promise<MobileDailyMetricsResult> {
  try {
    const accessToken = await dependencies.getAccessToken();
    if (!accessToken) {
      return { status: "unauthorized" };
    }

    const response = await dependencies.fetchImplementation(
      `${dependencies.baseUrl}${MOBILE_DAILY_METRICS_API_PATH}`,
      {
        method: "GET",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(await dependencies.getVersionHeaders()),
        },
      },
    );

    if (response.status === 401) {
      return { status: "unauthorized" };
    }
    if (!response.ok) {
      return { status: "unavailable" };
    }

    const data = parseMobileDailyMetricsResponse(await response.json());
    return data ? { status: "ok", data } : { status: "unavailable" };
  } catch {
    return { status: "unavailable" };
  }
}
