import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { supabaseKeyProblem } from '../config/public-env-policy';

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

type MobileSupabaseEnvironment = { url: string | undefined; publishableKey: string | undefined };

// Literal process.env access so Expo inlines the public values at bundle time.
export function readMobileSupabaseConfig(
  environment: MobileSupabaseEnvironment = {
    url: process.env.EXPO_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  },
): MobileSupabaseConfig {
  const url = environment.url?.trim() ?? '';
  const publishableKey = environment.publishableKey?.trim() ?? '';

  // Only publishable keys: a secret key is never used, even if a build slipped past the config guard.
  if (!url || !publishableKey || supabaseKeyProblem(publishableKey)) {
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

  mobileSupabaseClient = createMobileSupabaseClient(readMobileSupabaseConfig());
  return mobileSupabaseClient;
}

export function createMobileSupabaseClient(config: MobileSupabaseConfig): SupabaseClient {
  return createClient(config.url, config.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
      persistSession: true,
      storage: mobileAuthStorage,
      storageKey: MOBILE_AUTH_STORAGE_KEY,
    },
  });
}
