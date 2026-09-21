import { describe, expect, it } from '@jest/globals';

import {
  callbackUrlFromRouteParameters,
  OAuthCallbackGate,
  parseNativeAuthCallback,
} from './callback';

describe('native auth callback', () => {
  it('accepts the exact development callback with a PKCE code and flow id', () => {
    expect(
      parseNativeAuthCallback(
        'ownlevel-dev://auth/callback?code=oauth-code&sb_flow_id=flow_12345678',
      ),
    ).toEqual({ kind: 'code', code: 'oauth-code', flowId: 'flow_12345678' });
  });

  it.each([
    'other-app://auth/callback?code=oauth-code',
    'ownlevel-dev://app/callback?code=oauth-code',
    'ownlevel-dev://auth/other?code=oauth-code',
  ])('ignores a link outside the auth callback boundary: %s', (url) => {
    expect(parseNativeAuthCallback(url)).toBeNull();
  });

  it('rejects unexpected or duplicated parameters', () => {
    expect(
      parseNativeAuthCallback('ownlevel-dev://auth/callback?code=one&code=two'),
    ).toEqual({ kind: 'invalid' });
    expect(
      parseNativeAuthCallback('ownlevel-dev://auth/callback?code=one&next=%2Fsettings'),
    ).toEqual({ kind: 'invalid' });
  });

  it('classifies provider cancellation without retaining provider details', () => {
    expect(
      parseNativeAuthCallback(
        'ownlevel-dev://auth/callback?error=access_denied&error_description=cancelled',
      ),
    ).toEqual({ kind: 'oauth_error', reason: 'cancelled' });
  });

  it('deduplicates one callback across browser and route delivery', () => {
    const gate = new OAuthCallbackGate();
    const callback = {
      kind: 'code' as const,
      code: 'oauth-code',
      flowId: 'flow_12345678',
    };

    expect(gate.claim(callback)).toBe(true);
    expect(gate.claim(callback)).toBe(false);
  });

  it('reconstructs a callback URL from Expo Router parameters', () => {
    const url = callbackUrlFromRouteParameters({
      code: 'oauth-code',
      sb_flow_id: 'flow_12345678',
    });

    expect(parseNativeAuthCallback(url)).toEqual({
      kind: 'code',
      code: 'oauth-code',
      flowId: 'flow_12345678',
    });
  });
});
