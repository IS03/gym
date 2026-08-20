import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { cache } from "react";
import { isInvalidAuthSessionError } from "./auth-errors";

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
};

/**
 * Verifica la sesión una sola vez por render de Server Components. React
 * invalida `cache()` entre requests, por lo que el cliente y el usuario nunca
 * se comparten entre visitantes ni quedan persistidos como caché de datos.
 */
export const getVerifiedRequestContext = cache(
  async (): Promise<AuthenticatedRequestContext | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();

    if (error) {
      if (isInvalidAuthSessionError(error)) return null;
      throw new Error(`Autenticación: ${error.message}`);
    }

    const userId = data?.claims?.sub;
    if (typeof userId !== "string" || !userId) return null;
    return { supabase, userId };
  },
);

export async function requireAuthenticatedRequestContext(): Promise<AuthenticatedRequestContext> {
  const context = await getVerifiedRequestContext();
  if (!context) throw new Error("No autenticado.");
  return context;
}
