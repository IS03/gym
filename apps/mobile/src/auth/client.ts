import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { MOBILE_AUTH_STORAGE_KEY } from './constants';
import { mobileAuthStorage } from './storage';

type MobileSupabaseConfig = {
  publishableKey: string;
  url: string;
};

export class MobileAuthConfigurationError extends Error {
  constructor() {
    super('Mobile Supabase public configuration is missing or invalid');
    this.name = 'MobileAuthConfigurationError';
  }
}

export function readMobileSupabaseConfig(): MobileSupabaseConfig {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';

  if (!url || !publishableKey) {
    throw new MobileAuthConfigurationError();
  }

  try {
    const parsedUrl = new URL(url);
    const localHttp =
      parsedUrl.protocol === 'http:' &&
      (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1');

    if (parsedUrl.protocol !== 'https:' && !localHttp) {
      throw new MobileAuthConfigurationError();
    }
  } catch (error) {
    if (error instanceof MobileAuthConfigurationError) {
      throw error;
    }
    throw new MobileAuthConfigurationError();
  }

  return { publishableKey, url };
}

let mobileSupabaseClient: SupabaseClient | null = null;

export function getMobileSupabaseClient(): SupabaseClient {
  if (mobileSupabaseClient) {
    return mobileSupabaseClient;
  }

  const config = readMobileSupabaseConfig();
  mobileSupabaseClient = createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      storage: mobileAuthStorage,
      storageKey: MOBILE_AUTH_STORAGE_KEY,
    },
  });

  return mobileSupabaseClient;
}
