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

export const TRANSIENT_READ_RETRY_DELAY_MS = 100;
const TRANSIENT_READ_RESPONSE_STATUSES = new Set([
  502,
  503,
  504,
  520,
  522,
  523,
  524,
  530,
]);

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
  /** Defaults to true for legacy Web behavior; Mobile mutation contexts set false. */
  retryMutations?: boolean;
  sleep?: (delayMs: number) => Promise<void>;
  logger?: RetryLogger;
  requestTimeoutMs?: number;
  transientReadRetryDelayMs?: number;
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

function defaultRetryDelaysForMethod(
  method: string,
  retryMutations: boolean,
): readonly number[] {
  return method === "GET" || method === "HEAD"
    ? JWT_CLOCK_SKEW_READ_RETRY_DELAYS_MS
    : retryMutations
      ? JWT_CLOCK_SKEW_MUTATION_RETRY_DELAYS_MS
      : [];
}

function isSafeDataApiRead(request: Request, pathname: string | null) {
  return Boolean(pathname) && (request.method === "GET" || request.method === "HEAD");
}

function fetchAttempt(
  fetchImplementation: typeof fetch,
  request: Request,
  signal: AbortSignal,
): Promise<Response> {
  if (signal.aborted) return Promise.reject(signal.reason);

  return new Promise<Response>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve().then(() => fetchImplementation(request.clone())).then(
      (response) => {
        signal.removeEventListener("abort", onAbort);
        resolve(response);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

/**
 * Preserva el retry acotado de PGRST303 "JWT issued at future" y permite un
 * único retry corto de transporte sólo para GET/HEAD del Data API. El Request
 * base nunca se envía directamente: cada intento recibe un clone nuevo para
 * no reutilizar streams consumidos. Las mutaciones no reciben retries de
 * transporte. `retryMutations: false` también elimina el retry de clock-skew
 * para contextos Mobile donde cada retry debe ser una decisión del caller.
 */
export function createResilientSupabaseFetch(
  fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
  options: ResilientFetchOptions = {},
): typeof fetch {
  const sleep = options.sleep ?? defaultSleep;
  const logger = options.logger ?? console;

  return async (input, init) => {
    const originalRequest = new Request(input, init);
    const timeoutController = options.requestTimeoutMs
      ? new AbortController()
      : null;
    const timeoutId = timeoutController && options.requestTimeoutMs
      ? setTimeout(
          () => timeoutController.abort(
            new DOMException("The operation was aborted due to timeout", "TimeoutError"),
          ),
          options.requestTimeoutMs,
        )
      : null;
    const signal = timeoutController
      ? AbortSignal.any([originalRequest.signal, timeoutController.signal])
      : originalRequest.signal;
    const request = new Request(originalRequest, { signal });
    const pathname = dataApiPathname(request);
    const retryDelaysMs =
      options.retryDelaysMs
      ?? defaultRetryDelaysForMethod(
        request.method,
        options.retryMutations ?? true,
      );
    const transientReadRetryDelayMs =
      options.transientReadRetryDelayMs ?? TRANSIENT_READ_RETRY_DELAY_MS;
    let retryDelayTotalMs = 0;
    let transientReadRetried = false;
    let jwtAttempt = 1;

    try {
      for (;;) {
        let response: Response;
        try {
          response = await fetchAttempt(fetchImplementation, request, signal);
        } catch (error) {
          if (
            !transientReadRetried
            && isSafeDataApiRead(request, pathname)
            && !signal.aborted
          ) {
            transientReadRetried = true;
            logger.warn("[supabase-read-retry] retry", {
              pathname,
              reason: "network",
              delayMs: transientReadRetryDelayMs,
            });
            await sleep(transientReadRetryDelayMs);
            signal.throwIfAborted();
            continue;
          }
          throw error;
        }

        if (
          !transientReadRetried
          && isSafeDataApiRead(request, pathname)
          && TRANSIENT_READ_RESPONSE_STATUSES.has(response.status)
        ) {
          transientReadRetried = true;
          logger.warn("[supabase-read-retry] retry", {
            pathname,
            reason: "http",
            status: response.status,
            delayMs: transientReadRetryDelayMs,
          });
          await sleep(transientReadRetryDelayMs);
          signal.throwIfAborted();
          continue;
        }

        if (!pathname || !(await isJwtIssuedAtFutureResponse(response))) {
          if (transientReadRetried && response.ok) {
            logger.info("[supabase-read-retry] recovered", {
              pathname,
              status: response.status,
            });
          }
          if (jwtAttempt > 1 && response.ok) {
            logger.info("[supabase-jwt-skew] recovered", {
              attempt: jwtAttempt,
              pathname,
              retryDelayTotalMs,
            });
          }
          return response;
        }

        const delayMs = retryDelaysMs[jwtAttempt - 1];
        if (delayMs === undefined) return response;

        retryDelayTotalMs += delayMs;
        logger.warn("[supabase-jwt-skew] retry", {
          attempt: jwtAttempt + 1,
          pathname,
          delayMs,
          retryDelayTotalMs,
        });
        await sleep(delayMs);
        signal.throwIfAborted();
        jwtAttempt += 1;
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };
}
