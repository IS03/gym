import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { MOBILE_AUTH_STORAGE_KEY } from "./constants";
import { getMobileAuthStorage } from "./storage";

let mobileClient: SupabaseClient | null = null;

export function hasMobileSupabaseConfig(): boolean {
  return Boolean(
    __OWNLEVEL_SUPABASE_URL__ && __OWNLEVEL_SUPABASE_ANON_KEY__,
  );
}

export function getMobileSupabaseClient(): SupabaseClient {
  if (mobileClient) {
    return mobileClient;
  }

  if (!hasMobileSupabaseConfig()) {
    throw new Error("Mobile Supabase public configuration is missing");
  }

  mobileClient = createClient(
    __OWNLEVEL_SUPABASE_URL__,
    __OWNLEVEL_SUPABASE_ANON_KEY__,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        flowType: "pkce",
        persistSession: true,
        storage: getMobileAuthStorage(),
        storageKey: MOBILE_AUTH_STORAGE_KEY,
      },
    },
  );

  return mobileClient;
}

export async function clearMobileSupabaseSession(): Promise<void> {
  await getMobileAuthStorage().clear();
}
