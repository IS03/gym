import { isTransientJwtIssuedAtFutureError } from "./auth-errors";

export const JWT_CLOCK_SKEW_READ_RETRY_DELAYS_MS = [
  250,
  750,
  1500,
  2500,
  3000,
] as const;

export const JWT_CLOCK_SKEW_MUTATION_RETRY_DELAYS_MS = [
  250,
  750,
  1500,
] as const;

export function totalRetryDelay(delaysMs: readonly number[]): number {
  return delaysMs.reduce((total, delayMs) => total + delayMs, 0);
}

export const JWT_CLOCK_SKEW_READ_MAX_RETRY_DELAY_MS = totalRetryDelay(
  JWT_CLOCK_SKEW_READ_RETRY_DELAYS_MS,
);
export const JWT_CLOCK_SKEW_MUTATION_MAX_RETRY_DELAY_MS = totalRetryDelay(
  JWT_CLOCK_SKEW_MUTATION_RETRY_DELAYS_MS,
);
export const JWT_CLOCK_SKEW_READ_MAX_ATTEMPTS =
  JWT_CLOCK_SKEW_READ_RETRY_DELAYS_MS.length + 1;
export const JWT_CLOCK_SKEW_MUTATION_MAX_ATTEMPTS =
  JWT_CLOCK_SKEW_MUTATION_RETRY_DELAYS_MS.length + 1;

type RetryLogger = Pick<Console, "info" | "warn">;

type ResilientFetchOptions = {
  retryDelaysMs?: readonly number[];
  sleep?: (delayMs: number) => Promise<void>;
  logger?: RetryLogger;
};

function defaultSleep(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

function dataApiPathname(request: Request): string | null {
  try {
    const pathname = new URL(request.url).pathname;
    return pathname.startsWith("/rest/v1/") ? pathname : null;
  } catch {
    return null;
  }
}

async function isJwtIssuedAtFutureResponse(response: Response): Promise<boolean> {
  if (response.status !== 401) return false;

  try {
    const body = (await response.clone().json()) as unknown;
    if (typeof body !== "object" || body === null) return false;

    const record = body as Record<string, unknown>;
    return isTransientJwtIssuedAtFutureError({
      status: response.status,
      code: record.code,
      message: record.message,
    });
  } catch {
    return false;
  }
}

function defaultRetryDelaysForMethod(method: string): readonly number[] {
  return method === "GET" || method === "HEAD"
    ? JWT_CLOCK_SKEW_READ_RETRY_DELAYS_MS
    : JWT_CLOCK_SKEW_MUTATION_RETRY_DELAYS_MS;
}

/**
 * Reintenta únicamente el rechazo PGRST303 "JWT issued at future" del Data
 * API. El Request base nunca se envía directamente: cada intento recibe un
 * clone nuevo para que cuerpos de RPC/mutaciones puedan reproducirse sin
 * reutilizar un stream consumido. Las lecturas toleran hasta 8 s de skew; las
 * mutaciones conservan el budget previo de 2,5 s para no consumir el límite de
 * 12 s de save_workout_exercise antes de que el RPC pueda terminar.
 */
export function createResilientSupabaseFetch(
  fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
  options: ResilientFetchOptions = {},
): typeof fetch {
  const sleep = options.sleep ?? defaultSleep;
  const logger = options.logger ?? console;

  return async (input, init) => {
    const request = new Request(input, init);
    const pathname = dataApiPathname(request);
    const retryDelaysMs =
      options.retryDelaysMs ?? defaultRetryDelaysForMethod(request.method);
    let retryDelayTotalMs = 0;

    for (let attempt = 1; ; attempt += 1) {
      const response = await fetchImplementation(request.clone());

      if (!pathname || !(await isJwtIssuedAtFutureResponse(response))) {
        if (attempt > 1 && response.ok) {
          logger.info("[supabase-jwt-skew] recovered", {
            attempt,
            pathname,
            retryDelayTotalMs,
          });
        }
        return response;
      }

      const delayMs = retryDelaysMs[attempt - 1];
      if (delayMs === undefined) return response;

      retryDelayTotalMs += delayMs;
      logger.warn("[supabase-jwt-skew] retry", {
        attempt: attempt + 1,
        pathname,
        delayMs,
        retryDelayTotalMs,
      });
      await sleep(delayMs);
    }
  };
}
