import type {
  MobileApiErrorResponse,
  MobileDailyMetricDto,
  MobileDailyMetricsResponse,
  MobileMetricValueType,
} from "./contracts";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type MobileMetricDefinitionRow = {
  id: string;
  systemKey: string | null;
  label: string;
  unit: string | null;
  valueType: MobileMetricValueType;
};

export type MobileMetricValueRow = {
  metricId: string;
  value: unknown;
};

export type MobileDailyMetricsRepository = {
  readDefinitions: (userId: string) => Promise<MobileMetricDefinitionRow[]>;
  readValues: (
    userId: string,
    date: string,
  ) => Promise<MobileMetricValueRow[]>;
  readLatestRecordedDate: (
    userId: string,
    throughDate: string,
  ) => Promise<string | null>;
};

export type MobileAuthenticatedContext = {
  userId: string;
  repository: MobileDailyMetricsRepository;
};

export class MobileApiUnauthorizedError extends Error {
  readonly httpStatus = 401;

  constructor() {
    super("Unauthorized");
    this.name = "MobileApiUnauthorizedError";
  }
}

export function isRejectedMobileAccessToken(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as { code?: unknown; status?: unknown };
  const code = typeof record.code === "string"
    ? record.code.toLowerCase()
    : "";
  return (
    Number(record.status) === 401 ||
    code === "bad_jwt" ||
    code === "invalid_jwt" ||
    code === "user_not_found"
  );
}

function bearerToken(authorization: string | null): string {
  if (!authorization || authorization.length > 8_192) {
    throw new MobileApiUnauthorizedError();
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authorization);
  if (!match?.[1]) {
    throw new MobileApiUnauthorizedError();
  }

  return match[1];
}

function metricValue(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Invalid daily metric value");
  }
  return parsed;
}

export function buildMobileDailyMetricsResponse(
  date: string,
  definitions: MobileMetricDefinitionRow[],
  values: MobileMetricValueRow[],
): MobileDailyMetricsResponse {
  if (!ISO_DATE.test(date)) {
    throw new Error("Invalid semantic date");
  }

  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const valuesByMetric = new Map(
    values.map((row) => [row.metricId, metricValue(row.value)]),
  );
  const metrics: MobileDailyMetricDto[] = [];

  for (const definition of definitions) {
    const value = valuesByMetric.get(definition.id);
    if (value === undefined) {
      continue;
    }

    metrics.push({
      id: definition.id,
      key: definition.systemKey,
      label: definition.label,
      unit: definition.unit,
      valueType: definition.valueType,
      value,
    });
  }

  if (values.some((row) => !definitionsById.has(row.metricId))) {
    throw new Error("Daily metric definition unavailable");
  }

  return { date, metrics };
}

export async function readMobileDailyMetrics(
  repository: MobileDailyMetricsRepository,
  userId: string,
  today: string,
): Promise<MobileDailyMetricsResponse> {
  const [definitions, todayValues] = await Promise.all([
    repository.readDefinitions(userId),
    repository.readValues(userId, today),
  ]);

  if (todayValues.length > 0) {
    return buildMobileDailyMetricsResponse(today, definitions, todayValues);
  }

  const latestDate = await repository.readLatestRecordedDate(userId, today);
  if (!latestDate || latestDate === today) {
    return { date: today, metrics: [] };
  }

  const latestValues = await repository.readValues(userId, latestDate);
  return buildMobileDailyMetricsResponse(
    latestDate,
    definitions,
    latestValues,
  );
}

export type MobileDailyMetricsHandlerResult =
  | { status: 200; body: MobileDailyMetricsResponse }
  | { status: 401 | 503; body: MobileApiErrorResponse };

export async function handleMobileDailyMetricsRequest(
  authorization: string | null,
  dependencies: {
    authenticate: (accessToken: string) => Promise<MobileAuthenticatedContext>;
    read: (
      context: MobileAuthenticatedContext,
    ) => Promise<MobileDailyMetricsResponse>;
  },
): Promise<MobileDailyMetricsHandlerResult> {
  try {
    const accessToken = bearerToken(authorization);
    const context = await dependencies.authenticate(accessToken);
    return { status: 200, body: await dependencies.read(context) };
  } catch (error) {
    if (error instanceof MobileApiUnauthorizedError) {
      return { status: 401, body: { error: "UNAUTHORIZED" } };
    }
    return { status: 503, body: { error: "DATA_UNAVAILABLE" } };
  }
}
