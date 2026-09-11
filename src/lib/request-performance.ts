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

export type PerformanceEvent = {
  route: string;
  operation: string;
  durationMs: number;
  status: PerformanceStatus;
  errorCategory?: PerformanceErrorCategory;
};

type PerformanceLogger = Pick<Console, "info">;

export function performanceErrorCategory(
  error: unknown,
): PerformanceErrorCategory {
  const record =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : null;
  const name = typeof record?.name === "string" ? record.name : "";
  const code = typeof record?.code === "string" ? record.code : "";
  const message =
    typeof record?.message === "string"
      ? record.message.toLocaleLowerCase("en")
      : "";

  if (message.includes("gateway timeout") || code === "504") {
    return "gateway_timeout";
  }
  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    code === "ABORT_ERR" ||
    code === "57014" ||
    code === "55P03" ||
    message.includes("timed out") ||
    message.includes("timeout") ||
    message.includes("aborted")
  ) {
    return "timeout";
  }
  if (
    message.includes("fetch failed") ||
    message.includes("network") ||
    code === "ECONNRESET"
  ) {
    return "network";
  }
  if (message.includes("auth") || code.startsWith("AUTH")) return "auth";
  if (/^[0-9A-Z]{5}$/.test(code) || code.startsWith("PGRST")) {
    return "database";
  }
  return "unknown";
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
    ...(event.errorCategory
      ? { errorCategory: event.errorCategory }
      : {}),
  });
}

export async function measurePerformance<T>(
  input: Pick<PerformanceEvent, "route" | "operation">,
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
      errorCategory: performanceErrorCategory(error),
    });
    throw error;
  }
}
