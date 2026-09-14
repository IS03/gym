import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import {
  logPerformance,
  performanceErrorMetadata,
  requestPerformanceContext,
  type RequestPerformanceContext,
} from "../request-performance";
import { isInvalidAuthSessionError } from "./auth-errors";
import { createResilientSupabaseFetch } from "./resilient-fetch";

export const SUPABASE_SERVER_REQUEST_TIMEOUT_MS = 10_000;

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    global: {
      fetch: createResilientSupabaseFetch(undefined, {
        requestTimeoutMs: SUPABASE_SERVER_REQUEST_TIMEOUT_MS,
      }),
    },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components no pueden setear cookies en algunos contextos.
        }
      },
    },
  });
}

export type AuthenticatedRequestContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  requestPerformance?: RequestPerformanceContext;
};

/**
 * Verifica la sesión una sola vez por render de Server Components. React
 * invalida `cache()` entre requests, por lo que el cliente y el usuario nunca
 * se comparten entre visitantes ni quedan persistidos como caché de datos.
 */
export const getVerifiedRequestContext = cache(
  async (): Promise<AuthenticatedRequestContext | null> => {
    const [supabase, requestHeaders] = await Promise.all([
      createClient(),
      headers(),
    ]);
    const requestPerformance = requestPerformanceContext(requestHeaders);
    const authStartedAt = performance.now();
    let claimsResult: Awaited<ReturnType<typeof supabase.auth.getClaims>>;
    try {
      claimsResult = await supabase.auth.getClaims();
    } catch (error) {
      const status = isInvalidAuthSessionError(error)
        ? "invalid_session"
        : "error";
      logPerformance({
        route: "(app)",
        operation: "server-auth",
        durationMs: performance.now() - authStartedAt,
        status,
        layer: "auth",
        ...requestPerformance,
        ...performanceErrorMetadata(error, { layer: "auth", status }),
      });
      throw error;
    }
    const { data, error } = claimsResult;
    logPerformance({
      route: "(app)",
      operation: "server-auth",
      durationMs: performance.now() - authStartedAt,
      layer: "auth",
      ...requestPerformance,
      status: error
        ? isInvalidAuthSessionError(error)
          ? "invalid_session"
          : "error"
        : data?.claims?.sub
          ? "authenticated"
          : "unauthenticated",
      ...(error && !isInvalidAuthSessionError(error)
        ? performanceErrorMetadata(error, { layer: "auth" })
        : {}),
    });

    if (error) {
      if (isInvalidAuthSessionError(error)) return null;
      throw new Error(`Autenticación: ${error.message}`);
    }

    const userId = data?.claims?.sub;
    if (typeof userId !== "string" || !userId) return null;
    return { supabase, userId, requestPerformance };
  },
);

export async function requireAuthenticatedRequestContext(): Promise<AuthenticatedRequestContext> {
  const context = await getVerifiedRequestContext();
  if (!context) throw new Error("No autenticado.");
  return context;
}
