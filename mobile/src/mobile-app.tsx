import { useState } from "react";

import { useMobileAuth } from "./auth/use-mobile-auth";

export function MobileApp() {
  const { isNative, retry, signIn, signOut, state } = useMobileAuth();
  const [logoutPending, setLogoutPending] = useState(false);

  async function handleLogout() {
    if (logoutPending) {
      return;
    }

    setLogoutPending(true);
    try {
      await signOut();
    } finally {
      setLogoutPending(false);
    }
  }

  return (
    <main className="mobile-shell">
      <section className="foundation-card" aria-labelledby="auth-title">
        <p className="brand">OWNLEVEL</p>

        {state.status === "booting" ? (
          <>
            <h1 id="auth-title">Native authentication</h1>
            <p className="status" role="status">
              Comprobando sesión…
            </p>
          </>
        ) : null}

        {state.status === "signed_out" ? (
          <>
            <h1 id="auth-title">Native authentication</h1>
            <p className="status">{state.notice ?? "Ingresá a tu cuenta."}</p>
            <button
              className="primary-action"
              disabled={!isNative}
              onClick={() => void signIn()}
              type="button"
            >
              Continuar con Google
            </button>
            {!isNative ? (
              <p className="runtime-note">El acceso nativo se prueba en iOS.</p>
            ) : null}
          </>
        ) : null}

        {state.status === "signing_in" ? (
          <>
            <h1 id="auth-title">Native authentication</h1>
            <p className="status" role="status">
              Iniciando sesión…
            </p>
            <button className="primary-action" disabled type="button">
              Continuar con Google
            </button>
          </>
        ) : null}

        {state.status === "authenticated" ? (
          <>
            <h1 id="auth-title">Sesión activa</h1>
            <p className="status">
              {state.identity.displayName ?? state.identity.email ?? "Cuenta OWNLEVEL"}
            </p>
            <button
              className="secondary-action"
              disabled={logoutPending}
              onClick={() => void handleLogout()}
              type="button"
            >
              {logoutPending ? "Cerrando sesión…" : "Cerrar sesión"}
            </button>
          </>
        ) : null}

        {state.status === "auth_unavailable" ? (
          <>
            <h1 id="auth-title">Native authentication</h1>
            <p className="status" role="alert">
              No pudimos comprobar tu sesión.
            </p>
            <button
              className="secondary-action"
              onClick={() => void retry()}
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
