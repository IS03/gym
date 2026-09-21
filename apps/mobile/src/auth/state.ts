import type { Session } from '@supabase/supabase-js';

export type MobileAuthState =
  | { status: 'BOOTSTRAPPING' }
  | { status: 'SIGNED_OUT'; notice?: string }
  | { status: 'SIGNING_IN' }
  | { status: 'SIGNED_IN'; session: Session }
  | { status: 'TRANSIENT_ERROR'; message: string; session: Session | null };

export type MobileAuthEvent =
  | { type: 'BOOTSTRAP_STARTED' }
  | { type: 'SIGN_IN_STARTED' }
  | { type: 'SESSION_CONFIRMED'; session: Session }
  | { type: 'SESSION_MISSING'; notice?: string }
  | { type: 'SESSION_INVALID' }
  | { type: 'TRANSIENT_FAILURE'; message: string; session?: Session | null };

export const initialMobileAuthState: MobileAuthState = { status: 'BOOTSTRAPPING' };

export function mobileAuthReducer(
  state: MobileAuthState,
  event: MobileAuthEvent,
): MobileAuthState {
  switch (event.type) {
    case 'BOOTSTRAP_STARTED':
      return { status: 'BOOTSTRAPPING' };
    case 'SIGN_IN_STARTED':
      return { status: 'SIGNING_IN' };
    case 'SESSION_CONFIRMED':
      return { status: 'SIGNED_IN', session: event.session };
    case 'SESSION_MISSING':
      return { status: 'SIGNED_OUT', notice: event.notice };
    case 'SESSION_INVALID':
      return { status: 'SIGNED_OUT' };
    case 'TRANSIENT_FAILURE': {
      const retainedSession =
        event.session !== undefined
          ? event.session
          : state.status === 'SIGNED_IN' || state.status === 'TRANSIENT_ERROR'
            ? state.session
            : null;

      return {
        status: 'TRANSIENT_ERROR',
        message: event.message,
        session: retainedSession,
      };
    }
  }
}

export function authenticatedSession(state: MobileAuthState): Session | null {
  if (state.status === 'SIGNED_IN') {
    return state.session;
  }

  if (state.status === 'TRANSIENT_ERROR') {
    return state.session;
  }

  return null;
}
