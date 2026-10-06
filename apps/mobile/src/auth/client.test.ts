import { describe, expect, it, jest } from '@jest/globals';

import { createMobileSupabaseClient, MobileAuthConfigurationError, readMobileSupabaseConfig } from './client';
import { MOBILE_AUTH_STORAGE_KEY } from './constants';

// jest.mock calls are hoisted above these imports.

const mockCreateClient = jest.fn((..._args: unknown[]) => ({ auth: {} }));
jest.mock('@supabase/supabase-js', () => ({ createClient: (...args: unknown[]) => mockCreateClient(...args) }));
jest.mock('./storage', () => ({ mobileAuthStorage: {} }));

// Fake values only. Real keys never belong in tests.
const SECRET = 'sb_secret_FAKE_test_value_000000';
const PUBLISHABLE = 'sb_publishable_FAKE_test_value_000000';
const url = 'https://example.supabase.co';
const rejection = (publishableKey: string | undefined, u: string | undefined = url) => {
  try { readMobileSupabaseConfig({ url: u, publishableKey }); } catch (e) { return e as Error; }
  return null;
};

describe('Mobile Supabase client configuration', () => {
  it('accepts a publishable key and initializes Auth with PKCE + persisted session', () => {
    const config = readMobileSupabaseConfig({ url, publishableKey: `  ${PUBLISHABLE} ` });
    expect(config).toEqual({ url, publishableKey: PUBLISHABLE });
    createMobileSupabaseClient(config);
    expect(mockCreateClient).toHaveBeenCalledWith(url, PUBLISHABLE, expect.objectContaining({
      auth: expect.objectContaining({ flowType: 'pkce', persistSession: true, autoRefreshToken: true,
        detectSessionInUrl: false, storageKey: MOBILE_AUTH_STORAGE_KEY }),
    }));
  });

  it('rejects a secret key as invalid configuration, without the value in the error', () => {
    const error = rejection(SECRET);
    expect(error).toBeInstanceOf(MobileAuthConfigurationError);
    expect(error!.message).not.toContain('FAKE');
    expect(error!.message).not.toContain('sb_secret_');
  });

  it('rejects keys that are not publishable (legacy JWT, incl. service_role)', () => {
    expect(rejection('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.FAKE')).toBeInstanceOf(MobileAuthConfigurationError);
  });

  it('missing key or URL keeps the current missing-configuration error', () => {
    expect(rejection(undefined)).toBeInstanceOf(MobileAuthConfigurationError);
    expect(rejection('   ')).toBeInstanceOf(MobileAuthConfigurationError);
    expect(rejection(PUBLISHABLE, '')).toBeInstanceOf(MobileAuthConfigurationError);
    expect(rejection(PUBLISHABLE, 'http://example.com')).toBeInstanceOf(MobileAuthConfigurationError);
  });
});
