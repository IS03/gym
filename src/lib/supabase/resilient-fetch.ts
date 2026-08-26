import { isTransientJwtIssuedAtFutureError } from "./auth-errors";

export const JWT_CLOCK_SKEW_RETRY_DELAYS_MS = [250, 750, 1500] as const;

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

/**
 * Reintenta únicamente el rechazo PGRST303 "JWT issued at future" del Data
 * API. El Request base nunca se envía directamente: cada intento recibe un
 * clone nuevo para que cuerpos de RPC/mutaciones puedan reproducirse sin
 * reutilizar un stream consumido.
 */
export function createResilientSupabaseFetch(
  fetchImplementation: typeof fetch = globalThis.fetch.bind(globalThis),
  options: ResilientFetchOptions = {},
): typeof fetch {
  const retryDelaysMs =
    options.retryDelaysMs ?? JWT_CLOCK_SKEW_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? defaultSleep;
  const logger = options.logger ?? console;

  return async (input, init) => {
    const request = new Request(input, init);
    const pathname = dataApiPathname(request);

    for (let attempt = 0; ; attempt += 1) {
      const response = await fetchImplementation(request.clone());

      if (!pathname || !(await isJwtIssuedAtFutureResponse(response))) {
        if (attempt > 0 && response.ok) {
          logger.info("[supabase-jwt-skew] recovered", {
            attempt,
            pathname,
          });
        }
        return response;
      }

      const delayMs = retryDelaysMs[attempt];
      if (delayMs === undefined) return response;

      logger.warn("[supabase-jwt-skew] retry", {
        attempt: attempt + 1,
        pathname,
        delayMs,
      });
      await sleep(delayMs);
    }
  };
}
