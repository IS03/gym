import { describe, expect, it } from '@jest/globals';
import { assertPublicEnv, PublicEnvPolicyError, supabaseKeyProblem } from './public-env-policy';

// Fake values only. Real keys never belong in tests.
const SECRET = 'sb_secret_FAKE_test_value_000000';
const PUBLISHABLE = 'sb_publishable_FAKE_test_value_000000';
const LEGACY_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.FAKE';
const safe = { EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: PUBLISHABLE,
  EXPO_PUBLIC_OWNLEVEL_API_URL: 'https://www.ownlevel.fit', EXPO_PUBLIC_APP_ENV: 'development' };
const failure = (env: Record<string, string | undefined>) => { try { assertPublicEnv(env); } catch (e) { return e as Error; } return null; };

describe('Mobile public env policy', () => {
  it('accepts a publishable key', () => {
    expect(supabaseKeyProblem(PUBLISHABLE)).toBeNull();
    expect(supabaseKeyProblem(`  ${PUBLISHABLE}  `)).toBeNull();
    expect(failure(safe)).toBeNull();
  });
  it('rejects a secret key without echoing it', () => {
    const error = failure({ ...safe, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: SECRET });
    expect(error).toBeInstanceOf(PublicEnvPolicyError);
    expect(error!.message).toContain('Mobile Supabase key must be publishable; secret keys cannot be bundled.');
    expect(error!.message).not.toContain(SECRET);
    expect(error!.message).not.toContain('FAKE');
  });
  it('rejects anything that is not a publishable key (legacy JWT incl. service_role) without decoding or echoing it', () => {
    const error = failure({ ...safe, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: LEGACY_JWT });
    expect(error!.message).toContain('must be a publishable key');
    expect(error!.message).not.toContain('eyJ');
    expect(error!.message).not.toContain('service_role');
  });
  it('keeps the current behavior for a missing key (reported later as missing configuration)', () => {
    expect(supabaseKeyProblem(undefined)).toBeNull();
    expect(supabaseKeyProblem('   ')).toBeNull();
    expect(failure({ ...safe, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toBeNull();
  });
  it('rejects a secret key placed in any other public variable', () => {
    const error = failure({ ...safe, EXPO_PUBLIC_OWNLEVEL_API_URL: SECRET });
    expect(error!.message).toContain('EXPO_PUBLIC_OWNLEVEL_API_URL');
    expect(error!.message).not.toContain('FAKE');
    // Private (non-public) variables are not bundled and are not this guard's concern.
    expect(failure({ ...safe, SUPABASE_SECRET_KEY: SECRET })).toBeNull();
  });
});
