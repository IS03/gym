export type PerformanceStatus =
  | "ok"
  | "error"
  | "authenticated"
  | "unauthenticated"
  | "invalid_session";

export type PerformanceErrorCategory =
  | "timeout"
  | "gateway_timeout"
  | "network"
  | "auth"
  | "database"
  | "unknown";

export type PerformanceRequestKind = "navigation" | "rsc" | "prefetch";

export type PerformanceLayer =
  | "auth"
  | "database"
  | "transport"
  | "application";

export type ReliabilityErrorCode =
  | "AUTH_TIMEOUT"
  | "DATABASE_TIMEOUT"
  | "NETWORK_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "UNKNOWN";

export type RequestPerformanceContext = {
  requestKind: PerformanceRequestKind;
  vercelId?: string;
};

export type PerformanceEvent = {
  route: string;
  operation: string;
  durationMs: number;
  status: PerformanceStatus;
  errorCategory?: PerformanceErrorCategory;
  errorCode?: ReliabilityErrorCode;
  layer?: PerformanceLayer;
  requestKind?: PerformanceRequestKind;
  vercelId?: string;
  httpStatus?: number;
  providerCode?: string;
};

type PerformanceLogger = Pick<Console, "info">;

type PerformanceErrorMetadata = Pick<
  PerformanceEvent,
  "errorCategory" | "errorCode" | "httpStatus" | "providerCode"
>;

function errorRecords(error: unknown): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  let current = error;

  for (let depth = 0; depth < 3; depth += 1) {
    if (typeof current !== "object" || current === null) break;
    const record = current as Record<string, unknown>;
    records.push(record);
    current = record.cause;
  }

  return records;
}

function errorHttpStatus(error: unknown): number | undefined {
  for (const record of errorRecords(error)) {
    for (const value of [record.httpStatus, record.statusCode, record.status]) {
      const parsed = typeof value === "number" ? value : Number(value);
      if (Number.isInteger(parsed) && parsed >= 400 && parsed <= 599) {
        return parsed;
      }
    }

    if (typeof record.code === "string" && /^\d{3}$/.test(record.code)) {
      const parsed = Number(record.code);
      if (parsed >= 400 && parsed <= 599) return parsed;
    }
  }

  return undefined;
}

function errorProviderCode(error: unknown): string | undefined {
  for (const record of errorRecords(error)) {
    if (typeof record.code !== "string") continue;
    const code = record.code.trim();
    if (
      /^PGRST\d{3}$/i.test(code)
      || /^[0-9A-Z]{5}$/.test(code)
      || /^[a-z][a-z0-9_]{1,63}$/.test(code)
    ) {
      return /^PGRST/i.test(code) ? code.toUpperCase() : code;
    }
  }

  return undefined;
}

function boundedProviderCode(value: string | undefined): value is string {
  return typeof value === "string"
    && (
      /^PGRST\d{3}$/.test(value)
      || /^[0-9A-Z]{5}$/.test(value)
      || /^[a-z][a-z0-9_]{1,63}$/.test(value)
    );
}

function boundedHttpStatus(value: number | undefined): value is number {
  return typeof value === "number"
    && Number.isInteger(value)
    && value >= 400
    && value <= 599;
}

function errorMessageIncludes(error: unknown, value: string): boolean {
  return errorRecords(error).some((record) => (
    typeof record.message === "string"
    && record.message.toLocaleLowerCase("en").includes(value)
  ));
}

export function performanceErrorCategory(
  error: unknown,
): PerformanceErrorCategory {
  const records = errorRecords(error);
  const names = records.flatMap((record) => (
    typeof record.name === "string" ? [record.name] : []
  ));
  const codes = records.flatMap((record) => (
    typeof record.code === "string" ? [record.code] : []
  ));
  const messages = records.flatMap((record) => (
    typeof record.message === "string"
      ? [record.message.toLocaleLowerCase("en")]
      : []
  ));
  const httpStatus = errorHttpStatus(error);

  if (
    messages.some((message) => message.includes("gateway timeout"))
    || httpStatus === 504
  ) {
    return "gateway_timeout";
  }
  if (
    names.some((name) => name === "AbortError" || name === "TimeoutError")
    || codes.some((code) => (
      code === "ABORT_ERR" || code === "57014" || code === "55P03"
    ))
    || messages.some((message) => (
      message.includes("timed out")
      || message.includes("timeout")
      || message.includes("aborted")
    ))
  ) {
    return "timeout";
  }
  if (
    messages.some((message) => message.includes("fetch failed") || message.includes("network"))
    || codes.includes("ECONNRESET")
  ) {
    return "network";
  }
  if (
    messages.some((message) => message.includes("auth"))
    || codes.some((code) => code.startsWith("AUTH"))
  ) return "auth";
  if (codes.some((code) => /^[0-9A-Z]{5}$/.test(code) || code.startsWith("PGRST"))) {
    return "database";
  }
  return "unknown";
}

export function performanceErrorMetadata(
  error: unknown,
  context: { layer?: PerformanceLayer; status?: PerformanceStatus } = {},
): PerformanceErrorMetadata {
  if (context.status === "invalid_session") return {};

  const errorCategory = performanceErrorCategory(error);
  const httpStatus = errorHttpStatus(error)
    ?? (errorCategory === "gateway_timeout" ? 504 : undefined);
  const providerCode = errorProviderCode(error);
  const isTransientJwtSkew = httpStatus === 401
    && providerCode === "PGRST303"
    && errorMessageIncludes(error, "jwt issued at future");

  let errorCode: ReliabilityErrorCode = "UNKNOWN";
  if (errorCategory === "network") {
    errorCode = "NETWORK_ERROR";
  } else if (errorCategory === "gateway_timeout" || errorCategory === "timeout") {
    if (context.layer === "auth") errorCode = "AUTH_TIMEOUT";
    if (context.layer === "database") errorCode = "DATABASE_TIMEOUT";
  } else if (httpStatus === 401 && !isTransientJwtSkew) {
    errorCode = "UNAUTHORIZED";
  } else if (httpStatus === 404) {
    errorCode = "NOT_FOUND";
  } else if (httpStatus === 409 || providerCode === "23505") {
    errorCode = "CONFLICT";
  } else if (httpStatus === 400 || httpStatus === 422) {
    errorCode = "VALIDATION_ERROR";
  }

  return {
    errorCategory,
    errorCode,
    ...(httpStatus ? { httpStatus } : {}),
    ...(providerCode ? { providerCode } : {}),
  };
}

export function logPerformance(
  event: PerformanceEvent,
  logger: PerformanceLogger = console,
) {
  logger.info("[perf]", {
    route: event.route,
    operation: event.operation,
    durationMs: Math.max(0, Math.round(event.durationMs)),
    region: process.env.VERCEL_REGION ?? "local",
    status: event.status,
    ...(event.layer ? { layer: event.layer } : {}),
    ...(event.requestKind ? { requestKind: event.requestKind } : {}),
    ...(boundedVercelId(event.vercelId) ? { vercelId: event.vercelId } : {}),
    ...(event.errorCategory
      ? { errorCategory: event.errorCategory }
      : {}),
    ...(event.errorCode ? { errorCode: event.errorCode } : {}),
    ...(boundedHttpStatus(event.httpStatus)
      ? { httpStatus: event.httpStatus }
      : {}),
    ...(boundedProviderCode(event.providerCode)
      ? { providerCode: event.providerCode }
      : {}),
  });
}

function boundedVercelId(value: string | undefined): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 200
    && /^[A-Za-z0-9:._-]+$/.test(value);
}

export function classifyRequestKind(
  headers: Pick<Headers, "get">,
): PerformanceRequestKind {
  const routerPrefetch = headers.get("next-router-prefetch");
  const purpose = [headers.get("purpose"), headers.get("sec-purpose")]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("en");

  if (
    routerPrefetch === "1"
    || routerPrefetch === "2"
    || routerPrefetch === "3"
    || headers.get("next-router-segment-prefetch") !== null
    || purpose.includes("prefetch")
  ) {
    return "prefetch";
  }

  return headers.get("rsc") === "1" ? "rsc" : "navigation";
}

export function requestPerformanceContext(
  headers: Pick<Headers, "get">,
): RequestPerformanceContext {
  const vercelId = headers.get("x-vercel-id") ?? undefined;
  return {
    requestKind: classifyRequestKind(headers),
    ...(boundedVercelId(vercelId) ? { vercelId } : {}),
  };
}

export async function measurePerformance<T>(
  input: Pick<PerformanceEvent, "route" | "operation">
    & Partial<Pick<PerformanceEvent, "layer" | "requestKind" | "vercelId">>,
  operation: () => PromiseLike<T>,
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await operation();
    logPerformance({
      ...input,
      durationMs: performance.now() - startedAt,
      status: "ok",
    });
    return result;
  } catch (error) {
    logPerformance({
      ...input,
      durationMs: performance.now() - startedAt,
      status: "error",
      ...performanceErrorMetadata(error, { layer: input.layer }),
    });
    throw error;
  }
}
