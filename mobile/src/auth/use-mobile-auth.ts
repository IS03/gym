import { useCallback, useEffect, useReducer, useRef } from "react";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import type { PluginListenerHandle } from "@capacitor/core";
import type { Session, SupabaseClient, User } from "@supabase/supabase-js";

import { isCapacitorRuntime } from "../native/runtime";
import { OAuthCallbackGate, parseNativeAuthCallback } from "./callback";
import {
  clearMobileSupabaseSession,
  getMobileSupabaseClient,
  hasMobileSupabaseConfig,
} from "./client";
import { NATIVE_AUTH_CALLBACK_URL } from "./constants";
import { isConfirmedInvalidSession } from "./errors";
import {
  initialMobileAuthState,
  mobileAuthReducer,
  type AuthIdentity,
} from "./state";

function identityFromUser(user: User): AuthIdentity {
  const displayName =
    typeof user.user_metadata.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata.name === "string"
        ? user.user_metadata.name
        : null;

  return { displayName, email: user.email ?? null };
}

async function closeAuthBrowser(): Promise<void> {
  try {
    await Browser.close();
  } catch {
    // The browser may already be closed by iOS when the app receives the URL.
  }
}

export function useMobileAuth() {
  const [state, dispatch] = useReducer(
    mobileAuthReducer,
    initialMobileAuthState,
  );
  const stateRef = useRef(state);
  const clientRef = useRef<SupabaseClient | null>(null);
  const callbackGateRef = useRef(new OAuthCallbackGate());
  const signInPendingRef = useRef(false);

  stateRef.current = state;

  const markInvalidSession = useCallback(async (client: SupabaseClient) => {
    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      // The session was already confirmed invalid; never reinterpret this as
      // an infrastructure failure if revocation cannot reach the server.
    }
    try {
      await clearMobileSupabaseSession();
    } catch {
      // Keep invalid-session semantics even if the OS storage layer is down.
    }
    dispatch({ type: "session_invalid" });
  }, []);

  const confirmStoredSession = useCallback(async (client: SupabaseClient) => {
    const { data: sessionData, error: sessionError } =
      await client.auth.getSession();

    if (sessionError) {
      if (isConfirmedInvalidSession(sessionError)) {
        await markInvalidSession(client);
      } else {
        dispatch({ type: "transient_failure" });
      }
      return;
    }

    const session = sessionData.session;
    if (!session) {
      dispatch({ type: "session_missing" });
      return;
    }

    const identity = identityFromUser(session.user);
    const { data: userData, error: userError } = await client.auth.getUser();

    if (userError) {
      if (isConfirmedInvalidSession(userError)) {
        await markInvalidSession(client);
      } else {
        dispatch({ type: "transient_failure", identity });
      }
      return;
    }

    if (!userData.user) {
      await markInvalidSession(client);
      return;
    }

    dispatch({
      type: "session_confirmed",
      identity: identityFromUser(userData.user),
    });
  }, [markInvalidSession]);

  const handleCallback = useCallback(
    async (rawUrl: string, client: SupabaseClient): Promise<boolean> => {
      const callback = parseNativeAuthCallback(rawUrl);
      if (!callback) {
        return false;
      }

      if (callback.kind === "invalid") {
        await closeAuthBrowser();
        dispatch({ type: "transient_failure" });
        return true;
      }

      if (callback.kind === "oauth_error") {
        await closeAuthBrowser();
        dispatch({
          type: "session_missing",
          notice:
            callback.reason === "cancelled"
              ? "Inicio de sesión cancelado."
              : "No pudimos iniciar sesión.",
        });
        return true;
      }

      if (
        stateRef.current.status === "authenticated" ||
        !callbackGateRef.current.claim(callback.code)
      ) {
        await closeAuthBrowser();
        return true;
      }

      dispatch({ type: "sign_in_started" });

      let result: Awaited<
        ReturnType<typeof client.auth.exchangeCodeForSession>
      >;
      try {
        result = await client.auth.exchangeCodeForSession(callback.code);
      } catch {
        await closeAuthBrowser();
        dispatch({ type: "transient_failure" });
        return true;
      }

      await closeAuthBrowser();
      const { data, error } = result;

      if (error) {
        if (isConfirmedInvalidSession(error)) {
          await markInvalidSession(client);
        } else {
          dispatch({ type: "transient_failure" });
        }
        return true;
      }

      if (!data.session) {
        dispatch({ type: "transient_failure" });
        return true;
      }

      dispatch({
        type: "session_confirmed",
        identity: identityFromUser(data.session.user),
      });
      return true;
    },
    [markInvalidSession],
  );

  useEffect(() => {
    if (!hasMobileSupabaseConfig()) {
      dispatch({ type: "transient_failure" });
      return;
    }

    const client = getMobileSupabaseClient();
    clientRef.current = client;
    let cancelled = false;
    const listenerHandles: PluginListenerHandle[] = [];

    const { data: authListener } = client.auth.onAuthStateChange(
      (event, session: Session | null) => {
        if (cancelled) {
          return;
        }

        if (
          session &&
          (event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED" ||
            event === "USER_UPDATED")
        ) {
          dispatch({
            type: "session_confirmed",
            identity: identityFromUser(session.user),
          });
        } else if (event === "SIGNED_OUT") {
          dispatch({ type: "session_invalid" });
        }
      },
    );

    async function registerLifecycle() {
      const urlHandle = await App.addListener("appUrlOpen", ({ url }) => {
        void handleCallback(url, client);
      });
      if (cancelled) {
        await urlHandle.remove();
        return;
      }
      listenerHandles.push(urlHandle);

      const stateHandle = await App.addListener(
        "appStateChange",
        ({ isActive }) => {
          if (isActive) {
            void client.auth.startAutoRefresh();
            if (stateRef.current.status === "auth_unavailable") {
              void confirmStoredSession(client);
            }
          } else {
            void client.auth.stopAutoRefresh();
          }
        },
      );
      if (cancelled) {
        await stateHandle.remove();
        return;
      }
      listenerHandles.push(stateHandle);

      const appState = await App.getState();
      if (appState.isActive) {
        await client.auth.startAutoRefresh();
      } else {
        await client.auth.stopAutoRefresh();
      }

      const launch = await App.getLaunchUrl();
      const handledAuthCallback = launch?.url
        ? await handleCallback(launch.url, client)
        : false;
      if (!handledAuthCallback) {
        await confirmStoredSession(client);
      }
    }

    void registerLifecycle().catch(() => {
      if (!cancelled) {
        dispatch({ type: "transient_failure" });
      }
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
      for (const handle of listenerHandles) {
        void handle.remove();
      }
      void client.auth.stopAutoRefresh();
    };
  }, [confirmStoredSession, handleCallback]);

  const signIn = useCallback(async () => {
    if (signInPendingRef.current || !isCapacitorRuntime()) {
      return;
    }

    const client = clientRef.current;
    if (!client) {
      dispatch({ type: "transient_failure" });
      return;
    }

    signInPendingRef.current = true;
    dispatch({ type: "sign_in_started" });

    try {
      const { data, error } = await client.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: NATIVE_AUTH_CALLBACK_URL,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) {
        dispatch({ type: "transient_failure" });
        return;
      }

      await Browser.open({ url: data.url });
    } catch {
      dispatch({ type: "transient_failure" });
    } finally {
      signInPendingRef.current = false;
    }
  }, []);

  const retry = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      dispatch({ type: "transient_failure" });
      return;
    }

    dispatch({ type: "restore_started" });
    try {
      await confirmStoredSession(client);
    } catch {
      dispatch({ type: "transient_failure" });
    }
  }, [confirmStoredSession]);

  const signOut = useCallback(async () => {
    const client = clientRef.current;
    if (!client) {
      return;
    }

    try {
      await client.auth.signOut({ scope: "local" });
    } catch {
      // Local cleanup below remains authoritative for an explicit logout.
    }

    try {
      await clearMobileSupabaseSession();
    } catch {
      dispatch({ type: "transient_failure" });
      return;
    }

    dispatch({ type: "session_missing" });
  }, []);

  return {
    retry,
    signIn,
    signOut,
    state,
  };
}
