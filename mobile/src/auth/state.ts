export type AuthIdentity = {
  displayName: string | null;
  email: string | null;
};

export type MobileAuthState =
  | { status: "booting" }
  | { status: "signed_out"; notice?: string }
  | { status: "signing_in" }
  | { status: "authenticated"; identity: AuthIdentity }
  | { status: "auth_unavailable"; identity: AuthIdentity | null };

export type MobileAuthEvent =
  | { type: "restore_started" }
  | { type: "sign_in_started" }
  | { type: "session_confirmed"; identity: AuthIdentity }
  | { type: "session_missing"; notice?: string }
  | { type: "session_invalid" }
  | { type: "transient_failure"; identity?: AuthIdentity | null };

export const initialMobileAuthState: MobileAuthState = { status: "booting" };

export function mobileAuthReducer(
  state: MobileAuthState,
  event: MobileAuthEvent,
): MobileAuthState {
  switch (event.type) {
    case "restore_started":
      return { status: "booting" };
    case "sign_in_started":
      return { status: "signing_in" };
    case "session_confirmed":
      return { status: "authenticated", identity: event.identity };
    case "session_missing":
      return { status: "signed_out", notice: event.notice };
    case "session_invalid":
      return { status: "signed_out" };
    case "transient_failure":
      return {
        status: "auth_unavailable",
        identity:
          event.identity ??
          (state.status === "authenticated" || state.status === "auth_unavailable"
            ? state.identity
            : null),
      };
  }
}
