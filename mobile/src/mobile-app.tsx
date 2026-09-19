import { useEffect, useState } from "react";

import { useMobileAuth } from "./auth/use-mobile-auth";
import { native } from "./native/bridge";
import {
  NATIVE_CAPABILITY_NAMES,
  type NativeInfo,
} from "./native/types";

export function MobileApp() {
  const { retry, signIn, signOut, state } = useMobileAuth();
  const [logoutPending, setLogoutPending] = useState(false);
  const [nativeInfo, setNativeInfo] = useState<NativeInfo | null>(null);

  useEffect(() => {
    let active = true;

    void native.info().then((info) => {
      if (active) {
        setNativeInfo(info);
      }
    });

    return () => {
      active = false;
    };
  }, []);

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
              disabled={nativeInfo?.runtime !== "capacitor"}
              onClick={() => void signIn()}
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
            {nativeInfo ? (
              <section
                className="foundation-diagnostics"
                aria-label="Diagnóstico de la foundation nativa"
              >
                <p className="diagnostics-title">Foundation diagnostics</p>
                <dl className="diagnostics-grid">
                  <div>
                    <dt>Platform</dt>
                    <dd>{nativeInfo.platform}</dd>
                  </div>
                  <div>
                    <dt>Runtime</dt>
                    <dd>{nativeInfo.runtime}</dd>
                  </div>
                  <div>
                    <dt>App</dt>
                    <dd>{nativeInfo.appVersion ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Build</dt>
                    <dd>{nativeInfo.buildNumber ?? "—"}</dd>
                  </div>
                  <div>
                    <dt>Bridge</dt>
                    <dd>{nativeInfo.bridgeVersion}</dd>
                  </div>
                </dl>
                <ul className="capability-list">
                  {NATIVE_CAPABILITY_NAMES.map((capability) => (
                    <li key={capability}>
                      <span>{capability}</span>
                      <span>{nativeInfo.capabilities[capability]}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
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
