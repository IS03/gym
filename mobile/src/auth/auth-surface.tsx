import type { NativeInfo } from "../native/types";
import type { MobileAuthState } from "./state";

type AuthSurfaceProps = {
  nativeInfo: NativeInfo | null;
  onRetry: () => Promise<void>;
  onSignIn: () => Promise<void>;
  state: Exclude<MobileAuthState, { status: "authenticated" }>;
};

export function AuthSurface({
  nativeInfo,
  onRetry,
  onSignIn,
  state,
}: AuthSurfaceProps) {
  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="brand">OWNLEVEL</p>

        {state.status === "booting" ? (
          <>
            <h1 id="auth-title">Tu nivel, en un solo lugar.</h1>
            <p className="auth-status" role="status">
              Comprobando sesión…
            </p>
          </>
        ) : null}

        {state.status === "signed_out" ? (
          <>
            <h1 id="auth-title">Tu nivel, en un solo lugar.</h1>
            <p className="auth-status">
              {state.notice ?? "Ingresá para continuar con OWNLEVEL."}
            </p>
            <button
              className="primary-action"
              disabled={nativeInfo?.runtime !== "capacitor"}
              onClick={() => void onSignIn()}
              type="button"
            >
              Continuar con Google
            </button>
            {nativeInfo?.runtime === "browser" ? (
              <p className="runtime-note">El acceso nativo se prueba en iOS.</p>
            ) : null}
          </>
        ) : null}

        {state.status === "signing_in" ? (
          <>
            <h1 id="auth-title">Tu nivel, en un solo lugar.</h1>
            <p className="auth-status" role="status">
              Iniciando sesión…
            </p>
            <button className="primary-action" disabled type="button">
              Continuar con Google
            </button>
          </>
        ) : null}

        {state.status === "auth_unavailable" ? (
          <>
            <h1 id="auth-title">Tu nivel, en un solo lugar.</h1>
            <p className="auth-status" role="alert">
              No pudimos comprobar tu sesión.
            </p>
            <button
              className="secondary-action"
              onClick={() => void onRetry()}
              type="button"
            >
              Reintentar
            </button>
          </>
        ) : null}
      </section>
    </main>
  );
}
