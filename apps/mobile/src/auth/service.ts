import type { Session, SupabaseClient } from '@supabase/supabase-js';
import type { AppStateStatus } from 'react-native';

import { OAuthCallbackGate, parseNativeAuthCallback } from './callback';
import { AUTH_OPERATION_TIMEOUT_MS } from './constants';
import { authMessages, isConfirmedInvalidSession } from './errors';
import type { MobileAuthEvent } from './state';

class AuthOperationTimeoutError extends Error {
  constructor() {
    super('Authentication operation timed out');
    this.name = 'AuthOperationTimeoutError';
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new AuthOperationTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function invalidateLocalSession(client: SupabaseClient): Promise<void> {
  try {
    await client.auth.signOut({ scope: 'local' });
  } catch {
    // The session is already confirmed unusable. No sensitive details are logged.
  }
}

export async function restoreNativeSession(
  client: SupabaseClient,
  timeoutMs = AUTH_OPERATION_TIMEOUT_MS,
): Promise<MobileAuthEvent> {
  let localSession: Session | null = null;

  try {
    const { data, error } = await withTimeout(client.auth.getSession(), timeoutMs);
    localSession = data.session;

    if (error) {
      if (isConfirmedInvalidSession(error)) {
        await invalidateLocalSession(client);
        return { type: 'SESSION_INVALID' };
      }
      return {
        type: 'TRANSIENT_FAILURE',
        message: authMessages.restoreFailed,
        session: localSession,
      };
    }
  } catch {
    return { type: 'TRANSIENT_FAILURE', message: authMessages.restoreFailed };
  }

  if (!localSession) {
    return { type: 'SESSION_MISSING' };
  }

  try {
    const { data, error } = await withTimeout(client.auth.getUser(), timeoutMs);

    if (error) {
      if (isConfirmedInvalidSession(error)) {
        await invalidateLocalSession(client);
        return { type: 'SESSION_INVALID' };
      }

      return {
        type: 'TRANSIENT_FAILURE',
        message: authMessages.restoreFailed,
        session: localSession,
      };
    }

    if (!data.user || data.user.id !== localSession.user.id) {
      await invalidateLocalSession(client);
      return { type: 'SESSION_INVALID' };
    }

    return {
      type: 'SESSION_CONFIRMED',
      session: { ...localSession, user: data.user },
    };
  } catch {
    return {
      type: 'TRANSIENT_FAILURE',
      message: authMessages.restoreFailed,
      session: localSession,
    };
  }
}

export type CallbackProcessingResult = {
  event: MobileAuthEvent | null;
  handled: boolean;
};

export async function processNativeAuthCallback(
  rawUrl: string,
  client: SupabaseClient,
  gate: OAuthCallbackGate,
): Promise<CallbackProcessingResult> {
  const callback = parseNativeAuthCallback(rawUrl);

  if (!callback) {
    return { event: null, handled: false };
  }

  if (callback.kind === 'invalid') {
    return {
      event: { type: 'TRANSIENT_FAILURE', message: authMessages.callbackInvalid, session: null },
      handled: true,
    };
  }

  if (callback.kind === 'oauth_error') {
    return {
      event: {
        type: 'SESSION_MISSING',
        notice:
          callback.reason === 'cancelled'
            ? authMessages.oauthCancelled
            : authMessages.oauthFailed,
      },
      handled: true,
    };
  }

  if (!gate.claim(callback)) {
    return { event: null, handled: true };
  }

  try {
    const { data, error } = await client.auth.exchangeCodeForSession(
      callback.code,
      callback.flowId ? { flowId: callback.flowId } : undefined,
    );

    if (error) {
      if (isConfirmedInvalidSession(error)) {
        await invalidateLocalSession(client);
        return { event: { type: 'SESSION_INVALID' }, handled: true };
      }

      return {
        event: { type: 'TRANSIENT_FAILURE', message: authMessages.exchangeFailed, session: null },
        handled: true,
      };
    }

    if (!data.session) {
      return {
        event: { type: 'TRANSIENT_FAILURE', message: authMessages.exchangeFailed, session: null },
        handled: true,
      };
    }

    return {
      event: { type: 'SESSION_CONFIRMED', session: data.session },
      handled: true,
    };
  } catch {
    return {
      event: { type: 'TRANSIENT_FAILURE', message: authMessages.exchangeFailed, session: null },
      handled: true,
    };
  }
}

export async function performLocalLogout(client: SupabaseClient): Promise<MobileAuthEvent> {
  try {
    const { error } = await client.auth.signOut({ scope: 'local' });

    if (error && !isConfirmedInvalidSession(error)) {
      return { type: 'TRANSIENT_FAILURE', message: authMessages.restoreFailed };
    }

    return { type: 'SESSION_MISSING' };
  } catch {
    return { type: 'TRANSIENT_FAILURE', message: authMessages.restoreFailed };
  }
}

export async function syncAuthRefreshWithAppState(
  client: SupabaseClient,
  appState: AppStateStatus,
): Promise<void> {
  if (appState === 'active') {
    await client.auth.startAutoRefresh();
    return;
  }

  await client.auth.stopAutoRefresh();
}
