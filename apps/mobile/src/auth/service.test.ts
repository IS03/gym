import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { describe, expect, it, jest } from '@jest/globals';
import type { Mock } from 'jest-mock';

import { OAuthCallbackGate } from './callback';
import {
  getNativeApiAccessToken,
  performLocalLogout,
  processNativeAuthCallback,
  revalidateNativeSessionAfterUnauthorized,
  restoreNativeSession,
  syncAuthRefreshWithAppState,
} from './service';

const user = { id: 'user-1', email: 'nacho@example.com' } as User;
const session = {
  access_token: 'access-token-for-test',
  expires_at: 4_000_000_000,
  expires_in: 3_600,
  refresh_token: 'refresh-token-for-test',
  token_type: 'bearer',
  user,
} as Session;

type AsyncAuthMock = Mock<(...args: unknown[]) => Promise<unknown>>;

type AuthMock = {
  exchangeCodeForSession: AsyncAuthMock;
  getSession: AsyncAuthMock;
  getUser: AsyncAuthMock;
  refreshSession: AsyncAuthMock;
  signOut: AsyncAuthMock;
  startAutoRefresh: AsyncAuthMock;
  stopAutoRefresh: AsyncAuthMock;
};

function asyncMock(value: unknown): AsyncAuthMock {
  return jest.fn<(...args: unknown[]) => Promise<unknown>>(async () => value);
}

function makeClient(overrides: Partial<AuthMock> = {}) {
  const auth: AuthMock = {
    exchangeCodeForSession: asyncMock({ data: { session }, error: null }),
    getSession: asyncMock({ data: { session }, error: null }),
    getUser: asyncMock({ data: { user }, error: null }),
    refreshSession: asyncMock({ data: { session }, error: null }),
    signOut: asyncMock({ error: null }),
    startAutoRefresh: asyncMock(undefined),
    stopAutoRefresh: asyncMock(undefined),
    ...overrides,
  };

  return { auth, client: { auth } as unknown as SupabaseClient };
}

describe('native session bootstrap', () => {
  it('restores and validates a persisted session', async () => {
    const { client } = makeClient();

    await expect(restoreNativeSession(client)).resolves.toEqual({
      type: 'SESSION_CONFIRMED',
      session,
    });
  });

  it('returns signed out when there is no persisted session', async () => {
    const { client, auth } = makeClient();
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(restoreNativeSession(client)).resolves.toEqual({ type: 'SESSION_MISSING' });
    expect(auth.getUser).not.toHaveBeenCalled();
  });

  it('preserves a local session when remote validation fails transiently', async () => {
    const { client, auth } = makeClient();
    auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('network offline') });

    const result = await restoreNativeSession(client);

    expect(result).toMatchObject({ type: 'TRANSIENT_FAILURE', session });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('preserves a session returned alongside a transient getSession error', async () => {
    const { client, auth } = makeClient();
    auth.getSession.mockResolvedValue({
      data: { session },
      error: new Error('refresh endpoint unavailable'),
    });

    const result = await restoreNativeSession(client);

    expect(result).toMatchObject({ type: 'TRANSIENT_FAILURE', session });
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('clears only the local session when Auth confirms it is invalid', async () => {
    const { client, auth } = makeClient();
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: 'AuthSessionMissingError', message: 'Auth session missing' },
    });

    await expect(restoreNativeSession(client)).resolves.toEqual({ type: 'SESSION_INVALID' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('Mobile API Auth boundary', () => {
  it('reads the access token just in time from the Supabase session', async () => {
    const { client } = makeClient();

    await expect(getNativeApiAccessToken(client)).resolves.toEqual({
      status: 'ok',
      accessToken: session.access_token,
    });
  });

  it('recognizes a token already renewed by the Auth listener', async () => {
    const renewedSession = { ...session, access_token: 'renewed-token' };
    const { client, auth } = makeClient({
      getSession: asyncMock({ data: { session: renewedSession }, error: null }),
    });

    await expect(
      revalidateNativeSessionAfterUnauthorized(client, session.access_token),
    ).resolves.toMatchObject({
      status: 'renewed',
      accessToken: 'renewed-token',
    });
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('refreshes once after a rejected current token', async () => {
    const renewedSession = { ...session, access_token: 'renewed-token' };
    const { client, auth } = makeClient({
      refreshSession: asyncMock({
        data: { session: renewedSession },
        error: null,
      }),
    });

    await expect(
      revalidateNativeSessionAfterUnauthorized(client, session.access_token),
    ).resolves.toMatchObject({
      status: 'renewed',
      accessToken: 'renewed-token',
    });
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('does not clear the local session after a transient refresh failure', async () => {
    const { client, auth } = makeClient({
      refreshSession: asyncMock({
        data: { session: null },
        error: new Error('network unavailable'),
      }),
    });

    await expect(
      revalidateNativeSessionAfterUnauthorized(client, session.access_token),
    ).resolves.toMatchObject({ status: 'unavailable', session });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it('clears only local Auth after Supabase confirms invalidity', async () => {
    const { client, auth } = makeClient({
      refreshSession: asyncMock({
        data: { session: null },
        error: {
          name: 'AuthSessionMissingError',
          message: 'Auth session missing',
        },
      }),
    });

    await expect(
      revalidateNativeSessionAfterUnauthorized(client, session.access_token),
    ).resolves.toEqual({ status: 'invalid' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});

describe('native callback exchange', () => {
  it('exchanges a PKCE callback once and forwards the flow id', async () => {
    const { client, auth } = makeClient();
    const gate = new OAuthCallbackGate();
    const url = 'ownlevel-dev://auth/callback?code=oauth-code&sb_flow_id=flow_12345678';

    await expect(processNativeAuthCallback(url, client, gate)).resolves.toEqual({
      handled: true,
      event: { type: 'SESSION_CONFIRMED', session },
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('oauth-code', {
      flowId: 'flow_12345678',
    });

    await expect(processNativeAuthCallback(url, client, gate)).resolves.toEqual({
      handled: true,
      event: null,
    });
    expect(auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
  });

  it('maps an OAuth cancellation to a signed-out notice', async () => {
    const { client } = makeClient();

    const result = await processNativeAuthCallback(
      'ownlevel-dev://auth/callback?error=access_denied&error_description=cancelled',
      client,
      new OAuthCallbackGate(),
    );

    expect(result.handled).toBe(true);
    expect(result.event).toMatchObject({ type: 'SESSION_MISSING' });
  });

  it('surfaces an exchange failure without clearing storage', async () => {
    const { client, auth } = makeClient();
    auth.exchangeCodeForSession.mockResolvedValue({
      data: { session: null },
      error: new Error('network offline'),
    });

    const result = await processNativeAuthCallback(
      'ownlevel-dev://auth/callback?code=oauth-code',
      client,
      new OAuthCallbackGate(),
    );

    expect(result.event).toMatchObject({ type: 'TRANSIENT_FAILURE', session: null });
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});

describe('native auth lifecycle', () => {
  it('starts refresh in foreground and stops it outside active state', async () => {
    const { client, auth } = makeClient();

    await syncAuthRefreshWithAppState(client, 'active');
    await syncAuthRefreshWithAppState(client, 'background');

    expect(auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });

  it('uses a local-only sign out', async () => {
    const { client, auth } = makeClient();

    await expect(performLocalLogout(client)).resolves.toEqual({ type: 'SESSION_MISSING' });
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });
});
