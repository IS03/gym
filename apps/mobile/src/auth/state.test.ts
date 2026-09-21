import type { Session } from '@supabase/supabase-js';
import { describe, expect, it } from '@jest/globals';

import { authenticatedSession, initialMobileAuthState, mobileAuthReducer } from './state';

const session = { access_token: 'test-session' } as Session;

describe('mobile auth state', () => {
  it('starts in BOOTSTRAPPING instead of flashing signed out', () => {
    expect(initialMobileAuthState).toEqual({ status: 'BOOTSTRAPPING' });
  });

  it('distinguishes sign-in progress and confirmed sign-out', () => {
    const signingIn = mobileAuthReducer(initialMobileAuthState, { type: 'SIGN_IN_STARTED' });
    expect(signingIn).toEqual({ status: 'SIGNING_IN' });

    expect(mobileAuthReducer(signingIn, { type: 'SESSION_MISSING' })).toEqual({
      status: 'SIGNED_OUT',
      notice: undefined,
    });
  });

  it('retains an authenticated session on a transient failure', () => {
    const signedIn = mobileAuthReducer(initialMobileAuthState, {
      type: 'SESSION_CONFIRMED',
      session,
    });
    const transient = mobileAuthReducer(signedIn, {
      type: 'TRANSIENT_FAILURE',
      message: 'offline',
    });

    expect(transient).toEqual({ status: 'TRANSIENT_ERROR', message: 'offline', session });
    expect(authenticatedSession(transient)).toBe(session);
  });
});
